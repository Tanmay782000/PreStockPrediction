import axios from "axios";
import yahooFinance from "yahoo-finance2";
import { bearish_SYMBOL_MAP } from "../../Common/stockInfo.js";

const yf = new yahooFinance();

// ---------------- TECHNICAL HELPERS ----------------
const average = (arr) =>
  arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

function getHistoricalATR(allQuotes, currentIndex, period) {
    if (currentIndex < period) return 0;
    let trs = [];
    for (let i = currentIndex - period + 1; i <= currentIndex; i++) {
        const tr = Math.max(
            allQuotes[i].high - allQuotes[i].low,
            Math.abs(allQuotes[i].high - allQuotes[i - 1].close),
            Math.abs(allQuotes[i].low - allQuotes[i - 1].close)
        );
        trs.push(tr);
    }
    return average(trs);
}

function calculateEMA(prices, period) {
    if (prices.length < period) return [];
    const k = 2 / (period + 1);
    let ema = [prices[0]];
    for (let i = 1; i < prices.length; i++) {
        ema.push(prices[i] * k + ema[i - 1] * (1 - k));
    }
    return ema;
}

// ================================================================
//  LEVEL 2 FILTER 1 — FII/DII Activity (BEARISH MIRROR)
//  If FII is net SELLING = institutional headwind for entire market
//  Only trade bearish setups on FII net selling days for high confidence
// ================================================================
async function getFIIDIIData() {
    try {
        const res = await axios.get(
            'https://www.nseindia.com/api/fiidiiTradeReact',
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'application/json',
                    'Referer': 'https://www.nseindia.com'
                }
            }
        );

        const data = res.data;
        const fiiNet = parseFloat(data[0]?.netPurchasesSales || 0);
        const diiNet = parseFloat(data[1]?.netPurchasesSales || 0);

        return {
            fiiNet,
            diiNet,
            // FII selling > 500 Cr = strong institutional selling pressure
            isFIIBearish: fiiNet < -500,
            // Both selling = extremely bearish day
            isBothBearish: fiiNet < 0 && diiNet < 0,
            label: fiiNet < -500
                ? `🏦 FII SELLING ₹${Math.abs(fiiNet).toFixed(0)}Cr`
                : fiiNet < 0
                ? `🏦 FII MILD SELL ₹${Math.abs(fiiNet).toFixed(0)}Cr`
                : `🏦 FII BUYING ₹${fiiNet.toFixed(0)}Cr`
        };
    } catch (err) {
        console.log(`⚠️  FII/DII data failed — ${err.message?.slice(0, 50)}`);
        return { fiiNet: 0, diiNet: 0, isFIIBearish: false, isBothBearish: false, label: '🏦 FII N/A' };
    }
}

// ================================================================
//  LEVEL 2 FILTER 2 — Relative Weakness vs Nifty (BEARISH MIRROR)
//  Stock must UNDERPERFORM Nifty over last 20 days
//  Market laggards fall more than index = RS laggards = short candidates
// ================================================================
function calculateRelativeWeakness(stockQuotes, niftyQuotes, days = 20) {
    if (stockQuotes.length < days || niftyQuotes.length < days) {
        return { rw: 0, isLaggard: false, label: '📊 RW N/A' };
    }

    const stockReturn = (stockQuotes.at(-1).close - stockQuotes.at(-days).close)
                      / stockQuotes.at(-days).close;
    const niftyReturn = (niftyQuotes.at(-1).close - niftyQuotes.at(-days).close)
                      / niftyQuotes.at(-days).close;

    // Negative value = stock underperformed Nifty
    const rw = stockReturn - niftyReturn;

    return {
        rw: (rw * 100).toFixed(2),
        // RW < -3% means stock underperformed Nifty by 3% in 20 days = bearish
        isLaggard: rw < -0.03,
        label: rw < -0.03
            ? `📊 RW LAGGARD ${(rw * 100).toFixed(1)}%`
            : `📊 RW LEADER +${(rw * 100).toFixed(1)}%`
    };
}

