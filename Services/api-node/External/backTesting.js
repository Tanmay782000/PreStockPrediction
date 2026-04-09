import yahooFinance from "yahoo-finance2";
import { STOCKS } from "../Common/stockInfo.js";

const yf = new yahooFinance();

// ---------------- SETTINGS ----------------
const BACKTEST_STOCKS = STOCKS.map(s => s.symbol)
const NIFTY_SYMBOL = "^NSEI";
const ATR_PERIOD = 20;

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

async function backtestStrategy() {
    console.log("🚀 Starting Unified Backtest v2.6...");
    console.log(`📊 Portfolio Size: ${BACKTEST_STOCKS.length} Stocks | Period: 60 Days\n`);

    // --- GLOBAL TOTALS ---
    let totalWins = 0;
    let totalLosses = 0;
    let totalTrades = 0;

    let allNiftyQuotes = [];
    let allNiftyDaily = [];
    try {
        const niftyHistory = await yf.chart(NIFTY_SYMBOL, {
            period1: Math.floor(Date.now() / 1000) - (59 * 24 * 60 * 60),
            interval: "15m"
        });
        const niftyDailyHistory = await yf.chart(NIFTY_SYMBOL, {
            period1: Math.floor(Date.now() / 1000) - (70 * 24 * 60 * 60),
            interval: "1d"
        });
        allNiftyQuotes = niftyHistory.quotes.filter(q => q.close);
        allNiftyDaily = niftyDailyHistory.quotes.filter(q => q.close);
    } catch (e) {
        console.error("❌ Critical: Nifty data sync failed.");
        return;
    }

    for (const symbol of BACKTEST_STOCKS) {
        try {
            console.log(`🔍 Testing ${symbol}...`);

            const stockHistory = await yf.chart(symbol, {
                period1: Math.floor(Date.now() / 1000) - (59 * 24 * 60 * 60),
                interval: "15m"
            });
            const dailyHistory = await yf.chart(symbol, {
                period1: Math.floor(Date.now() / 1000) - (70 * 24 * 60 * 60),
                interval: "1d"
            });

            const allStockQuotes = stockHistory.quotes.filter(q => q.close && q.volume);
            const allDailyQuotes = dailyHistory.quotes.filter(q => q.close);

            if (allStockQuotes.length === 0) throw new Error("No intraday data found");

            const daysMap = {};
            allStockQuotes.forEach(q => {
                const dateStr = q.date.toISOString().split('T')[0];
                if (!daysMap[dateStr]) daysMap[dateStr] = [];
                daysMap[dateStr].push(q);
            });

            let stats = { wins: 0, losses: 0, reasons: { nifty: 0, volume: 0, body: 0, gap: 0 } };
            const dateKeys = Object.keys(daysMap);

            for (const todayStr of dateKeys) {
                const todayStockQuotes = daysMap[todayStr];
                if (todayStockQuotes.length < 10) continue;

                const todayNiftyQuotes = allNiftyQuotes.filter(nq => nq.date.toISOString().startsWith(todayStr));
                if (todayNiftyQuotes.length < 3) continue;

                const nDailyIdx = allNiftyDaily.findIndex(nd => nd.date.toISOString().startsWith(todayStr));
                const yesterdayNiftyClose = nDailyIdx > 0 ? allNiftyDaily[nDailyIdx - 1].close : 0;

                const dailyIdx = allDailyQuotes.findIndex(dq => dq.date.toISOString().startsWith(todayStr));
                if (dailyIdx <= 0) continue;
                const yesterdayStockClose = allDailyQuotes[dailyIdx - 1].close;
                const gapPercent = ((todayStockQuotes[0].open - yesterdayStockClose) / yesterdayStockClose) * 100;
                if (gapPercent > 3.0) { stats.reasons.gap++; continue; }

                const morningHigh = Math.max(todayStockQuotes[0].high, todayStockQuotes[1].high);
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

                    const isNiftyAboveVWAP = nCandle ? nCandle.close > niftyVWAP : false;
                    const isNiftyAboveYesterday = nCandle ? nCandle.close > yesterdayNiftyClose : false;
                    const nBody = nCandle ? Math.abs(nCandle.close - nCandle.open) : 0;
                    const nRange = nCandle ? (nCandle.high - nCandle.low) : 0;
                    const isNiftyStrong = nRange > 0 ? (nBody / nRange) > 0.5 : false;

                    const niftyBullish = isNiftyAboveVWAP && isNiftyAboveYesterday && isNiftyStrong;

                    if (i < 2) continue;

                    if (!niftyBullish) { stats.reasons.nifty++; continue; }

                    const isBreakout = candle.close > morningHigh && candle.close > stockVWAP;
                    const isReclaimingValue = candle.close > stockVWAP && todayStockQuotes[i - 1].close < stockVWAP;
                    
                    if (candle.volume <= avgMorningVol * 1.1) { stats.reasons.volume++; continue; }

                    const sBody = Math.abs(candle.close - candle.open);
                    const sRange = candle.high - candle.low;
                    if (sRange === 0 || (sBody / sRange) <= 0.5) { stats.reasons.body++; continue; }

                    if (isBreakout || isReclaimingValue) {
                        const globalIdx = allStockQuotes.findIndex(q => q.date === candle.date);
                        const atr = getHistoricalATR(allStockQuotes, globalIdx, ATR_PERIOD);
                        
                        const entry = candle.close;
                        const target = entry + (atr * 3);
                        const stopLoss = entry - (atr * 1.5);

                        let outcome = null;
                        for (let j = i + 1; j < todayStockQuotes.length; j++) {
                            if (todayStockQuotes[j].low <= stopLoss) { outcome = "LOSS"; break; }
                            if (todayStockQuotes[j].high >= target) { outcome = "WIN"; break; }
                        }

                        if (!outcome) {
                            const finalClose = todayStockQuotes[todayStockQuotes.length - 1].close;
                            outcome = finalClose > entry ? "WIN" : "LOSS";
                        }

                        if (outcome === "WIN") stats.wins++; else stats.losses++;
                        break; 
                    }
                }
            }
            const currentTotal = stats.wins + stats.losses;
            const currentWR = currentTotal > 0 ? ((stats.wins / currentTotal) * 100).toFixed(2) : 0;
            
            // --- UPDATE GLOBAL STATS ---
            totalWins += stats.wins;
            totalLosses += stats.losses;
            totalTrades += currentTotal;

            console.log(`📊 ${symbol.padEnd(12)} | Wins: ${stats.wins} | Losses: ${stats.losses} | WR: ${currentWR}%`);
            console.log(`   Rejections: NiftyGuard(${stats.reasons.nifty}) VolLow(${stats.reasons.volume}) BodyWeak(${stats.reasons.body})\n`);

        } catch (err) {
            console.warn(`⚠️ Skipping ${symbol}: ${err.message}`);
            continue; 
        }
    }

    // --- FINAL GLOBAL ACCURACY SUMMARY ---
    const finalWR = totalTrades > 0 ? ((totalWins / totalTrades) * 100).toFixed(2) : 0;
    const expectancy = totalTrades > 0 ? ((totalWins * 2 - totalLosses) / totalTrades).toFixed(2) : 0;

    console.log("================================================================================");
    console.log("🏆 FINAL CONSOLIDATED BACKTEST RESULTS");
    console.log("================================================================================");
    console.log(`📁 Total Stocks Scanned : ${BACKTEST_STOCKS.length}`);
    console.log(`📈 Total Trades Executed: ${totalTrades}`);
    console.log(`✅ Total Wins           : ${totalWins}`);
    console.log(`❌ Total Losses         : ${totalLosses}`);
    console.log(`🔥 FINAL WIN ACCURACY   : ${finalWR}%`);
    console.log(`💰 Strategy Expectancy  : ${expectancy} (Profit units per trade)`);
    console.log("================================================================================");
    
    if (parseFloat(finalWR) > 33.3) {
        console.log("✅ VERDICT: STRATEGY IS MATHEMATICALLY PROFITABLE (1:2 RR confirmed)");
    } else {
        console.log("🛑 VERDICT: STRATEGY NEEDS REFINEMENT (Win rate too low for 1:2 RR)");
    }
}

backtestStrategy();
