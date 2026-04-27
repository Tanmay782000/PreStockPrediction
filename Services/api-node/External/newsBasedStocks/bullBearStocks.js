import axios from "axios";
import yahooFinance from "yahoo-finance2";

const yf = new yahooFinance();

const average = (arr) => arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

// ================================================================
//  SECTOR DEFINITIONS
//  Each sector has:
//  - Benchmark ETF/Index for technical strength
//  - Constituent stocks (bullish + bearish candidates)
// ================================================================
const SECTORS = {
    BANKING: {
        name: "Banking & Finance",
        benchmark: "^NSEBANK",
        bullishStocks: ["HDFCBANK", "ICICIBANK", "SBIN", "AXISBANK", "KOTAKBANK", "INDUSINDBK"],
        bearishStocks: ["BANKBARODA", "PNB", "CANBK", "UNIONBANK", "IDFCFIRSTB"],
        newsKeywords: ["bank", "rbi", "lending", "credit", "npa", "loan", "deposit", "interest rate"]
    },
    IT: {
        name: "Information Technology",
        benchmark: "^CNXIT",
        bullishStocks: ["INFY", "TCS", "HCLTECH", "WIPRO", "TECHM"],
        bearishStocks: ["MPHASIS", "LTIM", "PERSISTENT", "COFORGE", "KPITTECH"],
        newsKeywords: ["it sector", "software", "digital", "ai", "tech", "outsourcing", "deal win", "revenue"]
    },
    PHARMA: {
        name: "Pharmaceuticals",
        benchmark: "^CNXPHARMA",
        bullishStocks: ["SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "APOLLOHOSP"],
        bearishStocks: ["BIOCON", "ALKEM", "TORNTPHARM", "IPCALAB"],
        newsKeywords: ["pharma", "drug", "fda", "usfda", "approval", "recall", "medicine", "hospital"]
    },
    AUTO: {
        name: "Automobile",
        benchmark: "^CNXAUTO",
        bullishStocks: ["MARUTI", "TATAMOTORS", "M&M", "BAJAJ-AUTO", "EICHERMOT"],
        bearishStocks: ["HEROMOTOCO", "TVSMOTORS", "ASHOKLEY", "TVSMOTOR"],
        newsKeywords: ["auto", "vehicle", "ev", "electric vehicle", "sales", "production", "automobile"]
    },
    METALS: {
        name: "Metals & Mining",
        benchmark: "^CNXMETAL",
        bullishStocks: ["TATASTEEL", "HINDALCO", "JSWSTEEL", "COALINDIA", "VEDL"],
        bearishStocks: ["SAIL", "NMDC", "NATIONALUM", "HINDCOPPER"],
        newsKeywords: ["metal", "steel", "aluminium", "copper", "mining", "commodity", "iron ore"]
    },
    FMCG: {
        name: "FMCG & Consumer",
        benchmark: "^CNXFMCG",
        bullishStocks: ["HINDUNILVR", "NESTLEIND", "BRITANNIA", "DABUR", "MARICO"],
        bearishStocks: ["GODREJCP", "EMAMILTD", "COLPAL", "VBL"],
        newsKeywords: ["fmcg", "consumer", "rural", "urban", "demand", "inflation", "food", "beverage"]
    },
    ENERGY: {
        name: "Energy & Oil",
        benchmark: "^CNXENERGY",
        bullishStocks: ["RELIANCE", "ONGC", "NTPC", "POWERGRID", "BPCL"],
        bearishStocks: ["IOC", "GAIL", "PETRONET", "MGL"],
        newsKeywords: ["oil", "crude", "energy", "power", "gas", "opec", "refinery", "fuel"]
    },
    REALTY: {
        name: "Real Estate",
        benchmark: "^CNXREALTY",
        bullishStocks: ["DLF", "GODREJPROP", "PRESTIGE", "OBEROI", "BRIGADE"],
        bearishStocks: ["PHOENIXLTD", "SOBHA", "MAHLIFE"],
        newsKeywords: ["realty", "real estate", "housing", "property", "construction", "reit", "home loan"]
    }
};

// ================================================================
//  TECHNICAL SECTOR STRENGTH
//  Measures each sector's technical condition:
//  - Price vs EMA20 (short term trend)
//  - Price vs EMA50 (medium term trend)
//  - RS vs Nifty (relative performance)
//  - Momentum (5-day return)
// ================================================================
function calculateEMA(prices, period) {
    if (prices.length < period) return [];
    const k = 2 / (period + 1);
    let ema = [prices[0]];
    for (let i = 1; i < prices.length; i++) {
        ema.push(prices[i] * k + ema[i - 1] * (1 - k));
    }
    return ema;
}

async function getSectorTechnicalStrength(sectorKey, niftyQuotes) {
    const sector = SECTORS[sectorKey];
    try {
        const benchmarkData = await yf.chart(sector.benchmark, {
            period1: Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000),
            interval: "1d"
        });

        const quotes = benchmarkData.quotes.filter(q => q.close);
        if (quotes.length < 50) {
            return { strength: 0, direction: "UNKNOWN", label: "⚪ NO DATA" };
        }

        const closes     = quotes.map(q => q.close);
        const ema20      = calculateEMA(closes, 20);
        const ema50      = calculateEMA(closes, 50);
        const lastClose  = closes.at(-1);
        const lastEMA20  = ema20.at(-1);
        const lastEMA50  = ema50.at(-1);

        // 5-day momentum
        const momentum5d = ((lastClose - closes.at(-6)) / closes.at(-6)) * 100;

        // 20-day momentum
        const momentum20d = ((lastClose - closes.at(-21)) / closes.at(-21)) * 100;

        // RS vs Nifty (20 days)
        const sectorReturn = (lastClose - closes.at(-20)) / closes.at(-20);
        const niftyReturn  = niftyQuotes.length >= 20
            ? (niftyQuotes.at(-1).close - niftyQuotes.at(-20).close) / niftyQuotes.at(-20).close
            : 0;
        const rs = ((sectorReturn - niftyReturn) * 100).toFixed(2);

        // Volume trend (last 5 days vs 20-day avg)
        const volumes    = quotes.map(q => q.volume).filter(Boolean);
        const avgVol20   = average(volumes.slice(-20));
        const avgVol5    = average(volumes.slice(-5));
        const volumeTrend = avgVol5 > avgVol20 * 1.2 ? "RISING" : "NORMAL";

        // ── SCORING ───────────────────────────────────────────────
        let score = 0;
        let bullishPoints = 0;
        let bearishPoints = 0;

        // Price vs EMAs
        if (lastClose > lastEMA20) bullishPoints += 2; else bearishPoints += 2;
        if (lastClose > lastEMA50) bullishPoints += 2; else bearishPoints += 2;
        if (lastEMA20 > lastEMA50) bullishPoints += 1; else bearishPoints += 1;

        // Momentum
        if (momentum5d > 1.0)  bullishPoints += 2;
        if (momentum5d < -1.0) bearishPoints += 2;
        if (momentum20d > 3.0) bullishPoints += 1;
        if (momentum20d < -3.0)bearishPoints += 1;

        // RS vs Nifty
        if (parseFloat(rs) > 2)  bullishPoints += 2;
        if (parseFloat(rs) < -2) bearishPoints += 2;

        // Volume
        if (volumeTrend === "RISING") bullishPoints += 1;

        // Direction
        const direction = bullishPoints > bearishPoints ? "BULLISH"
                        : bearishPoints > bullishPoints ? "BEARISH"
                        : "NEUTRAL";

        const strength = direction === "BULLISH" ? bullishPoints
                       : direction === "BEARISH" ? bearishPoints
                       : 0;

        const label = direction === "BULLISH"
            ? `🟢 BULLISH (${bullishPoints}pts) | RS: +${rs}% | Mom: +${momentum5d.toFixed(1)}%`
            : direction === "BEARISH"
            ? `🔴 BEARISH (${bearishPoints}pts) | RS: ${rs}% | Mom: ${momentum5d.toFixed(1)}%`
            : `⚪ NEUTRAL | RS: ${rs}% | Mom: ${momentum5d.toFixed(1)}%`;

        return {
            direction,
            strength,
            bullishPoints,
            bearishPoints,
            rs: parseFloat(rs),
            momentum5d: parseFloat(momentum5d.toFixed(2)),
            momentum20d: parseFloat(momentum20d.toFixed(2)),
            volumeTrend,
            aboveEMA20: lastClose > lastEMA20,
            aboveEMA50: lastClose > lastEMA50,
            label
        };

    } catch (err) {
        return {
            direction: "UNKNOWN",
            strength: 0,
            label: `⚪ ERR — ${err.message?.slice(0, 30)}`
        };
    }
}

