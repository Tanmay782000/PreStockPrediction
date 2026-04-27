import { BullStocks } from '../../Common/stockInfo.js';
import yahooFinance from "yahoo-finance2";

const yf = new yahooFinance();

const ATR_PERIOD = 20;

const TWO_YEARS_MS  = 2 * 365 * 24 * 60 * 60 * 1000;
const FIVE_DAYS_MS  = 5 * 24 * 60 * 60 * 1000;
const START_DATE_DAILY     = Math.floor((Date.now() - TWO_YEARS_MS) / 1000);
const START_DATE_INTRADAY  = Math.floor((Date.now() - FIVE_DAYS_MS) / 1000);

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

// ── FROM NEW SCRIPT: historical opening volume for Opening Drive ──
function getHistoricalOpeningVolume(allStockQuotes, todayStr) {
    const openingCandles = allStockQuotes.filter(q => {
        const istDate = new Date(q.date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        const dateStr = istDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
        const hours   = istDate.getHours();
        const minutes = istDate.getMinutes();
        return dateStr !== todayStr && hours === 9 && minutes === 15;
    });
    return average(openingCandles.map(q => q.volume));
}

// ── FROM NEW SCRIPT: percentage-based time-adjusted targets ──────
function getTimeAdjustedTargets(entryPrice, signalType, candleDate) {
    const istString = candleDate.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const istTime   = new Date(istString);
    const hour      = istTime.getHours();
    const minutes   = istTime.getMinutes();

    const minutesLeft = (15 * 60 + 15) - (hour * 60 + minutes);
    const hoursLeft   = minutesLeft / 60;

    if (hoursLeft < 2.0) return null;

    if (signalType === "OPENING_DRIVE") {
        if (hoursLeft >= 4.5) {
            return { target: entryPrice * (1 + 0.012), stopLoss: entryPrice * (1 - 0.007), riskReward: "1.08", session: "EARLY DRIVE" };
        } else if (hoursLeft >= 3.0) {
            return { target: entryPrice * (1 + 0.010), stopLoss: entryPrice * (1 - 0.005), riskReward: "1.1",  session: "MID DRIVE" };
        } else {
            return null;
        }
    }

    if (signalType === "BREAKOUT") {
        if (hoursLeft >= 4.5) {
            return { target: entryPrice * (1 + 0.012), stopLoss: entryPrice * (1 - 0.007), riskReward: "2.09", session: "EARLY BREAKOUT" };
        } else if (hoursLeft >= 3.0) {
            return { target: entryPrice * (1 + 0.011), stopLoss: entryPrice * (1 - 0.006), riskReward: "1.09", session: "MID BREAKOUT" };
        } else {
            return null;
        }
    }

    if (signalType === "REVERSAL") {
        if (hoursLeft >= 4.5) {
            return { target: entryPrice * (1 + 0.013), stopLoss: entryPrice * (1 - 0.007), riskReward: "1.09", session: "EARLY REVERSAL" };
        } else if (hoursLeft >= 3.0) {
            return { target: entryPrice * (1 + 0.011), stopLoss: entryPrice * (1 - 0.006), riskReward: "1.09", session: "MID REVERSAL" };
        } else {
            return { target: entryPrice * (1 + 0.010), stopLoss: entryPrice * (1 - 0.005), riskReward: "1.1",  session: "LATE REVERSAL" };
        }
    }

    return { target: entryPrice * (1 + 0.013), stopLoss: entryPrice * (1 - 0.007), riskReward: "1.9", session: "DEFAULT" };
}

async function backtestStrategy() {
    console.log("🚀 Initializing Sniper Backtest [TODAY + YESTERDAY ONLY]...");

    const stockEntries = Object.entries(BullStocks);
    console.log(`📊 Processing ${stockEntries.length} Stocks | Syncing Latest 2 Sessions\n`);

    let totalWins = 0, totalLosses = 0, totalTrades = 0, totalSkipped = 0;
    let breakoutWins = 0, breakoutLosses = 0;
    let reversalWins = 0, reversalLosses = 0;
    let openingDriveWins = 0, openingDriveLosses = 0;

    // ── FROM NEW SCRIPT: session-level tracking ───────────────────
    const sessionStats = {
        "EARLY DRIVE":    { wins: 0, losses: 0 },
        "MID DRIVE":      { wins: 0, losses: 0 },
        "EARLY BREAKOUT": { wins: 0, losses: 0 },
        "MID BREAKOUT":   { wins: 0, losses: 0 },
        "EARLY REVERSAL": { wins: 0, losses: 0 },
        "MID REVERSAL":   { wins: 0, losses: 0 },
        "LATE REVERSAL":  { wins: 0, losses: 0 },
        "DEFAULT":        { wins: 0, losses: 0 },
    };

    let allNiftyQuotes = [], allNiftyDaily = [];
    try {
        const niftyHistory      = await yf.chart("^NSEI", { period1: START_DATE_INTRADAY, interval: "15m" });
        const niftyDailyHistory = await yf.chart("^NSEI", { period1: START_DATE_DAILY,    interval: "1d"  });
        allNiftyQuotes = niftyHistory.quotes.filter(q => q.close);
        allNiftyDaily  = niftyDailyHistory.quotes.filter(q => q.close);
    } catch (e) {
        console.error("❌ Critical: Nifty data sync failed."); return;
    }

    for (const [symbolKey] of stockEntries) {
        const symbol = `${symbolKey}.NS`;
        try {
            const stockHistory = await yf.chart(symbol, { period1: START_DATE_INTRADAY, interval: "15m" });
            const dailyHistory = await yf.chart(symbol, { period1: START_DATE_DAILY,    interval: "1d"  });

            const allStockQuotes = stockHistory.quotes.filter(q => q.close && q.volume);
            const allDailyQuotes = dailyHistory.quotes.filter(q => q.close);

            if (allStockQuotes.length === 0) continue;

            const daysMap = {};
            allStockQuotes.forEach(q => {
                const dateStr = q.date.toISOString().split('T')[0];
                if (!daysMap[dateStr]) daysMap[dateStr] = [];
                daysMap[dateStr].push(q);
            });

            let stats = {
                wins: 0, losses: 0, skipped: 0,
                breakout:     { wins: 0, losses: 0 },
                reversal:     { wins: 0, losses: 0 },
                openingDrive: { wins: 0, losses: 0 }
            };

            const dateKeys   = Object.keys(daysMap).sort();
            // ── FROM OLD SCRIPT: only last 2 trading days ─────────
            const targetDates = dateKeys.slice(-1);

            for (const todayStr of targetDates) {
                const todayStockQuotes = daysMap[todayStr];
                const todayNiftyQuotes = allNiftyQuotes.filter(nq =>
                    nq.date.toISOString().startsWith(todayStr)
                );

                if (todayStockQuotes.length < 5 || todayNiftyQuotes.length < 3) continue;

                const nDailyIdx = allNiftyDaily.findIndex(nd => nd.date.toISOString().startsWith(todayStr));
                const yesterdayNiftyClose = nDailyIdx > 0 ? allNiftyDaily[nDailyIdx - 1].close : 0;

                const dailyIdx = allDailyQuotes.findIndex(dq => dq.date.toISOString().startsWith(todayStr));
                if (dailyIdx <= 0) continue;
                const yesterdayStockClose = allDailyQuotes[dailyIdx - 1].close;

                const gapPercent = ((todayStockQuotes[0].open - yesterdayStockClose) / yesterdayStockClose) * 100;
                if (gapPercent > 5.0) continue;

                const morningHigh   = Math.max(todayStockQuotes[0].high, todayStockQuotes[1].high);
                const avgMorningVol = (todayStockQuotes[0].volume + todayStockQuotes[1].volume) / 2;

                // ── FROM NEW SCRIPT: Opening Drive check ──────────
                const historicalAvgVol = getHistoricalOpeningVolume(allStockQuotes, todayStr);
                const firstCandle      = todayStockQuotes[0];
                const secondCandle     = todayStockQuotes[1];
                const thirdCandle      = todayStockQuotes[2];

                let sVwapForOD = 0, volForOD = 0;
                [firstCandle, secondCandle, thirdCandle].forEach(c => {
                    sVwapForOD += c.close * c.volume;
                    volForOD   += c.volume;
                });
                const vwapAtOD = sVwapForOD / volForOD;

                const firstBodyRatio = (firstCandle.high - firstCandle.low) > 0
                    ? Math.abs(firstCandle.close - firstCandle.open) / (firstCandle.high - firstCandle.low) : 0;
                const thirdBodyRatio = (thirdCandle.high - thirdCandle.low) > 0
                    ? Math.abs(thirdCandle.close - thirdCandle.open) / (thirdCandle.high - thirdCandle.low) : 0;

                const isOpeningDrive =
                    historicalAvgVol > 0 &&
                    firstCandle.close  > firstCandle.open  &&
                    firstBodyRatio     > 0.6               &&
                    firstCandle.volume > historicalAvgVol * 2.0 &&
                    secondCandle.close > secondCandle.open &&
                    thirdCandle.close  > thirdCandle.open  &&
                    thirdCandle.close  > vwapAtOD          &&
                    thirdCandle.close  > firstCandle.open  &&
                    thirdBodyRatio     > 0.5;

                if (isOpeningDrive) {
                    const entry   = thirdCandle.close;
                    const targets = getTimeAdjustedTargets(entry, "OPENING_DRIVE", thirdCandle.date);

                    if (!targets) { stats.skipped++; continue; }

                    const { target, stopLoss, session } = targets;

                    let outcome = null;
                    for (let j = 3; j < todayStockQuotes.length; j++) {
                        if (todayStockQuotes[j].low  <= stopLoss) { outcome = "LOSS"; break; }
                        if (todayStockQuotes[j].high >= target)   { outcome = "WIN";  break; }
                    }
                    if (!outcome) {
                        outcome = todayStockQuotes[todayStockQuotes.length - 1].close > entry ? "WIN" : "LOSS";
                    }

                    if (outcome === "WIN") {
                        stats.wins++; stats.openingDrive.wins++; sessionStats[session].wins++;
                    } else {
                        stats.losses++; stats.openingDrive.losses++; sessionStats[session].losses++;
                    }
                    continue;
                }

                // ── REGULAR SIGNAL SCAN ───────────────────────────
                let sVwapSumPV = 0, sVwapSumV = 0;
                let nVwapSumPV = 0, nVwapSumV = 0;

                for (let i = 0; i < todayStockQuotes.length; i++) {
                    const candle = todayStockQuotes[i];
                    sVwapSumPV += (candle.close * candle.volume);
                    sVwapSumV  += candle.volume;
                    const stockVWAP = sVwapSumPV / sVwapSumV;

                    const nCandle = todayNiftyQuotes[i];
                    if (nCandle) {
                        nVwapSumPV += (nCandle.close * (nCandle.volume || 1));
                        nVwapSumV  += (nCandle.volume || 1);
                    }
                    const niftyVWAP = nVwapSumPV / nVwapSumV;

                    const niftyBullish =
                        (nCandle?.close > yesterdayNiftyClose) &&
                        (nCandle?.close > (niftyVWAP * 0.9998) ||
                        (Math.abs(nCandle?.close - nCandle?.open) / (nCandle?.high - nCandle?.low)) > 0.3);

                    if (i < 2 || !niftyBullish) continue;

                    // ── FROM NEW SCRIPT: isBullishCandle guard ────
                    const isBullishCandle = candle.close > candle.open;

                    const isBreakout = candle.close > morningHigh &&
                                       candle.close > stockVWAP   &&
                                       isBullishCandle;

                    const isReclaiming = candle.close > stockVWAP              &&
                                         todayStockQuotes[i - 1].close < stockVWAP &&
                                         isBullishCandle;

                    const isStrong = isBullishCandle &&
                                     (Math.abs(candle.close - candle.open) / (candle.high - candle.low)) > 0.5;

                    if (candle.volume > avgMorningVol * 1.1 && isStrong && (isBreakout || isReclaiming)) {
                        const entry      = candle.close;
                        const signalType = isBreakout ? "BREAKOUT" : "REVERSAL";

                        // ── FROM NEW SCRIPT: time-adjusted targets ─
                        const targets = getTimeAdjustedTargets(entry, signalType, candle.date);

                        if (!targets) { stats.skipped++; break; }

                        const { target, stopLoss, session } = targets;

                        let outcome = null;
                        for (let j = i + 1; j < todayStockQuotes.length; j++) {
                            if (todayStockQuotes[j].low  <= stopLoss) { outcome = "LOSS"; break; }
                            if (todayStockQuotes[j].high >= target)   { outcome = "WIN";  break; }
                        }
                        if (!outcome) {
                            outcome = todayStockQuotes[todayStockQuotes.length - 1].close > entry ? "WIN" : "LOSS";
                        }

                        if (outcome === "WIN") {
                            stats.wins++;
                            sessionStats[session].wins++;
                            if (isBreakout) stats.breakout.wins++;
                            else stats.reversal.wins++;
                        } else {
                            stats.losses++;
                            sessionStats[session].losses++;
                            if (isBreakout) stats.breakout.losses++;
                            else stats.reversal.losses++;
                        }
                        break;
                    }
                }
            }

            totalWins        += stats.wins;
            totalLosses      += stats.losses;
            totalTrades      += (stats.wins + stats.losses);
            totalSkipped     += stats.skipped;
            breakoutWins     += stats.breakout.wins;     breakoutLosses     += stats.breakout.losses;
            reversalWins     += stats.reversal.wins;     reversalLosses     += stats.reversal.losses;
            openingDriveWins += stats.openingDrive.wins; openingDriveLosses += stats.openingDrive.losses;

            const currentTotal = stats.wins + stats.losses;
            const currentWR    = currentTotal > 0 ? ((stats.wins / currentTotal) * 100).toFixed(2) : 0;
            const odTotal      = stats.openingDrive.wins + stats.openingDrive.losses;
            const odWR         = odTotal > 0 ? ((stats.openingDrive.wins / odTotal) * 100).toFixed(2) : "N/A";

            if (currentTotal > 0 || stats.skipped > 0) {
                console.log(
                    `📊 ${symbolKey.padEnd(12)} | Trades: ${currentTotal} | Skipped: ${stats.skipped} | WR: ${currentWR}% | ` +
                    `BO: ${stats.breakout.wins}W/${stats.breakout.losses}L | ` +
                    `REV: ${stats.reversal.wins}W/${stats.reversal.losses}L | ` +
                    `OD: ${stats.openingDrive.wins}W/${stats.openingDrive.losses}L (WR: ${odWR}%)`
                );
            }

        } catch (err) { continue; }
    }

    const boTotal  = breakoutWins  + breakoutLosses;
    const revTotal = reversalWins  + reversalLosses;
    const odTotal  = openingDriveWins + openingDriveLosses;

    console.log("\n" + "=".repeat(80));
    console.log(`🏆 48-HOUR BACKTEST COMPLETE`);
    console.log(`📈 Total Trades  : ${totalTrades} | Skipped (too late): ${totalSkipped} | Overall WR: ${totalTrades > 0 ? ((totalWins / totalTrades) * 100).toFixed(2) : 0}%`);
    console.log(`📊 BREAKOUT      : ${boTotal}  trades | WR: ${boTotal  > 0 ? ((breakoutWins  / boTotal)  * 100).toFixed(2) : 0}%`);
    console.log(`🔄 REVERSAL      : ${revTotal} trades | WR: ${revTotal > 0 ? ((reversalWins  / revTotal) * 100).toFixed(2) : 0}%`);
    console.log(`🚀 OPENING DRIVE : ${odTotal}  trades | WR: ${odTotal  > 0 ? ((openingDriveWins / odTotal) * 100).toFixed(2) : 0}%`);

    console.log("\n📅 SESSION BREAKDOWN:");
    console.log("-".repeat(60));
    for (const [session, s] of Object.entries(sessionStats)) {
        const total = s.wins + s.losses;
        if (total === 0) continue;
        const wr = ((s.wins / total) * 100).toFixed(2);
        console.log(`  ${session.padEnd(20)} | ${total} trades | WR: ${wr}% | ${s.wins}W / ${s.losses}L`);
    }
    console.log("=".repeat(80) + "\n");
}

backtestStrategy();