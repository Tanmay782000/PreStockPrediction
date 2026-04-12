import yahooFinance from "yahoo-finance2";
import { Barish_STOCKS } from "../Common/stockInfo.js";

const yf = new yahooFinance();

// ---------------- SETTINGS ----------------
// Keep the same sectors - they often fall the hardest during market corrections
const BACKTEST_STOCKS = Barish_STOCKS.filter(s => s.sector == "Energy" || s.sector == "Materials" || s.sector == "Industrials" || s.sector == "Utilities").map(s => s.symbol);

const NIFTY_SYMBOL = "^NSEI";
const ATR_PERIOD = 20;

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
    console.log("🚀 Initializing Bearish Hybrid Backtest...");
    console.log(`📉 Mode: SHORTING (Sell High, Buy Low) | ${BACKTEST_STOCKS.length} Stocks\n`);

    let totalWins = 0, totalLosses = 0, totalTrades = 0;

    let allNiftyQuotes = [], allNiftyDaily = [];
    try {
        const niftyHistory = await yf.chart(NIFTY_SYMBOL, { period1: START_DATE_15M, interval: "15m" });
        const niftyDailyHistory = await yf.chart(NIFTY_SYMBOL, { period1: START_DATE_DAILY, interval: "1d" });
        allNiftyQuotes = niftyHistory.quotes.filter(q => q.close);
        allNiftyDaily = niftyDailyHistory.quotes.filter(q => q.close);
    } catch (e) {
        console.error("❌ Critical: Nifty data sync failed."); return;
    }

    for (const symbol of BACKTEST_STOCKS) {
        try {
            const stockHistory = await yf.chart(symbol, { period1: START_DATE_15M, interval: "15m" });
            const dailyHistory = await yf.chart(symbol, { period1: START_DATE_DAILY, interval: "1d" });

            const allStockQuotes = stockHistory.quotes.filter(q => q.close && q.volume);
            const allDailyQuotes = dailyHistory.quotes.filter(q => q.close);

            if (allStockQuotes.length === 0) continue;

            const daysMap = {};
            allStockQuotes.forEach(q => {
                const dateStr = q.date.toISOString().split('T')[0];
                if (!daysMap[dateStr]) daysMap[dateStr] = [];
                daysMap[dateStr].push(q);
            });

            let stats = { wins: 0, losses: 0 };
            const dateKeys = Object.keys(daysMap);

            for (const todayStr of dateKeys) {
                const todayStockQuotes = daysMap[todayStr];
                if (todayStockQuotes.length < 5) continue;

                const todayNiftyQuotes = allNiftyQuotes.filter(nq => nq.date.toISOString().startsWith(todayStr));
                if (todayNiftyQuotes.length < 3) continue;

                const nDailyIdx = allNiftyDaily.findIndex(nd => nd.date.toISOString().startsWith(todayStr));
                const yesterdayNiftyClose = nDailyIdx > 0 ? allNiftyDaily[nDailyIdx - 1].close : 0;

                const dailyIdx = allDailyQuotes.findIndex(dq => dq.date.toISOString().startsWith(todayStr));
                if (dailyIdx <= 0) continue;
                const yesterdayStockClose = allDailyQuotes[dailyIdx - 1].close;

                // --- BEARISH STRATEGY EXECUTION ---
                
                // 1. Gap Down Protection (Don't short if it already fell too much at open)
                const gapPercent = ((todayStockQuotes[0].open - yesterdayStockClose) / yesterdayStockClose) * 100;
                if (gapPercent < -3.0) continue; 

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

                    // BEARISH NIFTY GUARD: Price below Yesterday AND (Below VWAP OR Strong Red Body)
                    const niftyBearish = (nCandle?.close < yesterdayNiftyClose) && 
                                       (nCandle?.close < (niftyVWAP * 1.0002) || 
                                       (Math.abs(nCandle?.close - nCandle?.open) / (nCandle?.high - nCandle?.low)) > 0.3);

                    if (i < 2 || !niftyBearish) continue;

                    // STOCK BEARISH CONDITIONS
                    const isBreakdown = candle.close < morningLow && candle.close < stockVWAP;
                    const isLosingValue = candle.close < stockVWAP && todayStockQuotes[i - 1].close > stockVWAP;
                    const isStrongRed = candle.close < candle.open && (Math.abs(candle.close - candle.open) / (candle.high - candle.low)) > 0.5;

                    if (candle.volume > avgMorningVol * 1.1 && isStrongRed && (isBreakdown || isLosingValue)) {
                        const globalIdx = allStockQuotes.findIndex(q => q.date === candle.date);
                        const atr = getHistoricalATR(allStockQuotes, globalIdx, ATR_PERIOD);
                        
                        const entry = candle.close;
                        // FLIPPED MATH: Target is BELOW, Stop Loss is ABOVE
                        const target = entry - (atr * 5); 
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
            console.log(`📉 ${symbol.padEnd(12)} | Wins: ${stats.wins} | Losses: ${stats.losses} | WR: ${currentWR}%`);

        } catch (err) { continue; }
    }

    console.log("\n================================================================================");
    console.log(`🏆 BEARISH HYBRID BACKTEST COMPLETE`);
    console.log(`📈 Total Trades: ${totalTrades} | Win Rate: ${((totalWins/totalTrades)*100).toFixed(2)}%`);
    console.log("================================================================================\n");
}

backtestBearishStrategy();