// ================================================================
//  LEVEL 2 FILTER 3 — Multi-Timeframe (MTF) Bearish Alignment
//  Weekly trend + Daily trend must BOTH be bearish
//  Shorting with higher timeframe = high probability
// ================================================================
async function checkMTFAlignment(symbolKey) {
    try {
        const [weeklyData, dailyData] = await Promise.all([
            yf.chart(`${symbolKey}.NS`, {
                period1: Math.floor((Date.now() - 365 * 24 * 60 * 60 * 1000) / 1000),
                interval: "1wk"
            }),
            yf.chart(`${symbolKey}.NS`, {
                period1: Math.floor((Date.now() - 60 * 24 * 60 * 60 * 1000) / 1000),
                interval: "1d"
            })
        ]);

        const wQuotes = weeklyData.quotes.filter(q => q.close);
        const dQuotes = dailyData.quotes.filter(q => q.close);

        if (wQuotes.length < 20 || dQuotes.length < 20) {
            return { aligned: false, weeklyBearish: false, dailyBearish: false, label: '📅 MTF N/A' };
        }

        // Weekly: price BELOW 20-week EMA (bearish)
        const weeklyEMA20 = calculateEMA(wQuotes.map(q => q.close), 20);
        const weeklyBearish = wQuotes.at(-1).close < weeklyEMA20.at(-1);

        // Daily: price BELOW 20-day EMA (bearish)
        const dailyEMA20 = calculateEMA(dQuotes.map(q => q.close), 20);
        const dailyBearish = dQuotes.at(-1).close < dailyEMA20.at(-1);

        // Daily: price BELOW 50-day EMA (extra bearish confluence)
        const dailyEMA50 = calculateEMA(dQuotes.map(q => q.close), 50);
        const belowEMA50 = dQuotes.at(-1).close < dailyEMA50.at(-1);

        // Both timeframes bearish = fully aligned downtrend
        const aligned = weeklyBearish && dailyBearish;

        return {
            aligned,
            weeklyBearish,
            dailyBearish,
            belowEMA50,
            label: aligned
                ? `📅 MTF ✅ ${belowEMA50 ? '+EMA50' : ''}`
                : `📅 MTF ❌ W:${weeklyBearish ? '✅' : '❌'} D:${dailyBearish ? '✅' : '❌'}`
        };
    } catch (err) {
        return { aligned: false, weeklyBearish: false, dailyBearish: false, label: '📅 MTF ERR' };
    }
}

// ================================================================
//  LEVEL 2 FILTER 4 — Distribution Base Quality (BEARISH MIRROR)
//  Tight range at TOP before breakdown = distribution = smart money exiting
//  Wide choppy selloff already happened = low quality = skip
//  Logic: opposite of consolidation coiled spring — this is a topped-out stock
// ================================================================
function checkDistributionQuality(quotes) {
    if (quotes.length < 15) {
        return { isHighQuality: false, label: '📐 DIST N/A' };
    }

    const last15 = quotes.slice(-15);

    const highOfBase = Math.max(...last15.map(q => q.high));
    const lowOfBase  = Math.min(...last15.map(q => q.low));

    // Distribution tightness: narrow range at top = smart money quietly exiting
    const baseTightness = ((highOfBase - lowOfBase) / lowOfBase) * 100;

    // Volume should be HIGH during distribution (selling pressure building)
    // Opposite of bullish where volume contracts
    const firstHalfVol  = average(last15.slice(0, 7).map(q => q.volume));
    const secondHalfVol = average(last15.slice(8).map(q => q.volume));
    const volumeExpanding = secondHalfVol > firstHalfVol * 1.15; // 15% expansion = selling pressure

    const isHighQuality = baseTightness < 8 && volumeExpanding;
    const isMediumQuality = baseTightness < 12;

    return {
        baseTightness: baseTightness.toFixed(2),
        isHighQuality,
        isMediumQuality,
        volumeExpanding,
        label: isHighQuality
            ? `📐 TIGHT DIST ${baseTightness.toFixed(1)}% 📦`
            : isMediumQuality
            ? `📐 DIST ${baseTightness.toFixed(1)}%`
            : `📐 WIDE DIST ${baseTightness.toFixed(1)}% ⚠️`
    };
}