// ================================================================
//  NEWS SECTOR SCANNER
//  Fetches NSE announcements and maps them to sectors
//  Identifies which sectors have positive/negative news flow
// ================================================================
async function getSectorNewsFlow() {
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

        const announcements = res.data || [];

        // ── POSITIVE NEWS KEYWORDS ────────────────────────────────
        const positiveKeywords = [
            'order', 'bagged', 'win', 'contract', 'approval',
            'profit', 'result', 'revenue', 'acquisition', 'buyback',
            'bonus', 'dividend', 'expansion', 'launch', 'deal'
        ];

        // ── NEGATIVE NEWS KEYWORDS ────────────────────────────────
        const negativeKeywords = [
            'loss', 'penalty', 'fraud', 'recall', 'default',
            'downgrade', 'resignation', 'litigation', 'fine',
            'insolvency', 'below', 'warning', 'cut', 'reduce'
        ];

        // Map news to sectors
        const sectorNews = {};
        Object.keys(SECTORS).forEach(key => {
            sectorNews[key] = { positive: [], negative: [], neutral: [] };
        });

        announcements.forEach(a => {
            const desc    = (a.desc || '').toLowerCase();
            const symbol  = a.symbol || '';

            // Find which sector this stock belongs to
            Object.entries(SECTORS).forEach(([sectorKey, sector]) => {
                const allStocks = [
                    ...sector.bullishStocks,
                    ...sector.bearishStocks
                ];

                const belongsToSector = allStocks.includes(symbol) ||
                    sector.newsKeywords.some(kw => desc.includes(kw));

                if (!belongsToSector) return;

                const isPositive = positiveKeywords.some(kw => desc.includes(kw));
                const isNegative = negativeKeywords.some(kw => desc.includes(kw));

                const newsItem = {
                    symbol,
                    desc: a.desc?.slice(0, 80),
                    date: a.an_dt
                };

                if (isPositive && !isNegative) {
                    sectorNews[sectorKey].positive.push(newsItem);
                } else if (isNegative && !isPositive) {
                    sectorNews[sectorKey].negative.push(newsItem);
                } else {
                    sectorNews[sectorKey].neutral.push(newsItem);
                }
            });
        });

        return sectorNews;

    } catch (err) {
        console.log(`⚠️  NSE News API failed — ${err.message?.slice(0, 50)}`);
        return {};
    }
}

