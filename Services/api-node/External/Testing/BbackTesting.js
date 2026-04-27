import yahooFinance from "yahoo-finance2";
import { BearStocks } from '../../Common/stockInfo.js';

const yf = new yahooFinance();

// ── 2-day spot-check mode (change to SIXTY_DAYS_MS for full backtest) ──
const TWO_DAYS_MS  = 4 * 24 * 60 * 60 * 1000;
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000; // enough to get yesterday's daily close
const START_DATE_DAILY = Math.floor((Date.now() - FIVE_DAYS_MS)  / 1000);
const START_DATE_15M   = Math.floor((Date.now() - TWO_DAYS_MS)   / 1000);

const average = (arr) =>
    arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

// ================================================================
//  TIME-ADJUSTED TARGETS — BEARISH (SHORT) VERSION
//  Exact mirror of bullish getTimeAdjustedTargets but inverted:
//    target   = entry * (1 - X%)   → price falls → profit
//    stopLoss = entry * (1 + X%)   → price rises → cut loss
// ================================================================
function getTimeAdjustedTargets(entryPrice, signalType, candleDate) {
    const istString = candleDate.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const istTime   = new Date(istString);
    const hour      = istTime.getHours();
    const mins      = istTime.getMinutes();

    const minutesLeft = (15 * 60 + 15) - (hour * 60 + mins);
    const hoursLeft   = minutesLeft / 60;

    if (hoursLeft < 2.0) return null;

    if (signalType === "OPENING_DRIVE") {
        if (hoursLeft >= 4.5) return { target: entryPrice * 0.9930, stopLoss: entryPrice * 1.0035, riskReward: "2.0", session: "EARLY DRIVE" };
        if (hoursLeft >= 3.0) return { target: entryPrice * 0.9940, stopLoss: entryPrice * 1.0030, riskReward: "2.0", session: "MID DRIVE" };
        return null;
    }

    if (signalType === "BREAKDOWN") {
        if (hoursLeft >= 4.5) return { target: entryPrice * 0.9900, stopLoss: entryPrice * 1.0050, riskReward: "1.7", session: "EARLY BREAKDOWN" };
        if (hoursLeft >= 3.0) return { target: entryPrice * 0.9920, stopLoss: entryPrice * 1.0040, riskReward: "1.8", session: "MID BREAKDOWN" };
        return null; // late breakdown → skip
    }

    if (signalType === "VALUE_LOSS") {
        if (hoursLeft >= 4.5) return { target: entryPrice * 0.9930, stopLoss: entryPrice * 1.0035, riskReward: "2.0", session: "EARLY VALUE LOSS" };
        if (hoursLeft >= 3.0) return { target: entryPrice * 0.9900, stopLoss: entryPrice * 1.0050, riskReward: "1.8", session: "MID VALUE LOSS" };
        return        { target: entryPrice * 0.9930, stopLoss: entryPrice * 1.0035, riskReward: "2.0", session: "LATE VALUE LOSS" };
    }

    return { target: entryPrice * 0.9930, stopLoss: entryPrice * 1.0035, riskReward: "2.0", session: "DEFAULT" };
}

// ================================================================
//  NIFTY BEARISH CHECK — mirrors getNiftyBearishSentiment() in live script
//  isBelowPrev AND (isBelowVWAP OR isStrongRed)
// ================================================================
function isNiftyBearish(todayNiftyQuotes, candleIdx, yesterdayNiftyClose) {
    if (!todayNiftyQuotes[candleIdx]) return false;

    // Cumulative VWAP up to candleIdx (no look-ahead)
    let tVal = 0, tVol = 0;
    for (let k = 0; k <= candleIdx; k++) {
        const q = todayNiftyQuotes[k];
        tVal += q.close * (q.volume || 1);
        tVol += (q.volume || 1);
    }
    const vwap = tVal / tVol;

    const nCandle     = todayNiftyQuotes[candleIdx];
    const { close, open, high, low } = nCandle;

    const isBelowPrev  = close < yesterdayNiftyClose;
    const isBelowVWAP  = close < vwap * 1.0002;
    const bodyToRange  = (high - low) > 0 ? Math.abs(close - open) / (high - low) : 0;
    const isStrongRed  = bodyToRange > 0.3;

    return isBelowPrev && (isBelowVWAP || isStrongRed);
}