// ================================================================
//  LEVEL 2 FILTER 5 — Sector Weakness (BEARISH MIRROR)
//  Stock breaking down while sector is ALSO weak = high quality short
//  Stock breaking down against strong sector = avoid (sector could lift it)
// ================================================================
const SECTOR_ETFS = {
    // Banking
    'HDFCBANK': '^NSEBANK', 'SBIN': '^NSEBANK', 'ICICIBANK': '^NSEBANK',
    'AXISBANK': '^NSEBANK', 'KOTAKBANK': '^NSEBANK', 'BANKBARODA': '^NSEBANK',
    // IT
    'INFY': 'INFY.NS', 'TCS': 'TCS.NS', 'WIPRO': 'WIPRO.NS', 'HCLTECH': 'HCLTECH.NS',
    // Pharma
    'SUNPHARMA': 'SUNPHARMA.NS', 'DRREDDY': 'DRREDDY.NS', 'CIPLA': 'CIPLA.NS',
    // Auto
    'MARUTI': 'MARUTI.NS', 'TATAMOTORS': 'TATAMOTORS.NS', 'M&M': 'M&M.NS',
    // FMCG
    'HINDUNILVR': 'HINDUNILVR.NS', 'NESTLEIND': 'NESTLEIND.NS', 'ITC': 'ITC.NS',
};

async function isSectorBearish(symbolKey, niftyQuotes) {
    try {
        const etfSymbol = SECTOR_ETFS[symbolKey];

        // If no sector ETF mapped, use Nifty as proxy
        if (!etfSymbol) {
            const niftyEMA5 = calculateEMA(niftyQuotes.map(q => q.close), 5);
            // Bearish = Nifty BELOW EMA5
            const bearish = niftyQuotes.at(-1).close < niftyEMA5.at(-1);
            return { bearish, label: bearish ? '🏭 NIFTY ✅' : '🏭 NIFTY ❌' };
        }

        const sectorData = await yf.chart(etfSymbol, {
            period1: Math.floor((Date.now() - 15 * 24 * 60 * 60 * 1000) / 1000),
            interval: "1d"
        });

        const sectorQuotes = sectorData.quotes.filter(q => q.close);
        if (sectorQuotes.length < 5) {
            return { bearish: true, label: '🏭 SECTOR N/A' };
        }

        const sectorEMA5 = calculateEMA(sectorQuotes.map(q => q.close), 5);
        // Bearish = sector BELOW EMA5
        const bearish = sectorQuotes.at(-1).close < sectorEMA5.at(-1);

        return {
            bearish,
            label: bearish ? `🏭 SECTOR ✅` : `🏭 SECTOR ❌`
        };
    } catch (err) {
        return { bearish: true, label: '🏭 SECTOR ERR' };
    }
}

// ================================================================
//  LEVEL 2 FILTER 6 — Earnings Deterioration (BEARISH MIRROR)
//  Stock that GAPPED DOWN strongly on results = fundamental weakness
//  Proxy: largest NEGATIVE gap in last 90 days
// ================================================================
function checkEarningsDegradation(quotes) {
    if (quotes.length < 5) {
        return { hadWeakEarnings: false, label: '💹 EARN N/A' };
    }

    let maxNegGap = 0; // Track the biggest down-gap
    for (let i = 1; i < quotes.length; i++) {
        const gap = ((quotes[i].open - quotes[i - 1].close) / quotes[i - 1].close) * 100;
        // gap is negative for a down-gap
        if (gap < maxNegGap) maxNegGap = gap;
    }

    return {
        hadWeakEarnings: maxNegGap < -3,
        earningsGap: maxNegGap.toFixed(2),
        label: maxNegGap < -3
            ? `💹 EARN DROP ${maxNegGap.toFixed(1)}%`
            : `💹 NO EARN DROP`
    };
}

