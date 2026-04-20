import axios from "axios";
import yahooFinance from "yahoo-finance2";
import { Bullish_SYMBOL_MAP } from "../../Common/stockInfo.js";

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
//  LEVEL 2 FILTER 1 — FII/DII Activity
//  If FII is net buying = institutional tailwind for entire market
//  Only trade bullish setups on FII net buying days
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
            // FII buying > 500 Cr = strong institutional support
            isFIIBullish: fiiNet > 500,
            // Both buying = extremely bullish day
            isBothBullish: fiiNet > 0 && diiNet > 0,
            label: fiiNet > 500
                ? `🏦 FII BUYING ₹${fiiNet.toFixed(0)}Cr`
                : fiiNet > 0
                ? `🏦 FII MILD BUY ₹${fiiNet.toFixed(0)}Cr`
                : `🏦 FII SELLING ₹${Math.abs(fiiNet).toFixed(0)}Cr`
        };
    } catch (err) {
        console.log(`⚠️  FII/DII data failed — ${err.message?.slice(0, 50)}`);
        // Don't block scan if FII data unavailable
        return { fiiNet: 0, diiNet: 0, isFIIBullish: false, isBothBullish: false, label: '🏦 FII N/A' };
    }
}

// ================================================================
//  LEVEL 2 FILTER 2 — Relative Strength vs Nifty
//  Stock must OUTPERFORM Nifty over last 20 days
//  Market leaders go up more than index = RS leaders
// ================================================================
function calculateRelativeStrength(stockQuotes, niftyQuotes, days = 20) {
    if (stockQuotes.length < days || niftyQuotes.length < days) {
        return { rs: 0, isLeader: false, label: '📊 RS N/A' };
    }

    const stockReturn = (stockQuotes.at(-1).close - stockQuotes.at(-days).close)
                      / stockQuotes.at(-days).close;
    const niftyReturn = (niftyQuotes.at(-1).close - niftyQuotes.at(-days).close)
                      / niftyQuotes.at(-days).close;

    const rs = stockReturn - niftyReturn;

    return {
        rs: (rs * 100).toFixed(2),
        // RS > 3% means stock outperformed Nifty by 3% in 20 days
        isLeader: rs > 0.03,
        label: rs > 0.03
            ? `📊 RS LEADER +${(rs * 100).toFixed(1)}%`
            : `📊 RS LAGGARD ${(rs * 100).toFixed(1)}%`
    };
}

// ================================================================
//  LEVEL 2 FILTER 3 — Multi-Timeframe (MTF) Alignment
//  Weekly trend + Daily trend must BOTH be bullish
//  Trading against the higher timeframe = low probability
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
            return { aligned: false, weeklyBullish: false, dailyBullish: false, label: '📅 MTF N/A' };
        }

        // Weekly: price above 20-week EMA
        const weeklyEMA20 = calculateEMA(wQuotes.map(q => q.close), 20);
        const weeklyBullish = wQuotes.at(-1).close > weeklyEMA20.at(-1);

        // Daily: price above 20-day EMA
        const dailyEMA20 = calculateEMA(dQuotes.map(q => q.close), 20);
        const dailyBullish = dQuotes.at(-1).close > dailyEMA20.at(-1);

        // Daily: price above 50-day EMA (extra confluence)
        const dailyEMA50 = calculateEMA(dQuotes.map(q => q.close), 50);
        const aboveEMA50 = dQuotes.at(-1).close > dailyEMA50.at(-1);

        const aligned = weeklyBullish && dailyBullish;

        return {
            aligned,
            weeklyBullish,
            dailyBullish,
            aboveEMA50,
            label: aligned
                ? `📅 MTF ✅ ${aboveEMA50 ? '+EMA50' : ''}`
                : `📅 MTF ❌ W:${weeklyBullish ? '✅' : '❌'} D:${dailyBullish ? '✅' : '❌'}`
        };
    } catch (err) {
        return { aligned: false, weeklyBullish: false, dailyBullish: false, label: '📅 MTF ERR' };
    }
}