// ================================================================
//  STOCK LEVEL TECHNICAL SCAN
//  For each sector's stocks, check individual technical strength
// ================================================================
async function scanSectorStocks(stocks, direction) {
    const results = [];

    for (const symbol of stocks) {
        try {
            const data = await yf.chart(`${symbol}.NS`, {
                period1: Math.floor((Date.now() - 60 * 24 * 60 * 60 * 1000) / 1000),
                interval: "1d"
            });

            const quotes = data.quotes.filter(q => q.close);
            if (quotes.length < 20) continue;

            // Delisted check
            const lastDate = new Date(quotes.at(-1).date);
            const daysSince = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince > 10) continue;

            const last   = quotes.at(-1);
            const prev20 = quotes.slice(-21, -1);

            const avgVol20    = average(prev20.map(q => q.volume));
            const volumeSurge = last.volume / avgVol20;
            const closes      = quotes.map(q => q.close);
            const ema20       = calculateEMA(closes, 20);
            const aboveEMA20  = last.close > ema20.at(-1);

            const dayRange      = last.high - last.low;
            const closePosition = dayRange > 0 ? (last.close - last.low) / dayRange : 0;

            // 52w levels
            const high52w       = Math.max(...quotes.map(q => q.high));
            const low52w        = Math.min(...quotes.map(q => q.low));
            const nearHighPct   = ((high52w - last.close) / high52w) * 100;
            const nearLowPct    = ((last.close - low52w) / low52w) * 100;

            // Score differently for bullish vs bearish
            let score = 0;
            if (direction === "BULLISH") {
                score = (
                    (volumeSurge > 1.5 ? 2 : 0) +
                    (aboveEMA20 ? 2 : 0) +
                    (nearHighPct < 3.0 ? 2 : 0) +
                    (closePosition > 0.7 ? 1 : 0) +
                    (last.close > last.open ? 1 : 0)
                );
            } else {
                score = (
                    (volumeSurge > 1.5 ? 2 : 0) +
                    (!aboveEMA20 ? 2 : 0) +
                    (nearLowPct < 3.0 ? 2 : 0) +
                    (closePosition < 0.3 ? 1 : 0) +
                    (last.close < last.open ? 1 : 0)
                );
            }

            if (score >= 3) {
                results.push({
                    symbol,
                    close: last.close,
                    volumeSurge: volumeSurge.toFixed(2),
                    aboveEMA20,
                    nearHighPct: nearHighPct.toFixed(2),
                    nearLowPct: nearLowPct.toFixed(2),
                    closePosition: (closePosition * 100).toFixed(0),
                    score
                });
            }

        } catch (err) {
            continue;
        }
    }

    return results.sort((a, b) => b.score - a.score);
}