// ================================================================
//  HISTORICAL OPENING VOLUME — same logic as live bearish script
// ================================================================
function getHistoricalOpeningVolume(allStockQuotes, todayStr) {
    const openingCandles = allStockQuotes.filter(q => {
        const istDate = new Date(q.date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        const dateStr = istDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
        const hours   = istDate.getHours();
        const mins    = istDate.getMinutes();
        return dateStr !== todayStr && hours === 9 && mins === 15;
    });
    return average(openingCandles.map(q => q.volume));
}

// ================================================================
//  SIMULATE SLIPPAGE — mirrors live limitPrice = price * 0.997
//  For shorts, limit is placed 0.3% BELOW close for better fill
// ================================================================
function applySlippage(price) {
    return price * 0.997;
}

// ================================================================
//  OUTCOME RESOLUTION — inverted for shorts
//  WIN: price drops to target
//  LOSS: price rises to stopLoss
//  EOD not resolved → conservative LOSS
// ================================================================
function resolveOutcome(quotes, fromIdx, entry, target, stopLoss) {
    for (let j = fromIdx; j < quotes.length; j++) {
        if (quotes[j].high >= stopLoss) return "LOSS"; // price rose → stop hit
        if (quotes[j].low  <= target)   return "WIN";  // price fell → target hit
    }
    return "LOSS"; // EOD square-off → conservative
}

// ================================================================
//  MAIN BACKTEST
// ================================================================
async function backtestBearishStrategy() {
    console.log("🚀 Backtest — Exact Mirror of Live Bearish Script");
    console.log(`📅 Period: Last 2 days intraday (15m) | Slippage: -0.3% on entry\n`);

    const stockEntries = Object.entries(BearStocks);
    console.log(`📉 Processing ${stockEntries.length} stocks (SHORT mode)...\n`);

    // ── Aggregate counters ────────────────────────────────────────
    let totalWins = 0, totalLosses = 0, totalSkipped = 0;
    let breakdownWins = 0, breakdownLosses = 0;
    let valueLossWins = 0, valueLossLosses = 0;
    let openingDriveWins = 0, openingDriveLosses = 0;

    const sessionStats = {
        "EARLY DRIVE":      { wins: 0, losses: 0 },
        "MID DRIVE":        { wins: 0, losses: 0 },
        "EARLY BREAKDOWN":  { wins: 0, losses: 0 },
        "MID BREAKDOWN":    { wins: 0, losses: 0 },
        "EARLY VALUE LOSS": { wins: 0, losses: 0 },
        "MID VALUE LOSS":   { wins: 0, losses: 0 },
        "LATE VALUE LOSS":  { wins: 0, losses: 0 },
        "DEFAULT":          { wins: 0, losses: 0 },
    };

    // ── Fetch Nifty data once ─────────────────────────────────────
    let allNiftyQuotes = [], allNiftyDaily = [];
    try {
        const niftyIntra = await yf.chart("^NSEI", { period1: START_DATE_15M,   interval: "15m" });
        const niftyDaily = await yf.chart("^NSEI", { period1: START_DATE_DAILY, interval: "1d"  });
        allNiftyQuotes   = niftyIntra.quotes.filter(q => q.close);
        allNiftyDaily    = niftyDaily.quotes.filter(q => q.close);
        console.log(`✅ Nifty loaded: ${allNiftyQuotes.length} 15m candles\n`);
    } catch (e) {
        console.error("❌ Nifty data sync failed:", e.message);
        return;
    }

    // ── Per-stock loop ────────────────────────────────────────────
    for (const [symbolKey] of stockEntries) {
        const symbol = `${symbolKey}.NS`;
        try {
            const stockIntra = await yf.chart(symbol, { period1: START_DATE_15M,   interval: "15m" });
            const stockDaily = await yf.chart(symbol, { period1: START_DATE_DAILY, interval: "1d"  });

            const allStockQuotes = stockIntra.quotes.filter(q => q.close && q.volume);
            const allDailyQuotes = stockDaily.quotes.filter(q => q.close);

            if (allStockQuotes.length === 0) { console.log(`⚠️  ${symbolKey}: no data`); continue; }

            // Group 15m candles by IST date string
            const daysMap = {};
            allStockQuotes.forEach(q => {
                const dateStr = new Date(q.date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
                    .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
                if (!daysMap[dateStr]) daysMap[dateStr] = [];
                daysMap[dateStr].push(q);
            });

            let stats = {
                wins: 0, losses: 0, skipped: 0,
                breakdown:    { wins: 0, losses: 0 },
                valueLoss:    { wins: 0, losses: 0 },
                openingDrive: { wins: 0, losses: 0 },
            };

            // ── Per-day loop ──────────────────────────────────────
            for (const todayStr of Object.keys(daysMap).sort()) {
                const todayStockQuotes = daysMap[todayStr];

                if (todayStockQuotes.length < 3) continue;

                // Get today's Nifty candles
                const todayNiftyQuotes = allNiftyQuotes.filter(q => {
                    const d = new Date(q.date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
                    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === todayStr;
                });

                if (todayNiftyQuotes.length < 3) continue;

                // Yesterday's closes
                const nDailyIdx = allNiftyDaily.findIndex(q =>
                    new Date(q.date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
                        .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === todayStr
                );
                if (nDailyIdx <= 0) continue;
                const yesterdayNiftyClose = allNiftyDaily[nDailyIdx - 1].close;

                const sDailyIdx = allDailyQuotes.findIndex(q =>
                    new Date(q.date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
                        .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === todayStr
                );
                if (sDailyIdx <= 0) continue;
                const yesterdayStockClose = allDailyQuotes[sDailyIdx - 1].close;

                // ── Gap down filter — mirrors live script ──────────
                const gapPercent = ((todayStockQuotes[0].open - yesterdayStockClose) / yesterdayStockClose) * 100;
                if (gapPercent < -5.0) continue; // already crashed → don't chase

                // ── Morning reference values ───────────────────────
                const firstCandle   = todayStockQuotes[0];
                const secondCandle  = todayStockQuotes[1];
                const morningLow    = Math.min(firstCandle.low, secondCandle.low);
                const avgMorningVol = (firstCandle.volume + secondCandle.volume) / 2;

                // ── Historical opening volume ──────────────────────
                const historicalAvgVol = getHistoricalOpeningVolume(allStockQuotes, todayStr);

                // ── Opening Drive base conditions (static per day) ─
                const firstBody      = Math.abs(firstCandle.close - firstCandle.open);
                const firstRange     = firstCandle.high - firstCandle.low;
                const firstBodyRatio = firstRange > 0 ? firstBody / firstRange : 0;

                const openingDriveBase =
                    historicalAvgVol > 0 &&
                    firstCandle.close < firstCandle.open &&    // candle 1 red
                    firstBodyRatio > 0.6 &&                     // strong body, not doji
                    firstCandle.volume > historicalAvgVol * 2.0 && // 2x historical vol
                    secondCandle.close < secondCandle.open;    // candle 2 also red

                let tradedToday = false;

                // ── Scan from candle index 2 onward ───────────────
                for (let i = 2; i < todayStockQuotes.length; i++) {
                    if (tradedToday) break;

                    const lastCandle = todayStockQuotes[i];
                    const prevCandle = todayStockQuotes[i - 1];

                    // ── Cumulative VWAP up to candle i ────────────
                    let sVal = 0, sVol = 0;
                    for (let k = 0; k <= i; k++) {
                        sVal += todayStockQuotes[k].close * todayStockQuotes[k].volume;
                        sVol += todayStockQuotes[k].volume;
                    }
                    const stockVWAP = sVal / sVol;

                    // ── Nifty bearish sentiment at this candle ────
                    const niftyOk = isNiftyBearish(todayNiftyQuotes, i, yesterdayNiftyClose);
                    if (!niftyOk) continue;

                    // ── Signal conditions — exact copy of live ────
                    const isBearishCandle = lastCandle.close < lastCandle.open;

                    // BREAKDOWN — mirrors live isBreakdown
                    const morningRange = Math.max(firstCandle.high, secondCandle.high)
                                       - Math.min(firstCandle.low,  secondCandle.low);
                    const isMeaningfulMorningRange = morningRange > lastCandle.close * 0.003;

                    const isBreakdown =
                        isBearishCandle &&
                        isMeaningfulMorningRange &&
                        lastCandle.close < morningLow * 0.999 &&   // meaningful break below morning low
                        prevCandle.close >= morningLow &&           // first candle to break (no chasing)
                        lastCandle.close < stockVWAP;               // also below VWAP

                    // VALUE LOSS — mirrors live isLosingValue
                    const candleMid    = (lastCandle.high + lastCandle.low) / 2;
                    const testedVWAP   = lastCandle.high >= stockVWAP * 0.9992; // wick reached VWAP zone
                    const closeBelowMid = lastCandle.close < candleMid;          // closed in lower half

                    const isLosingValue =
                        isBearishCandle &&
                        prevCandle.close > stockVWAP &&             // was above VWAP before
                        lastCandle.close < stockVWAP * 0.9995 &&   // meaningful close below VWAP
                        testedVWAP &&                               // wick reached VWAP (rejection)
                        closeBelowMid;                              // closed in lower half

                    // Volume + candle strength — exact thresholds from live
                    const hasVolumeSurge = lastCandle.volume > avgMorningVol * 1.5;
                    const sBody = Math.abs(lastCandle.close - lastCandle.open);
                    const sRange = lastCandle.high - lastCandle.low;
                    const isStrongRed = isBearishCandle && (sRange > 0 ? sBody / sRange > 0.5 : false);

                    // OPENING DRIVE: base conditions + lastCandle conditions
                    const isOpeningDrive =
                        openingDriveBase &&
                        lastCandle.close < lastCandle.open &&  // lastCandle red
                        lastCandle.close < stockVWAP &&        // below VWAP
                        lastCandle.close < firstCandle.open;   // below opening price

                    const isRegularSignal      = hasVolumeSurge && isStrongRed && (isBreakdown || isLosingValue);
                    const isOpeningDriveSignal = isOpeningDrive && isStrongRed;

                    if (!isRegularSignal && !isOpeningDriveSignal) continue;

                    // ── Signal fired — determine type ─────────────
                    const signalType = isBreakdown
                        ? "BREAKDOWN"
                        : isOpeningDriveSignal
                            ? "OPENING_DRIVE"
                            : "VALUE_LOSS";

                    // ── Time-adjusted targets ─────────────────────
                    const targets = getTimeAdjustedTargets(lastCandle.close, signalType, lastCandle.date);
                    if (!targets) { stats.skipped++; totalSkipped++; break; }

                    // ── Apply slippage (mirrors live limitPrice * 0.997) ──
                    const entry    = applySlippage(lastCandle.close);
                    const target   = applySlippage(lastCandle.close) * (targets.target   / lastCandle.close);
                    const stopLoss = applySlippage(lastCandle.close) * (targets.stopLoss / lastCandle.close);

                    // ── Resolve outcome ───────────────────────────
                    const outcome = resolveOutcome(todayStockQuotes, i + 1, entry, target, stopLoss);

                    // ── Record result ─────────────────────────────
                    if (sessionStats[targets.session]) {
                        sessionStats[targets.session][outcome === "WIN" ? "wins" : "losses"]++;
                    }

                    if (outcome === "WIN") {
                        stats.wins++;
                        if (signalType === "BREAKDOWN")    { stats.breakdown.wins++;    breakdownWins++;    }
                        if (signalType === "VALUE_LOSS")   { stats.valueLoss.wins++;    valueLossWins++;    }
                        if (signalType === "OPENING_DRIVE"){ stats.openingDrive.wins++; openingDriveWins++; }
                    } else {
                        stats.losses++;
                        if (signalType === "BREAKDOWN")    { stats.breakdown.losses++;    breakdownLosses++;    }
                        if (signalType === "VALUE_LOSS")   { stats.valueLoss.losses++;    valueLossLosses++;    }
                        if (signalType === "OPENING_DRIVE"){ stats.openingDrive.losses++; openingDriveLosses++; }
                    }

                    tradedToday = true;
                }
            }

            totalWins   += stats.wins;
            totalLosses += stats.losses;

            const total = stats.wins + stats.losses;
            const wr    = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : "0.0";
            const odTotal = stats.openingDrive.wins + stats.openingDrive.losses;
            const odWR    = odTotal > 0 ? ((stats.openingDrive.wins / odTotal) * 100).toFixed(1) : "N/A";

            console.log(
                `📊 ${symbolKey.padEnd(12)} | Trades: ${String(total).padStart(3)} | Skipped: ${stats.skipped} | WR: ${wr.padStart(5)}% | ` +
                `BD: ${stats.breakdown.wins}W/${stats.breakdown.losses}L | ` +
                `VL: ${stats.valueLoss.wins}W/${stats.valueLoss.losses}L | ` +
                `OD: ${stats.openingDrive.wins}W/${stats.openingDrive.losses}L (${odWR}%)`
            );

        } catch (err) {
            console.error(`❌ ${symbolKey}: ${err.message}`);
            continue;
        }
    }

    // ── Summary ───────────────────────────────────────────────────
    const totalTrades = totalWins + totalLosses;
    const overallWR   = totalTrades > 0 ? ((totalWins / totalTrades) * 100).toFixed(2) : 0;
    const bdTotal     = breakdownWins  + breakdownLosses;
    const vlTotal     = valueLossWins  + valueLossLosses;
    const odTotal     = openingDriveWins + openingDriveLosses;

    console.log("\n" + "=".repeat(80));
    console.log(`🏆 BEARISH BACKTEST COMPLETE — Exact mirror of live bearish script`);
    console.log(`   Slippage modelled : -0.3% on entry (live LIMIT = price * 0.997)`);
    console.log(`   EOD resolution    : LOSS if neither target nor SL hit (conservative)`);
    console.log(`   One trade/stock/day enforced`);
    console.log("-".repeat(80));
    console.log(`📈 Total Trades   : ${totalTrades} | Skipped (too late): ${totalSkipped} | Overall WR: ${overallWR}%`);
    console.log(`📊 BREAKDOWN      : ${bdTotal}  trades | WR: ${bdTotal > 0 ? ((breakdownWins  / bdTotal) * 100).toFixed(2) : 0}%`);
    console.log(`🔄 VALUE LOSS     : ${vlTotal}  trades | WR: ${vlTotal > 0 ? ((valueLossWins  / vlTotal) * 100).toFixed(2) : 0}%`);
    console.log(`🚀 OPENING DRIVE  : ${odTotal}  trades | WR: ${odTotal > 0 ? ((openingDriveWins / odTotal) * 100).toFixed(2) : 0}%`);

    console.log("\n📐 BREAK-EVEN REFERENCE:");
    console.log(`   RR 2.0 → need 33.3% WR | RR 1.8 → need 35.7% | RR 1.7 → need 37.0%`);
    console.log(`   (Add ~3-5% for brokerage; effective break-even ~37-42%)`);

    console.log("\n📅 SESSION BREAKDOWN:");
    console.log("-".repeat(60));
    for (const [session, s] of Object.entries(sessionStats)) {
        const t  = s.wins + s.losses;
        if (t === 0) continue;
        const wr = ((s.wins / t) * 100).toFixed(2);
        console.log(`  ${session.padEnd(22)} | ${String(t).padStart(4)} trades | WR: ${wr.padStart(6)}% | ${s.wins}W / ${s.losses}L`);
    }

    console.log(`\n⚠️  NOTE: 2-day window = very small sample. historicalAvgVol has only`);
    console.log(`   1 reference candle → Opening Drive volume filter is unreliable.`);
    console.log(`   Use this for a quick signal-quality spot-check, not statistical conclusions.\n`);
    console.log("=".repeat(80) + "\n");
}

backtestBearishStrategy();