// ================================================================
//  LEVEL 2 FILTER 4 — Consolidation Base Quality
//  Tight base before breakout = coiled spring = high probability
//  Wide choppy base = low quality = skip
// ================================================================
function checkConsolidationQuality(quotes) {
    if (quotes.length < 15) {
        return { isHighQuality: false, label: '📐 BASE N/A' };
    }

    const last15 = quotes.slice(-15);

    const highOfBase = Math.max(...last15.map(q => q.high));
    const lowOfBase  = Math.min(...last15.map(q => q.low));

    // Base tightness: range of consolidation as % of price
    const baseTightness = ((highOfBase - lowOfBase) / lowOfBase) * 100;

    // Volume should CONTRACT during base (sellers exhausting)
    const firstHalfVol  = average(last15.slice(0, 7).map(q => q.volume));
    const secondHalfVol = average(last15.slice(8).map(q => q.volume));
    const volumeContracting = secondHalfVol < firstHalfVol * 0.85; // 15% contraction

    // How many days in base (longer base = more energy stored)
    const daysInBase = last15.length;

    const isHighQuality = baseTightness < 8 && volumeContracting;
    const isMediumQuality = baseTightness < 12;

    return {
        baseTightness: baseTightness.toFixed(2),
        isHighQuality,
        isMediumQuality,
        volumeContracting,
        label: isHighQuality
            ? `📐 TIGHT BASE ${baseTightness.toFixed(1)}% 🔋`
            : isMediumQuality
            ? `📐 BASE ${baseTightness.toFixed(1)}%`
            : `📐 WIDE BASE ${baseTightness.toFixed(1)}% ⚠️`
    };
}

// ================================================================
//  LEVEL 2 FILTER 5 — Sector Momentum
//  Stock breaking out while sector is weak = low quality
//  Stock breaking out with sector tailwind = high quality
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

async function isSectorBullish(symbolKey, niftyQuotes) {
    try {
        const etfSymbol = SECTOR_ETFS[symbolKey];

        // If no sector ETF mapped, use Nifty as proxy
        if (!etfSymbol) {
            const niftyEMA5 = calculateEMA(niftyQuotes.map(q => q.close), 5);
            const bullish = niftyQuotes.at(-1).close > niftyEMA5.at(-1);
            return { bullish, label: bullish ? '🏭 NIFTY ✅' : '🏭 NIFTY ❌' };
        }

        const sectorData = await yf.chart(etfSymbol, {
            period1: Math.floor((Date.now() - 15 * 24 * 60 * 60 * 1000) / 1000),
            interval: "1d"
        });

        const sectorQuotes = sectorData.quotes.filter(q => q.close);
        if (sectorQuotes.length < 5) {
            return { bullish: true, label: '🏭 SECTOR N/A' };
        }

        const sectorEMA5 = calculateEMA(sectorQuotes.map(q => q.close), 5);
        const bullish = sectorQuotes.at(-1).close > sectorEMA5.at(-1);

        return {
            bullish,
            label: bullish ? `🏭 SECTOR ✅` : `🏭 SECTOR ❌`
        };
    } catch (err) {
        return { bullish: true, label: '🏭 SECTOR ERR' };
    }
}

// ================================================================
//  LEVEL 2 FILTER 6 — Earnings Quality
//  Stock that gapped up strongly on results = fundamental strength
//  Proxy: largest positive gap in last 90 days
// ================================================================
function checkEarningsQuality(quotes) {
    if (quotes.length < 5) {
        return { hadStrongEarnings: false, label: '💹 EARN N/A' };
    }

    let maxGap = 0;
    for (let i = 1; i < quotes.length; i++) {
        const gap = ((quotes[i].open - quotes[i - 1].close) / quotes[i - 1].close) * 100;
        if (gap > maxGap) maxGap = gap;
    }

    return {
        hadStrongEarnings: maxGap > 3,
        earningsGap: maxGap.toFixed(2),
        label: maxGap > 3
            ? `💹 EARN GAP +${maxGap.toFixed(1)}%`
            : `💹 NO EARN GAP`
    };
}