// ================================================================
//  MAIN — Sector Strength Report
// ================================================================
async function generateSectorReport() {
    console.log("🔭 SECTOR STRENGTH + NEWS SCAN");
    console.log("=".repeat(70));
    console.log(`⏰ Generated at: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}\n`);

    // Fetch Nifty for RS calculation
    let niftyQuotes = [];
    try {
        const niftyData = await yf.chart("^NSEI", {
            period1: Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000),
            interval: "1d"
        });
        niftyQuotes = niftyData.quotes.filter(q => q.close);
    } catch (err) {
        console.log("⚠️  Nifty data failed");
    }

    // Fetch news flow
    console.log("📰 Fetching sector news flow...");
    const sectorNews = await getSectorNewsFlow();

    // Scan all sectors
    console.log("📊 Scanning sector technicals...\n");

    const sectorResults = [];

    for (const [sectorKey, sector] of Object.entries(SECTORS)) {
        try {
            const technical = await getSectorTechnicalStrength(sectorKey, niftyQuotes);
            const news      = sectorNews[sectorKey] || { positive: [], negative: [], neutral: [] };

            // ── SECTOR CONFLUENCE SCORE ───────────────────────────
            const newsSentiment = news.positive.length - news.negative.length;
            const newsScore     = newsSentiment > 2  ?  3
                                : newsSentiment > 0  ?  1
                                : newsSentiment < -2 ? -3
                                : newsSentiment < 0  ? -1
                                : 0;

            const confluenceScore = technical.strength + newsScore;

            sectorResults.push({
                sectorKey,
                sectorName: sector.name,
                technical,
                news,
                newsScore,
                confluenceScore,
                direction: technical.direction
            });

        } catch (err) {
            continue;
        }
    }

    // Sort by confluence score
    sectorResults.sort((a, b) => b.confluenceScore - a.confluenceScore);

    // ── BULLISH SECTORS ───────────────────────────────────────────
    const bullishSectors = sectorResults.filter(s => s.direction === "BULLISH");
    const bearishSectors = sectorResults.filter(s => s.direction === "BEARISH");
    const neutralSectors = sectorResults.filter(s => s.direction === "NEUTRAL" || s.direction === "UNKNOWN");

    console.log("🟢 BULLISH SECTORS — BUY CANDIDATES");
    console.log("=".repeat(70));

    for (const s of bullishSectors) {
        const news = s.news;
        console.log(`\n📌 ${s.sectorName}`);
        console.log(`   Technical : ${s.technical.label}`);
        console.log(`   News Flow : ✅ ${news.positive.length} positive | ❌ ${news.negative.length} negative`);
        console.log(`   Confluence: ${s.confluenceScore} pts`);

        // Show top positive news
        if (news.positive.length > 0) {
            news.positive.slice(0, 2).forEach(n => {
                console.log(`   📰 ${n.symbol}: ${n.desc}`);
            });
        }

        // Scan individual stocks if sector is strong
        if (s.confluenceScore >= 5) {
            console.log(`   🔍 Scanning stocks...`);
            const stocks = await scanSectorStocks(
                SECTORS[s.sectorKey].bullishStocks,
                "BULLISH"
            );
            if (stocks.length > 0) {
                console.log(`   📈 TOP PICKS:`);
                stocks.slice(0, 3).forEach(st => {
                    console.log(
                        `      ✅ ${st.symbol.padEnd(14)} | ₹${st.close} | ` +
                        `Vol: ${st.volumeSurge}x | ` +
                        `52WH: ${st.nearHighPct}% away | ` +
                        `Score: ${st.score}/8`
                    );
                });
            } else {
                console.log(`   ⚠️  No strong individual setups found`);
            }
        }
    }

    // ── BEARISH SECTORS ───────────────────────────────────────────
    console.log("\n\n🔴 BEARISH SECTORS — SELL CANDIDATES");
    console.log("=".repeat(70));

    for (const s of bearishSectors) {
        const news = s.news;
        console.log(`\n📌 ${s.sectorName}`);
        console.log(`   Technical : ${s.technical.label}`);
        console.log(`   News Flow : ✅ ${news.positive.length} positive | ❌ ${news.negative.length} negative`);
        console.log(`   Confluence: ${s.confluenceScore} pts`);

        // Show top negative news
        if (news.negative.length > 0) {
            news.negative.slice(0, 2).forEach(n => {
                console.log(`   📰 ${n.symbol}: ${n.desc}`);
            });
        }

        // Scan individual stocks if sector is weak
        if (s.confluenceScore >= 4) {
            console.log(`   🔍 Scanning stocks...`);
            const stocks = await scanSectorStocks(
                SECTORS[s.sectorKey].bearishStocks,
                "BEARISH"
            );
            if (stocks.length > 0) {
                console.log(`   📉 TOP PICKS:`);
                stocks.slice(0, 3).forEach(st => {
                    console.log(
                        `      ❌ ${st.symbol.padEnd(14)} | ₹${st.close} | ` +
                        `Vol: ${st.volumeSurge}x | ` +
                        `52WL: ${st.nearLowPct}% away | ` +
                        `Score: ${st.score}/8`
                    );
                });
            } else {
                console.log(`   ⚠️  No strong individual setups found`);
            }
        }
    }

    // ── NEUTRAL SECTORS ───────────────────────────────────────────
    if (neutralSectors.length > 0) {
        console.log("\n\n⚪ NEUTRAL SECTORS — AVOID TODAY");
        console.log("=".repeat(70));
        neutralSectors.forEach(s => {
            console.log(`  ${s.sectorName.padEnd(25)} | ${s.technical.label}`);
        });
    }

    // ── FINAL SUMMARY ─────────────────────────────────────────────
    console.log("\n\n📋 SECTOR SUMMARY");
    console.log("=".repeat(70));
    sectorResults.forEach((s, i) => {
        const arrow = s.direction === "BULLISH" ? "🟢"
                    : s.direction === "BEARISH" ? "🔴"
                    : "⚪";
        console.log(
            `${String(i+1).padStart(2)}. ${arrow} ${s.sectorName.padEnd(25)} | ` +
            `Score: ${s.confluenceScore.toString().padStart(3)} | ` +
            `News: +${s.news.positive.length}/-${s.news.negative.length} | ` +
            `RS: ${s.technical.rs > 0 ? '+' : ''}${s.technical.rs}%`
        );
    });

    console.log("\n" + "=".repeat(70));
    console.log(`🟢 Bullish sectors: ${bullishSectors.length}`);
    console.log(`🔴 Bearish sectors: ${bearishSectors.length}`);
    console.log(`⚪ Neutral sectors: ${neutralSectors.length}`);
    console.log("=".repeat(70));
    console.log("\n💡 HOW TO USE:");
    console.log("   1. Pick stocks from BULLISH sectors for BUY signals");
    console.log("   2. Pick stocks from BEARISH sectors for SELL signals");
    console.log("   3. Avoid NEUTRAL sectors — no clear direction");
    console.log("   4. Highest confluence score = highest conviction");
    console.log("   5. Add selected stocks to your Bullish/Bearish_SYMBOL_MAP");
    console.log("=".repeat(70) + "\n");
}

// Run at 8:30 AM IST every morning
await generateSectorReport();