// ================================================================
//  BASIC FILTERS — Bearish breakdown candidates
// ================================================================
async function findBreakdownCandidates() {
    const results = [];

    for (const [symbolKey] of Object.entries(bearish_SYMBOL_MAP)) {
        try {
            const dailyData = await yf.chart(`${symbolKey}.NS`, {
                period1: Math.floor((Date.now() - 60 * 24 * 60 * 60 * 1000) / 1000),
                interval: "1d"
            });

            const quotes = dailyData.quotes.filter(q => q.close);

            // ── DELISTED GUARD ────────────────────────────────────────
            if (quotes.length < 20) {
                console.log(`⚠️  ${symbolKey.padEnd(12)} | Skipped — Insufficient data`);
                continue;
            }
            const lastTradedDate = new Date(quotes[quotes.length - 1].date);
            const daysSinceLastTrade = (Date.now() - lastTradedDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceLastTrade > 10) {
                console.log(`⚠️  ${symbolKey.padEnd(12)} | Skipped — Last traded ${Math.floor(daysSinceLastTrade)}d ago`);
                continue;
            }
            // ─────────────────────────────────────────────────────────

            const last   = quotes[quotes.length - 1];
            const prev20 = quotes.slice(-21, -1);

            const low52w          = Math.min(...quotes.map(q => q.low));
            const nearLowPercent  = ((last.close - low52w) / low52w) * 100;
            const avgVol20        = average(prev20.map(q => q.volume));
            const volumeSurge     = last.volume / avgVol20;
            const supportLevel    = Math.min(...prev20.map(q => q.low));
            const nearBreakdown   = ((last.close - supportLevel) / supportLevel) * 100;
            const dayRange        = last.high - last.low;
            const closePosition   = dayRange > 0 ? (last.close - last.low) / dayRange : 1;
            const isBearishCandle = last.close < last.open;
            const last3           = quotes.slice(-3);
            const consecutiveRed  = last3.every(q => q.close < q.open);
            const atr             = getHistoricalATR(quotes, quotes.length - 1, 14);
            const atrPercent      = (atr / last.close) * 100;

            const score = (
                (volumeSurge > 1.5 ? 2 : 0) +
                (nearBreakdown < 1.0 ? 2 : 0) +
                (closePosition < 0.3 ? 1 : 0) +
                (nearLowPercent < 3.0 ? 2 : 0) +
                (atrPercent > 1.5 ? 1 : 0) +
                (isBearishCandle ? 1 : 0) +
                (consecutiveRed ? 1 : 0)
            );

            if (score >= 4) {
                results.push({
                    symbol: symbolKey,
                    close: last.close,
                    volumeSurge: volumeSurge.toFixed(2),
                    nearBreakdown: nearBreakdown.toFixed(2),
                    nearLowPercent: nearLowPercent.toFixed(2),
                    closePosition: (closePosition * 100).toFixed(0),
                    consecutiveRed,
                    score,
                    quotes // pass forward for Level 2 filters
                });
            }

        } catch (err) {
            console.log(`⚠️  ${symbolKey.padEnd(12)} | Skipped — ${err.message?.slice(0, 50) || 'Unknown error'}`);
            continue;
        }
    }

    return results.sort((a, b) => b.score - a.score);
}

// ================================================================
//  BEARISH NEWS — negative catalysts
// ================================================================
async function getBearishNewsStocks() {
    try {
        const res = await axios.get(
            'https://www.nseindia.com/api/corporate-announcements?index=equities',
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'application/json',
                    'Referer': 'https://www.nseindia.com'
                }
            }
        );
        return res.data
            .filter(a => {
                const subject = a.desc?.toLowerCase() || '';
                return (
                    subject.includes('loss') ||
                    subject.includes('penalty') ||
                    subject.includes('fraud') ||
                    subject.includes('downgrade') ||
                    subject.includes('resignation') ||
                    subject.includes('insolvency') ||
                    subject.includes('default') ||
                    subject.includes('litigation') ||
                    subject.includes('below estimate') ||
                    subject.includes('profit warning')
                );
            })
            .map(a => ({ symbol: a.symbol, subject: a.desc, date: a.an_dt }));
    } catch (err) {
        throw new Error(`NSE News API failed — ${err.message}`);
    }
}

// ================================================================
//  BEARISH F&O — OI buildup + price falling = short buildup
// ================================================================
async function getBearishFnOStocks() {
    try {
        const res = await axios.get(
            'https://www.nseindia.com/api/live-analysis-oi-spurts-underlyings',
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'application/json',
                    'Referer': 'https://www.nseindia.com'
                }
            }
        );
        return res.data.data
            .filter(s => s.pChange < 0)
            .sort((a, b) => b.oiChange - a.oiChange)
            .slice(0, 10)
            .map(s => ({
                symbol: s.symbol,
                price: s.lastPrice,
                oiChange: s.oiChange,
                priceChange: s.pChange
            }));
    } catch (err) {
        throw new Error(`NSE F&O API failed — ${err.message}`);
    }
}