// ================================================================
//  BASIC FILTERS (your existing logic — unchanged)
// ================================================================
async function findBreakoutCandidates() {
    const results = [];

    for (const [symbolKey] of Object.entries(Bullish_SYMBOL_MAP)) {
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

            const last    = quotes[quotes.length - 1];
            const prev20  = quotes.slice(-21, -1);

            const high52w        = Math.max(...quotes.map(q => q.high));
            const nearHighPercent = ((high52w - last.close) / high52w) * 100;
            const avgVol20        = average(prev20.map(q => q.volume));
            const volumeSurge     = last.volume / avgVol20;
            const resistanceLevel = Math.max(...prev20.map(q => q.high));
            const nearResistance  = ((resistanceLevel - last.close) / resistanceLevel) * 100;
            const dayRange        = last.high - last.low;
            const closePosition   = dayRange > 0 ? (last.close - last.low) / dayRange : 0;
            const atr             = getHistoricalATR(quotes, quotes.length - 1, 14);
            const atrPercent      = (atr / last.close) * 100;

            const score = (
                (volumeSurge > 1.5 ? 2 : 0) +
                (nearResistance < 1.0 ? 2 : 0) +
                (closePosition > 0.7 ? 1 : 0) +
                (nearHighPercent < 3.0 ? 2 : 0) +
                (atrPercent > 1.5 ? 1 : 0)
            );

            if (score >= 4) {
                results.push({
                    symbol: symbolKey,
                    close: last.close,
                    volumeSurge: volumeSurge.toFixed(2),
                    nearResistance: nearResistance.toFixed(2),
                    nearHighPercent: nearHighPercent.toFixed(2),
                    closePosition: (closePosition * 100).toFixed(0),
                    score,
                    quotes  // pass quotes forward for Level 2 filters
                });
            }

        } catch (err) {
            console.log(`⚠️  ${symbolKey.padEnd(12)} | Skipped — ${err.message?.slice(0, 50) || 'Unknown error'}`);
            continue;
        }
    }

    return results.sort((a, b) => b.score - a.score);
}

