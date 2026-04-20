import yahooFinance from "yahoo-finance2";
import { Bearish_SYMBOL_MAP } from '../../Common/stockInfo.js';

const yf = new yahooFinance();

const ATR_PERIOD = 20;

// TIMEFRAME CONSTANTS
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;
const SIXTY_DAYS_MS = 59 * 24 * 60 * 60 * 1000; 
const START_DATE_DAILY = Math.floor((Date.now() - TWO_YEARS_MS) / 1000);
const START_DATE_15M = Math.floor((Date.now() - SIXTY_DAYS_MS) / 1000);

const average = (arr) => arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

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

async function backtestBearishStrategy() {
    console.log("🚀 Initializing Bearish Sniper Backtest...");
    
    // FIX: Converting Object to Entries for iteration
    const stockEntries = Object.entries(Bearish_SYMBOL_MAP);
    console.log(`📉 Mode: SHORTING (Sell High, Buy Low) | ${stockEntries.length} Stocks\n`);

    let totalWins = 0, totalLosses = 0, totalTrades = 0;

    // 1. FETCH NIFTY DATA
    let allNiftyQuotes = [], allNiftyDaily = [];
    try {
        const niftyHistory = await yf.chart("^NSEI", { period1: START_DATE_15M, interval: "15m" });
        const niftyDailyHistory = await yf.chart("^NSEI", { period1: START_DATE_DAILY, interval: "1d" });
        
        allNiftyQuotes = niftyHistory.quotes.filter(q => q.close);
        allNiftyDaily = niftyDailyHistory.quotes.filter(q => q.close);
    } catch (e) {
        console.error("❌ Critical: Nifty data sync failed."); return;
    }

    // 2. ITERATE THROUGH STOCKS
    for (const [symbolKey, stockData] of stockEntries) {
        const symbol = `${symbolKey}.NS`; // Ensure Yahoo suffix
        try {
            const stockHistory = await yf.chart(symbol, { period1: START_DATE_15M, interval: "15m" });
            const dailyHistory = await yf.chart(symbol, { period1: START_DATE_DAILY, interval: "1d" });

            const allStockQuotes = stockHistory.quotes.filter(q => q.close && q.volume);
            const allDailyQuotes = dailyHistory.quotes.filter(q => q.close);

            if (allStockQuotes.length === 0) continue;

            // Map intraday data into days
            const daysMap = {};
            allStockQuotes.forEach(q => {
                const dateStr = q.date.toISOString().split('T')[0];
                if (!daysMap[dateStr]) daysMap[dateStr] = [];
                daysMap[dateStr].push(q);
            });

            let stats = { wins: 0, losses: 0 };
            const dateKeys = Object.keys(daysMap).sort();

            for (const todayStr of dateKeys) {
                const todayStockQuotes = daysMap[todayStr];
                const todayNiftyQuotes = allNiftyQuotes.filter(nq => nq.date.toISOString().startsWith(todayStr));
                
                if (todayStockQuotes.length < 5 || todayNiftyQuotes.length < 3) continue;

                // Sync Yesterday's Context
                const nDailyIdx = allNiftyDaily.findIndex(nd => nd.date.toISOString().startsWith(todayStr));
                const yesterdayNiftyClose = nDailyIdx > 0 ? allNiftyDaily[nDailyIdx - 1].close : 0;

                const dailyIdx = allDailyQuotes.findIndex(dq => dq.date.toISOString().startsWith(todayStr));
                if (dailyIdx <= 0) continue;
                const yesterdayStockClose = allDailyQuotes[dailyIdx - 1].close;

                // --- SHORT STRATEGY EXECUTION ---
                // Gap Down Protection (Avoid chasing if it already crashed > 3% at open)
                const gapPercent = ((todayStockQuotes[0].open - yesterdayStockClose) / yesterdayStockClose) * 100;
                if (gapPercent < -5.0) continue;

                const morningLow = Math.min(todayStockQuotes[0].low, todayStockQuotes[1].low);
                const avgMorningVol = (todayStockQuotes[0].volume + todayStockQuotes[1].volume) / 2;

                let sVwapSumPV = 0, sVwapSumV = 0;
                let nVwapSumPV = 0, nVwapSumV = 0;

                for (let i = 0; i < todayStockQuotes.length; i++) {
                    const candle = todayStockQuotes[i];
                    sVwapSumPV += (candle.close * candle.volume);
                    sVwapSumV += candle.volume;
                    const stockVWAP = sVwapSumPV / sVwapSumV;

                    const nCandle = todayNiftyQuotes[i];
                    if (nCandle) {
                        nVwapSumPV += (nCandle.close * (nCandle.volume || 1));
                        nVwapSumV += (nCandle.volume || 1);
                    }
                    const niftyVWAP = nVwapSumPV / nVwapSumV;

                    // BEARISH NIFTY GUARD
                    const niftyBearish = (nCandle?.close < yesterdayNiftyClose) && 
                                       (nCandle?.close < (niftyVWAP * 1.0002) || 
                                       (Math.abs(nCandle?.close - nCandle?.open) / (nCandle?.high - nCandle?.low)) > 0.3);

                    if (i < 2 || !niftyBearish) continue;

                    // Breakdown Logic
                    const isBreakdown = candle.close < morningLow && candle.close < stockVWAP;
                    const isLosingValue = candle.close < stockVWAP && todayStockQuotes[i - 1].close > stockVWAP;
                    const isStrongRed = candle.close < candle.open && (Math.abs(candle.close - candle.open) / (candle.high - candle.low)) > 0.5;

                    if (candle.volume > avgMorningVol * 1.1 && isStrongRed && (isBreakdown || isLosingValue)) {
                        const globalIdx = allStockQuotes.findIndex(q => q.date === candle.date);
                        const atr = getHistoricalATR(allStockQuotes, globalIdx, ATR_PERIOD);
                        
                        const entry = candle.close;
                        // FLIPPED MATH for Shorting: Target is BELOW, Stop Loss is ABOVE
                        const target = entry - (atr * 5.0); 
                        const stopLoss = entry + (atr * 2.5);

                        let outcome = null;
                        for (let j = i + 1; j < todayStockQuotes.length; j++) {
                            if (todayStockQuotes[j].high >= stopLoss) { outcome = "LOSS"; break; }
                            if (todayStockQuotes[j].low <= target) { outcome = "WIN"; break; }
                        }

                        if (!outcome) {
                            outcome = todayStockQuotes[todayStockQuotes.length - 1].close < entry ? "WIN" : "LOSS";
                        }

                        if (outcome === "WIN") stats.wins++; else stats.losses++;
                        break; 
                    }
                }
            }
            
            totalWins += stats.wins;
            totalLosses += stats.losses;
            totalTrades += (stats.wins + stats.losses);

            const currentTotal = stats.wins + stats.losses;
            const currentWR = currentTotal > 0 ? ((stats.wins / currentTotal) * 100).toFixed(2) : 0;
            console.log(`📊 ${symbolKey.padEnd(12)} | Trades: ${currentTotal} | Wins: ${stats.wins} | WR: ${currentWR}%`);

        } catch (err) { continue; }
    }

    console.log("\n" + "=".repeat(80));
    console.log(`🏆 BEARISH SNIPER BACKTEST COMPLETE`);
    console.log(`📈 Total Trades: ${totalTrades} | Win Rate: ${((totalWins/totalTrades)*100).toFixed(2)}%`);
    console.log("=".repeat(80) + "\n");
}

backtestBearishStrategy();