// ================================================================
//  MAIN — Professional Grade Pre-Market Bearish Watchlist
// ================================================================
async function generatePreMarketBearishWatchlist() {
    console.log("⏰ Professional Pre-Market BEARISH Scan Starting...\n");

    // ── STEP 1: Fetch all data in parallel ───────────────────────
    const [breakdowns, newsStocks, fnoStocks, fiiData, niftyDataRaw] = await Promise.allSettled([
        findBreakdownCandidates(),
        getBearishNewsStocks(),
        getBearishFnOStocks(),
        getFIIDIIData(),
        yf.chart("^NSEI", {
            period1: Math.floor((Date.now() - 60 * 24 * 60 * 60 * 1000) / 1000),
            interval: "1d"
        })
    ]);

    const breakdownList = breakdowns.status  === 'fulfilled' ? breakdowns.value  : [];
    const newsList      = newsStocks.status  === 'fulfilled' ? newsStocks.value  : [];
    const fnoList       = fnoStocks.status   === 'fulfilled' ? fnoStocks.value   : [];
    const fii           = fiiData.status     === 'fulfilled' ? fiiData.value     : { isFIIBearish: false, label: '🏦 FII N/A' };
    const niftyQuotes   = niftyDataRaw.status === 'fulfilled'
        ? niftyDataRaw.value.quotes.filter(q => q.close)
        : [];

    if (newsStocks.status === 'rejected') console.log(`⚠️  NSE News API failed — ${newsStocks.reason?.message}`);
    if (fnoStocks.status  === 'rejected') console.log(`⚠️  NSE F&O API failed  — ${fnoStocks.reason?.message}`);

    // ── STEP 2: Market-level context ─────────────────────────────
    console.log(`\n📊 MARKET CONTEXT`);
    console.log("─".repeat(50));
    console.log(`  ${fii.label}`);
    console.log(`  ${fii.isFIIBearish ? '✅ FII SELLING — High confidence SHORT day' : '⚠️  FII NOT SELLING — Trade smaller size'}`);
    console.log("─".repeat(50) + "\n");

    const newsSymbols = new Set(newsList.map(n => n.symbol));
    const fnoSymbols  = new Set(fnoList.map(f => f.symbol));

    // ── STEP 3: Apply Level 2 professional filters per stock ──────
    const enrichedList = [];

    for (const stock of breakdownList) {
        try {
            // Run all Level 2 filters in parallel per stock
            const [mtf, sector] = await Promise.all([
                checkMTFAlignment(stock.symbol),
                isSectorBearish(stock.symbol, niftyQuotes)
            ]);

            const rw       = calculateRelativeWeakness(stock.quotes, niftyQuotes, 20);
            const dist     = checkDistributionQuality(stock.quotes);
            const earnings = checkEarningsDegradation(stock.quotes);

            // ── PROFESSIONAL SCORE (BEARISH) ──────────────────────
            const professionalScore = (
                (rw.isLaggard            ? 2 : 0) +   // Underperforming Nifty
                (mtf.aligned             ? 2 : 0) +   // Weekly + Daily both bearish
                (dist.isHighQuality      ? 2 : 0) +   // Tight distribution top
                (dist.isMediumQuality && !dist.isHighQuality ? 1 : 0) + // Medium dist
                (sector.bearish          ? 1 : 0) +   // Sector headwind
                (earnings.hadWeakEarnings ? 1 : 0) +  // Fundamental weakness
                (fii.isFIIBearish        ? 1 : 0)    // Market headwind
            );
            // ─────────────────────────────────────────────────────

            // ── PROFESSIONAL GATE ─────────────────────────────────
            // Must pass at least 3 out of 4 key checks to qualify
            const keyChecks = [rw.isLaggard, mtf.aligned, dist.isMediumQuality, sector.bearish];
            const keyChecksPassed = keyChecks.filter(Boolean).length;
            const passedProfessionalGate = keyChecksPassed >= 3;
            // ─────────────────────────────────────────────────────

            const finalScore = stock.score +
                (newsSymbols.has(stock.symbol) ? 3 : 0) +
                (fnoSymbols.has(stock.symbol)  ? 2 : 0) +
                professionalScore;

            enrichedList.push({
                ...stock,
                inNews: newsSymbols.has(stock.symbol),
                inFnO:  fnoSymbols.has(stock.symbol),
                finalScore,
                professionalScore,
                keyChecksPassed,
                passedProfessionalGate,
                filters: { rw, mtf, dist, sector, earnings }
            });

        } catch (err) {
            enrichedList.push({
                ...stock,
                inNews: newsSymbols.has(stock.symbol),
                inFnO:  fnoSymbols.has(stock.symbol),
                finalScore: stock.score +
                    (newsSymbols.has(stock.symbol) ? 3 : 0) +
                    (fnoSymbols.has(stock.symbol)  ? 2 : 0),
                professionalScore: 0,
                keyChecksPassed: 0,
                passedProfessionalGate: false,
                filters: {}
            });
        }
    }

    // ── STEP 4: Sort and split into tiers ────────────────────────
    const sorted = enrichedList.sort((a, b) => b.finalScore - a.finalScore);

    // TIER 1: Passed professional gate (highest conviction shorts)
    const tier1 = sorted.filter(s => s.passedProfessionalGate).slice(0, 8);
    // TIER 2: Didn't pass gate but still technically weak
    const tier2 = sorted.filter(s => !s.passedProfessionalGate).slice(0, 5);

    // ── STEP 5: Display ──────────────────────────────────────────
    console.log("🏆 TIER 1 — HIGH CONVICTION SHORTS (3+ Professional Checks Passed)");
    console.log("=".repeat(70));

    if (tier1.length === 0) {
        console.log("  No high conviction short setups today. Consider sitting out.");
    }

    tier1.forEach((s, i) => {
        const sources = [];
        if (s.score >= 4) sources.push("📉 BREAKDOWN");
        if (s.inNews)     sources.push("📰 NEWS");
        if (s.inFnO)      sources.push("💰 F&O SHORT");
        const sourceLabel = sources.join(" + ");

        console.log(
            `\n${String(i+1).padStart(2)}. ${s.symbol.padEnd(12)} | ₹${s.close} | Final Score: ${s.finalScore} | [${sourceLabel}]`
        );
        console.log(`    ├─ Basic    : Vol ${s.volumeSurge}x | Supp ${s.nearBreakdown}% away ${s.nearLowPercent < 3 ? '| 📉 52WL' : ''} ${s.consecutiveRed ? '| 🔴 3RED' : ''}`);
        if (s.filters.rw)       console.log(`    ├─ ${s.filters.rw.label}`);
        if (s.filters.mtf)      console.log(`    ├─ ${s.filters.mtf.label}`);
        if (s.filters.dist)     console.log(`    ├─ ${s.filters.dist.label}`);
        if (s.filters.sector)   console.log(`    ├─ ${s.filters.sector.label}`);
        if (s.filters.earnings) console.log(`    └─ ${s.filters.earnings.label}`);
    });

    console.log("\n⚡ TIER 2 — WATCHLIST ONLY (Monitor but trade cautiously)");
    console.log("=".repeat(70));

    tier2.forEach((s, i) => {
        const sources = [];
        if (s.score >= 4) sources.push("📉 BREAKDOWN");
        if (s.inNews)     sources.push("📰 NEWS");
        if (s.inFnO)      sources.push("💰 F&O SHORT");

        console.log(
            `  ${String(i+1).padStart(2)}. ${s.symbol.padEnd(12)} | ₹${s.close} | Score: ${s.finalScore} | [${sources.join(" + ")}] | Checks: ${s.keyChecksPassed}/4`
        );
    });

    console.log("\n" + "=".repeat(70));
    console.log(`📋 SUMMARY: ${tier1.length} high conviction shorts | ${tier2.length} on watchlist | ${fii.label}`);
    console.log("=".repeat(70) + "\n");

    // ── STEP 6: Bearish news detail ───────────────────────────────
    if (newsList.length > 0) {
        console.log("\n📋 BEARISH NEWS DETAIL:");
        console.log("-".repeat(70));
        newsList.slice(0, 5).forEach(n => {
            console.log(`  ${n.symbol.padEnd(12)} | ${n.date} | ${n.subject?.slice(0, 50)}`);
        });
    }
}

await generatePreMarketBearishWatchlist();