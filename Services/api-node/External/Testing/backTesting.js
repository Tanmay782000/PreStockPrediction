import { Bullish_SYMBOL_MAP } from '../../Common/stockInfo.js';
import yahooFinance from "yahoo-finance2";

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

// ================================================================
//  OPENING DRIVE HISTORICAL VOLUME BASELINE
//  Calculates average volume of 9:15 candle from previous days
//  so we can compare today's opening candle against history
// ================================================================
function getHistoricalOpeningVolume(allStockQuotes, todayStr) {
    const openingCandles = allStockQuotes.filter(q => {
        const istDate = new Date(q.date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        const dateStr = istDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
        const hours = istDate.getHours();
        const minutes = istDate.getMinutes();

        // Only 9:15 candle from PREVIOUS days
        return dateStr !== todayStr && hours === 9 && minutes === 15;
    });

    return average(openingCandles.map(q => q.volume));
}

async function backtestStrategy() {
    console.log("🚀 Initializing Specialist Sniper Backtest...");

    const stockEntries = Object.entries(Bullish_SYMBOL_MAP);
    console.log(`📊 Processing ${stockEntries.length} Stocks | Syncing 60D Intraday + 2YR Daily\n`);

    let totalWins = 0, totalLosses = 0, totalTrades = 0;
    let breakoutWins = 0, breakoutLosses = 0;
    let reversalWins = 0, reversalLosses = 0;
    let openingDriveWins = 0, openingDriveLosses = 0;

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
        const symbol = `${symbolKey}.NS`;
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

            let stats = { 
                wins: 0, losses: 0,
                breakout: { wins: 0, losses: 0 },
                reversal: { wins: 0, losses: 0 },
                openingDrive: { wins: 0, losses: 0 }
            };

            const dateKeys = Object.keys(daysMap).sort();

            for (const todayStr of dateKeys) {
                const todayStockQuotes = daysMap[todayStr];
                const todayNiftyQuotes = allNiftyQuotes.filter(nq =>
                    nq.date.toISOString().startsWith(todayStr)
                );

                if (todayStockQuotes.length < 5 || todayNiftyQuotes.length < 3) continue;

                // Sync Yesterday's Context
                const nDailyIdx = allNiftyDaily.findIndex(nd => nd.date.toISOString().startsWith(todayStr));
                const yesterdayNiftyClose = nDailyIdx > 0 ? allNiftyDaily[nDailyIdx - 1].close : 0;

                const dailyIdx = allDailyQuotes.findIndex(dq => dq.date.toISOString().startsWith(todayStr));
                if (dailyIdx <= 0) continue;
                const yesterdayStockClose = allDailyQuotes[dailyIdx - 1].close;

                // Gap Filter
                const gapPercent = ((todayStockQuotes[0].open - yesterdayStockClose) / yesterdayStockClose) * 100;
                if (gapPercent > 5.0) continue;

                const morningHigh = Math.max(todayStockQuotes[0].high, todayStockQuotes[1].high);
                const avgMorningVol = (todayStockQuotes[0].volume + todayStockQuotes[1].volume) / 2;

                // ── OPENING DRIVE CHECK (evaluated at i=2, i.e. 9:45 candle) ──────
                // ================================================================
                //  We use historical avg volume of 9:15 candle from previous days
                //  so we don't compare against the spike itself (which inflates avgMorningVol)
                // ================================================================
                const historicalAvgVol = getHistoricalOpeningVolume(allStockQuotes, todayStr);
                const firstCandle = todayStockQuotes[0];
                const secondCandle = todayStockQuotes[1];
                const thirdCandle = todayStockQuotes[2]; // 9:45 candle (lastCandle at i=2)

                let sVwapForOD = 0, volForOD = 0;
                [firstCandle, secondCandle, thirdCandle].forEach(c => {
                    sVwapForOD += c.close * c.volume;
                    volForOD += c.volume;
                });
                const vwapAtOD = sVwapForOD / volForOD;

                const firstBody = Math.abs(firstCandle.close - firstCandle.open);
                const firstRange = firstCandle.high - firstCandle.low;
                const firstBodyRatio = firstRange > 0 ? firstBody / firstRange : 0;

                const thirdBody = Math.abs(thirdCandle.close - thirdCandle.open);
                const thirdRange = thirdCandle.high - thirdCandle.low;
                const thirdBodyRatio = thirdRange > 0 ? thirdBody / thirdRange : 0;

                const isOpeningDrive =
                    historicalAvgVol > 0 &&
                    firstCandle.close > firstCandle.open &&       // Candle 1 bullish
                    firstBodyRatio > 0.6 &&                       // Strong body on candle 1
                    firstCandle.volume > historicalAvgVol * 2.0 &&// 2x historical opening volume
                    secondCandle.close > firstCandle.open &&      // Candle 2 holding above open
                    thirdCandle.close > vwapAtOD &&               // Still above VWAP at 9:45
                    thirdCandle.close > firstCandle.open &&       // Holding opening level
                    thirdBodyRatio > 0.5;                         // 9:45 candle itself is strong

                // ── OPENING DRIVE TRADE ───────────────────────────────────────────
                if (isOpeningDrive) {
                    const globalIdx = allStockQuotes.findIndex(q => q.date === thirdCandle.date);
                    const atr = getHistoricalATR(allStockQuotes, globalIdx, ATR_PERIOD);

                    const entry = thirdCandle.close;
                    const target = entry + (atr * 2.0); // Tighter target for opening drive
                    const stopLoss = entry - (atr * 1.0); // Tighter SL for opening drive

                    let outcome = null;
                    for (let j = 3; j < todayStockQuotes.length; j++) {
                        if (todayStockQuotes[j].low <= stopLoss) { outcome = "LOSS"; break; }
                        if (todayStockQuotes[j].high >= target) { outcome = "WIN"; break; }
                    }
                    if (!outcome) {
                        outcome = todayStockQuotes[todayStockQuotes.length - 1].close > entry ? "WIN" : "LOSS";
                    }

                    if (outcome === "WIN") {
                        stats.wins++; stats.openingDrive.wins++;
                    } else {
                        stats.losses++; stats.openingDrive.losses++;
                    }
                    continue; // One trade per day
                }

                // ── REGULAR SIGNAL SCAN (from i=2 onwards) ───────────────────────
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

                    const niftyBullish =
                        (nCandle?.close > yesterdayNiftyClose) &&
                        (nCandle?.close > (niftyVWAP * 0.9998) ||
                        (Math.abs(nCandle?.close - nCandle?.open) / (nCandle?.high - nCandle?.low)) > 0.3);

                    if (i < 2 || !niftyBullish) continue;

                    const isBreakout = candle.close > morningHigh && candle.close > stockVWAP;
                    const isReclaiming = candle.close > stockVWAP && todayStockQuotes[i - 1].close < stockVWAP;
                    const isStrong = (Math.abs(candle.close - candle.open) / (candle.high - candle.low)) > 0.5;

                    if (candle.volume > avgMorningVol * 1.1 && isStrong && (isBreakout || isReclaiming)) {
                        const globalIdx = allStockQuotes.findIndex(q => q.date === candle.date);
                        const atr = getHistoricalATR(allStockQuotes, globalIdx, ATR_PERIOD);

                        const entry = candle.close;
                        const target = entry + (atr * 5.0);
                        const stopLoss = entry - (atr * 2.5);

                        let outcome = null;
                        for (let j = i + 1; j < todayStockQuotes.length; j++) {
                            if (todayStockQuotes[j].low <= stopLoss) { outcome = "LOSS"; break; }
                            if (todayStockQuotes[j].high >= target) { outcome = "WIN"; break; }
                        }
                        if (!outcome) {
                            outcome = todayStockQuotes[todayStockQuotes.length - 1].close > entry ? "WIN" : "LOSS";
                        }

                        if (outcome === "WIN") {
                            stats.wins++;
                            if (isBreakout) stats.breakout.wins++;
                            else stats.reversal.wins++;
                        } else {
                            stats.losses++;
                            if (isBreakout) stats.breakout.losses++;
                            else stats.reversal.losses++;
                        }
                        break; // One trade per day
                    }
                }
            }

            // Per-stock summary
            totalWins += stats.wins;
            totalLosses += stats.losses;
            totalTrades += (stats.wins + stats.losses);
            breakoutWins += stats.breakout.wins;
            breakoutLosses += stats.breakout.losses;
            reversalWins += stats.reversal.wins;
            reversalLosses += stats.reversal.losses;
            openingDriveWins += stats.openingDrive.wins;
            openingDriveLosses += stats.openingDrive.losses;

            const currentTotal = stats.wins + stats.losses;
            const currentWR = currentTotal > 0 ? ((stats.wins / currentTotal) * 100).toFixed(2) : 0;
            const odTotal = stats.openingDrive.wins + stats.openingDrive.losses;
            const odWR = odTotal > 0 ? ((stats.openingDrive.wins / odTotal) * 100).toFixed(2) : "N/A";

            console.log(
                `📊 ${symbolKey.padEnd(12)} | Trades: ${currentTotal} | WR: ${currentWR}% | ` +
                `BO: ${stats.breakout.wins}W/${stats.breakout.losses}L | ` +
                `REV: ${stats.reversal.wins}W/${stats.reversal.losses}L | ` +
                `OD: ${stats.openingDrive.wins}W/${stats.openingDrive.losses}L (WR: ${odWR}%)`
            );

        } catch (err) { continue; }
    }

    // Final Summary
    const boTotal = breakoutWins + breakoutLosses;
    const revTotal = reversalWins + reversalLosses;
    const odTotal = openingDriveWins + openingDriveLosses;

    console.log("\n" + "=".repeat(80));
    console.log(`🏆 HYBRID BACKTEST COMPLETE`);
    console.log(`📈 Total Trades : ${totalTrades} | Overall WR: ${((totalWins / totalTrades) * 100).toFixed(2)}%`);
    console.log(`📊 BREAKOUT     : ${boTotal} trades | WR: ${boTotal > 0 ? ((breakoutWins / boTotal) * 100).toFixed(2) : 0}%`);
    console.log(`🔄 REVERSAL     : ${revTotal} trades | WR: ${revTotal > 0 ? ((reversalWins / revTotal) * 100).toFixed(2) : 0}%`);
    console.log(`🚀 OPENING DRIVE: ${odTotal} trades | WR: ${odTotal > 0 ? ((openingDriveWins / odTotal) * 100).toFixed(2) : 0}%`);
    console.log("=".repeat(80) + "\n");
}

backtestStrategy();