async function getNewsStocks() {
    const res = await axios.get(
        'https://www.nseindia.com/api/corporate-announcements?index=equities',
        { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Referer': 'https://www.nseindia.com' } }
    );
    return res.data
        .filter(a => {
            const subject = a.desc?.toLowerCase() || '';
            return subject.includes('financial result') || subject.includes('board meeting') ||
                   subject.includes('acquisition') || subject.includes('order') ||
                   subject.includes('bagged') || subject.includes('bonus') || subject.includes('buyback');
        })
        .map(a => ({ symbol: a.symbol, subject: a.desc, date: a.an_dt }));
}

async function getFnOStocks() {
    const res = await axios.get(
        'https://www.nseindia.com/api/live-analysis-oi-spurts-underlyings',
        { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Referer': 'https://www.nseindia.com' } }
    );
    return res.data.data
        .filter(s => s.pChange > 0)
        .sort((a, b) => b.oiChange - a.oiChange)
        .slice(0, 10)
        .map(s => ({ symbol: s.symbol, price: s.lastPrice, oiChange: s.oiChange, priceChange: s.pChange }));
}

// ================================================================
//  MAIN — Professional Grade Pre-Market Watchlist
// ================================================================
async function generatePreMarketWatchlist() {
    console.log("⏰ Professional Pre-Market Scan Starting...\n");

    // ── STEP 1: Fetch all data in parallel ───────────────────────
    const [breakouts, newsStocks, fnoStocks, fiiData, niftyDataRaw] = await Promise.allSettled([
        findBreakoutCandidates(),
        getNewsStocks(),
        getFnOStocks(),
        getFIIDIIData(),
        yf.chart("^NSEI", {
            period1: Math.floor((Date.now() - 60 * 24 * 60 * 60 * 1000) / 1000),
            interval: "1d"
        })
    ]);

    const breakoutList = breakouts.status  === 'fulfilled' ? breakouts.value  : [];
    const newsList     = newsStocks.status === 'fulfilled' ? newsStocks.value : [];
    const fnoList      = fnoStocks.status  === 'fulfilled' ? fnoStocks.value  : [];
    const fii          = fiiData.status    === 'fulfilled' ? fiiData.value    : { isFIIBullish: false, label: '🏦 FII N/A' };
    const niftyQuotes  = niftyDataRaw.status === 'fulfilled'
        ? niftyDataRaw.value.quotes.filter(q => q.close)
        : [];

    if (newsStocks.status === 'rejected') console.log(`⚠️  NSE News API failed — ${newsStocks.reason?.message}`);
    if (fnoStocks.status  === 'rejected') console.log(`⚠️  NSE F&O API failed  — ${fnoStocks.reason?.message}`);

    // ── STEP 2: Market-level context ─────────────────────────────
    console.log(`\n📊 MARKET CONTEXT`);
    console.log("─".repeat(50));
    console.log(`  ${fii.label}`);
    console.log(`  ${fii.isFIIBullish ? '✅ FII BULLISH — High confidence day' : '⚠️  FII NOT BULLISH — Trade smaller size'}`);
    console.log("─".repeat(50) + "\n");

    const newsSymbols = new Set(newsList.map(n => n.symbol));
    const fnoSymbols  = new Set(fnoList.map(f => f.symbol));

    // ── STEP 3: Apply Level 2 professional filters per stock ──────
    const enrichedList = [];

    for (const stock of breakoutList) {
        try {
            // Run all Level 2 filters in parallel per stock
            const [mtf, sector] = await Promise.all([
                checkMTFAlignment(stock.symbol),
                isSectorBullish(stock.symbol, niftyQuotes)
            ]);

            const rs       = calculateRelativeStrength(stock.quotes, niftyQuotes, 20);
            const base     = checkConsolidationQuality(stock.quotes);
            const earnings = checkEarningsQuality(stock.quotes);

            // ── PROFESSIONAL SCORE ────────────────────────────────
            // Each Level 2 filter adds bonus points
            const professionalScore = (
                (rs.isLeader         ? 2 : 0) +   // Outperforming Nifty
                (mtf.aligned         ? 2 : 0) +   // Weekly + Daily aligned
                (base.isHighQuality  ? 2 : 0) +   // Tight base
                (base.isMediumQuality && !base.isHighQuality ? 1 : 0) + // Medium base
                (sector.bullish      ? 1 : 0) +   // Sector tailwind
                (earnings.hadStrongEarnings ? 1 : 0) + // Fundamental catalyst
                (fii.isFIIBullish    ? 1 : 0)    // Market tailwind
            );
            // ─────────────────────────────────────────────────────

            // ── PROFESSIONAL GATE ─────────────────────────────────
            // Must pass at least 3 out of 4 key checks to qualify
            const keyChecks = [rs.isLeader, mtf.aligned, base.isMediumQuality, sector.bullish];
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
                // Filter labels for display
                filters: { rs, mtf, base, sector, earnings }
            });

        } catch (err) {
            // If Level 2 fails for a stock, still include with basic score
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

    // TIER 1: Passed professional gate (highest conviction)
    const tier1 = sorted.filter(s => s.passedProfessionalGate).slice(0, 8);
    // TIER 2: Didn't pass gate but still technically strong
    const tier2 = sorted.filter(s => !s.passedProfessionalGate).slice(0, 5);

    // ── STEP 5: Display ──────────────────────────────────────────
    console.log("🏆 TIER 1 — HIGH CONVICTION (3+ Professional Checks Passed)");
    console.log("=".repeat(70));

    if (tier1.length === 0) {
        console.log("  No high conviction setups today. Consider sitting out.");
    }

    tier1.forEach((s, i) => {
        const sources = [];
        if (s.score >= 4)  sources.push("📈 BREAKOUT");
        if (s.inNews)      sources.push("📰 NEWS");
        if (s.inFnO)       sources.push("💰 F&O");
        const sourceLabel = sources.join(" + ");

        console.log(
            `\n${String(i+1).padStart(2)}. ${s.symbol.padEnd(12)} | ₹${s.close} | Final Score: ${s.finalScore} | [${sourceLabel}]`
        );
        console.log(`    ├─ Basic    : Vol ${s.volumeSurge}x | Res ${s.nearResistance}% away ${s.nearHighPercent < 3 ? '| 🏔️ 52WH' : ''}`);
        if (s.filters.rs)       console.log(`    ├─ ${s.filters.rs.label}`);
        if (s.filters.mtf)      console.log(`    ├─ ${s.filters.mtf.label}`);
        if (s.filters.base)     console.log(`    ├─ ${s.filters.base.label}`);
        if (s.filters.sector)   console.log(`    ├─ ${s.filters.sector.label}`);
        if (s.filters.earnings) console.log(`    └─ ${s.filters.earnings.label}`);
    });

    console.log("\n⚡ TIER 2 — WATCHLIST ONLY (Monitor but trade cautiously)");
    console.log("=".repeat(70));

    tier2.forEach((s, i) => {
        const sources = [];
        if (s.score >= 4) sources.push("📈 BREAKOUT");
        if (s.inNews)     sources.push("📰 NEWS");
        if (s.inFnO)      sources.push("💰 F&O");

        console.log(
            `  ${String(i+1).padStart(2)}. ${s.symbol.padEnd(12)} | ₹${s.close} | Score: ${s.finalScore} | [${sources.join(" + ")}] | Checks: ${s.keyChecksPassed}/4`
        );
    });

    console.log("\n" + "=".repeat(70));
    console.log(`📋 SUMMARY: ${tier1.length} high conviction | ${tier2.length} on watchlist | ${fii.label}`);
    console.log("=".repeat(70) + "\n");
}

await generatePreMarketWatchlist();