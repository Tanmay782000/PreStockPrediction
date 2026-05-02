import { Bullish_SYMBOL_MAP } from '../../Common/stockInfo.js';
import yahooFinance from "yahoo-finance2";

const yf = new yahooFinance();

const TWO_DAYS_MS      = 5 * 24 * 60 * 60 * 1000;
const FIVE_DAYS_MS     = 5 * 24 * 60 * 60 * 1000;
const START_DATE_DAILY = Math.floor((Date.now() - FIVE_DAYS_MS) / 1000);
const START_DATE_15M   = Math.floor((Date.now() - TWO_DAYS_MS)  / 1000);

const average = (arr) =>
    arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

// ================================================================
//  HELPERS — ported from live bullish script
// ================================================================
function toISTDateStr(date) {
    return new Date(date).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function isISTToday(date, todayStr) {
    return toISTDateStr(date) === todayStr;
}

function validateCandleInterval(quotes, expectedMinutes = 15) {
    if (quotes.length < 2) return false;
    const diffs = [];
    for (let i = 1; i < Math.min(quotes.length, 5); i++) {
        const diff = (new Date(quotes[i].date) - new Date(quotes[i - 1].date)) / 60000;
        diffs.push(diff);
    }
    const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    return Math.abs(avg - expectedMinutes) < 2;
}

// ================================================================
//  TIME-ADJUSTED TARGETS — exact mirror of live bullish script
//  FIX: percentages now match live (flat 1.010 / 0.994 across all types/sessions)
// ================================================================
function getTimeAdjustedTargets(entryPrice, signalType, candleDate) {
    const istTime   = new Date(candleDate.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const minutesLeft = (15 * 60 + 15) - (istTime.getHours() * 60 + istTime.getMinutes());
    const hoursLeft   = minutesLeft / 60;

    if (hoursLeft < 2.0) return null;

    if (signalType === "OPENING_DRIVE") {
        if (hoursLeft >= 4.5) return { target: entryPrice * 1.010, stopLoss: entryPrice * 0.994, riskReward: "2.0", session: "EARLY DRIVE" };
        if (hoursLeft >= 3.0) return { target: entryPrice * 1.010, stopLoss: entryPrice * 0.994, riskReward: "2.0", session: "MID DRIVE" };
        return null;
    }

    if (signalType === "BREAKOUT") {
        if (hoursLeft >= 4.5) return { target: entryPrice * 1.010, stopLoss: entryPrice * 0.994, riskReward: "1.7", session: "EARLY BREAKOUT" };
        if (hoursLeft >= 3.0) return { target: entryPrice * 1.010, stopLoss: entryPrice * 0.994, riskReward: "1.8", session: "MID BREAKOUT" };
        return null;
    }

    if (signalType === "REVERSAL") {
        if (hoursLeft >= 4.5) return { target: entryPrice * 1.010, stopLoss: entryPrice * 0.994, riskReward: "2.0", session: "EARLY REVERSAL" };
        if (hoursLeft >= 3.0) return { target: entryPrice * 1.010, stopLoss: entryPrice * 0.994, riskReward: "1.8", session: "MID REVERSAL" };
        return        { target: entryPrice * 1.010, stopLoss: entryPrice * 0.994, riskReward: "2.0", session: "LATE REVERSAL" };
    }

    return { target: entryPrice * 1.007, stopLoss: entryPrice * 0.9965, riskReward: "1.7", session: "DEFAULT" };
}

// ================================================================
//  NIFTY BULLISH CHECK — mirrors getNiftySentiment() in live script
//  Cumulative VWAP up to candleIdx (no look-ahead)
// ================================================================
function isNiftyBullish(todayNiftyQuotes, candleIdx, yesterdayNiftyClose) {
    if (!todayNiftyQuotes[candleIdx]) return false;

    let tVal = 0, tVol = 0;
    for (let k = 0; k <= candleIdx; k++) {
        const q = todayNiftyQuotes[k];
        tVal += q.close * (q.volume || 1);
        tVol += (q.volume || 1);
    }
    const vwap = tVal / tVol;

    const { close, open, high, low } = todayNiftyQuotes[candleIdx];

    const isAbovePrev = close > yesterdayNiftyClose;
    const isAboveVWAP = close > vwap * 0.9998;
    const bodyToRange = (high - low) > 0 ? Math.abs(close - open) / (high - low) : 0;
    const isStrong    = bodyToRange > 0.3;

    return isAbovePrev && (isAboveVWAP || isStrong);
}

// ================================================================
//  HISTORICAL OPENING VOLUME — mirrors live script
//  FIX: uses isISTToday() helper and falls back to firstCandle.volume
//       when no historical candles found (mirrors live fallback)
// ================================================================
function getHistoricalOpeningVolume(allStockQuotes, todayStr, firstCandleVolume) {
    const openingCandles = allStockQuotes.filter(q => {
        if (isISTToday(q.date, todayStr)) return false;
        const ist = new Date(q.date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        return ist.getHours() === 9 && ist.getMinutes() === 15;
    });
    // FIX: fallback to firstCandle.volume when no historical candles (mirrors live)
    return openingCandles.length > 0
        ? average(openingCandles.map(q => q.volume))
        : firstCandleVolume;
}

// ================================================================
//  SIMULATE SLIPPAGE — mirrors live limitPrice = price * 1.003
// ================================================================
function applySlippage(price) {
    return price * 1.003;
}

// ================================================================
//  OUTCOME RESOLUTION
//  Conservative: EOD with neither target nor SL hit → LOSS
// ================================================================
function resolveOutcome(quotes, fromIdx, entry, target, stopLoss) {
    for (let j = fromIdx; j < quotes.length; j++) {
        if (quotes[j].low  <= stopLoss) return "LOSS";
        if (quotes[j].high >= target)   return "WIN";
    }
    return "LOSS";
}

// ================================================================
//  MAIN BACKTEST
// ================================================================
async function backtestStrategy() {
    console.log("🚀 Backtest — Exact Mirror of Live Bullish Script");
    console.log(`📅 Period: Last 2 days intraday (15m) | Slippage: +0.3% on entry\n`);

    const stockEntries = Object.entries(Bullish_SYMBOL_MAP);
    console.log(`📊 Processing ${stockEntries.length} stocks...\n`);

    let totalWins = 0, totalLosses = 0, totalSkipped = 0;
    let breakoutWins = 0, breakoutLosses = 0;
    let reversalWins = 0, reversalLosses = 0;
    let openingDriveWins = 0, openingDriveLosses = 0;

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

            // FIX: validate interval — catch Yahoo returning 1m candles (mirrors live)
            if (!validateCandleInterval(allStockQuotes, 15)) {
                const actualInterval = (
                    (new Date(allStockQuotes[1].date) - new Date(allStockQuotes[0].date)) / 60000
                ).toFixed(0);
                console.log(`⚠️  ${symbolKey}: wrong interval (${actualInterval}m) — skipping`);
                continue;
            }

            // Group 15m candles by IST date string
            // FIX: use toISTDateStr() helper instead of inline date conversion
            const daysMap = {};
            allStockQuotes.forEach(q => {
                const dateStr = toISTDateStr(q.date);
                if (!daysMap[dateStr]) daysMap[dateStr] = [];
                daysMap[dateStr].push(q);
            });

            let stats = {
                wins: 0, losses: 0, skipped: 0,
                breakout:     { wins: 0, losses: 0 },
                reversal:     { wins: 0, losses: 0 },
                openingDrive: { wins: 0, losses: 0 },
            };

            // ── Per-day loop ──────────────────────────────────────
            for (const todayStr of Object.keys(daysMap).sort()) {
                const todayStockQuotes = daysMap[todayStr];

                if (todayStockQuotes.length < 3) continue;

                // Get today's Nifty candles (same IST date)
                // FIX: use isISTToday() helper
                const todayNiftyQuotes = allNiftyQuotes.filter(q => isISTToday(q.date, todayStr));

                if (todayNiftyQuotes.length < 3) continue;

                // Yesterday's closes
                const nDailyIdx = allNiftyDaily.findIndex(q => isISTToday(q.date, todayStr));
                if (nDailyIdx <= 0) continue;
                const yesterdayNiftyClose = allNiftyDaily[nDailyIdx - 1].close;

                const sDailyIdx = allDailyQuotes.findIndex(q => isISTToday(q.date, todayStr));
                if (sDailyIdx <= 0) continue;
                const yesterdayStockClose = allDailyQuotes[sDailyIdx - 1].close;

                // Gap filter — mirrors live
                const gapPercent = ((todayStockQuotes[0].open - yesterdayStockClose) / yesterdayStockClose) * 100;
                if (gapPercent > 5.0) continue;

                // Morning reference values — mirrors live
                const firstCandle   = todayStockQuotes[0];
                const secondCandle  = todayStockQuotes[1];
                const morningHigh   = Math.max(firstCandle.high, secondCandle.high);
                const avgMorningVol = (firstCandle.volume + secondCandle.volume) / 2;

                // FIX: pass firstCandle.volume as fallback (mirrors live historicalAvgVol fallback)
                const historicalAvgVol = getHistoricalOpeningVolume(
                    allStockQuotes, todayStr, firstCandle.volume
                );

                let tradedToday = false;

                // Scan from candle index 2 onward
                for (let i = 2; i < todayStockQuotes.length; i++) {
                    if (tradedToday) break;

                    const lastCandle = todayStockQuotes[i];
                    const prevCandle = todayStockQuotes[i - 1];

                    // Cumulative VWAP up to candle i (no look-ahead)
                    let sVal = 0, sVol = 0;
                    for (let k = 0; k <= i; k++) {
                        sVal += todayStockQuotes[k].close * todayStockQuotes[k].volume;
                        sVol += todayStockQuotes[k].volume;
                    }
                    const stockVWAP = sVol > 0 ? sVal / sVol : 0;

                    // Nifty sentiment at this candle index
                    const niftyOk = isNiftyBullish(todayNiftyQuotes, i, yesterdayNiftyClose);
                    if (!niftyOk) continue;

                    // ── Signal conditions — exact mirror of live ──
                    const isBullishCandle = lastCandle.close > lastCandle.open;

                    // BREAKOUT
                    const morningRange =
                        Math.max(firstCandle.high, secondCandle.high) -
                        Math.min(firstCandle.low,  secondCandle.low);
                    const isMeaningfulMorningRange = morningRange > lastCandle.close * 0.003;

                    const isBreakout =
                        isBullishCandle &&
                        isMeaningfulMorningRange &&
                        lastCandle.close > morningHigh * 1.001 &&
                        prevCandle.close <= morningHigh &&
                        lastCandle.close > stockVWAP;

                    // REVERSAL (reclaimingValue)
                    const candleMid     = (lastCandle.high + lastCandle.low) / 2;
                    const testedVWAP    = lastCandle.low <= stockVWAP * 1.0008;
                    const closeAboveMid = lastCandle.close > candleMid;

                    const isReclaimingValue =
                        isBullishCandle &&
                        prevCandle.close < stockVWAP &&
                        lastCandle.close > stockVWAP * 1.0005 &&
                        testedVWAP &&
                        closeAboveMid;

                    // Volume + candle strength
                    const hasVolumeSurge = lastCandle.volume > avgMorningVol * 1.5;
                    const sBody = Math.abs(lastCandle.close - lastCandle.open);
                    const sRange = lastCandle.high - lastCandle.low;
                    const isStrongCandle = isBullishCandle && (sRange > 0 ? sBody / sRange > 0.5 : false);

                    // FIX: OPENING DRIVE — mirrors live exactly:
                    //   firstCandle.close > firstCandle.open (green)
                    //   firstCandle.volume > historicalAvgVol * 1.5  (was 2.0x, removed secondCandle check)
                    //   lastCandle.close > firstCandle.open           (still holding above open)
                    //   lastCandle.close > stockVWAP                  (above VWAP)
                    //   Removed: firstBodyRatio > 0.6, secondCandle.close > secondCandle.open
                    const isOpeningDrive =
                        firstCandle.close > firstCandle.open &&
                        firstCandle.volume > historicalAvgVol * 1.5 &&
                        lastCandle.close > firstCandle.open &&
                        lastCandle.close > stockVWAP;

                    // FIX: isRegularSignal now includes isBreakout (was missing)
                    const isRegularSignal      = hasVolumeSurge && isStrongCandle && (isBreakout || isReclaimingValue);
                    const isOpeningDriveSignal = isOpeningDrive && isStrongCandle;

                    if (!isRegularSignal && !isOpeningDriveSignal) continue;

                    // Signal type — mirrors live priority order
                    const signalType = isBreakout
                        ? "BREAKOUT"
                        : isOpeningDriveSignal
                            ? "OPENING_DRIVE"
                            : "REVERSAL";

                    // Time-adjusted targets (calculated from raw lastCandle.close)
                    const targets = getTimeAdjustedTargets(lastCandle.close, signalType, lastCandle.date);
                    if (!targets) { stats.skipped++; totalSkipped++; break; }

                    // FIX: apply slippage to get actual entry, then compute
                    //   target and SL directly from entry — no ratio rescaling.
                    //   Live: limitPrice = price * 1.003
                    //         squareoffDiff = target - limitPrice
                    //         stoplossDiff  = limitPrice - stopLoss
                    //   So effective target = limitPrice + squareoffDiff = limitPrice * (target_pct)
                    //   Cleanest mirror: recalculate targets from entry directly.
                    const entry    = applySlippage(lastCandle.close);
                    const targetPct  = targets.target   / lastCandle.close; // e.g. 1.010
                    const slPct      = targets.stopLoss / lastCandle.close; // e.g. 0.994
                    const target     = entry * targetPct;
                    const stopLoss   = entry * slPct;

                    // Resolve outcome from next candle onward
                    const outcome = resolveOutcome(todayStockQuotes, i + 1, entry, target, stopLoss);

                    if (sessionStats[targets.session]) {
                        sessionStats[targets.session][outcome === "WIN" ? "wins" : "losses"]++;
                    }

                    if (outcome === "WIN") {
                        stats.wins++;
                        if (signalType === "BREAKOUT")      { stats.breakout.wins++;     breakoutWins++;     }
                        if (signalType === "REVERSAL")      { stats.reversal.wins++;     reversalWins++;     }
                        if (signalType === "OPENING_DRIVE") { stats.openingDrive.wins++; openingDriveWins++; }
                    } else {
                        stats.losses++;
                        if (signalType === "BREAKOUT")      { stats.breakout.losses++;     breakoutLosses++;     }
                        if (signalType === "REVERSAL")      { stats.reversal.losses++;     reversalLosses++;     }
                        if (signalType === "OPENING_DRIVE") { stats.openingDrive.losses++; openingDriveLosses++; }
                    }

                    tradedToday = true;
                }
            }

            totalWins   += stats.wins;
            totalLosses += stats.losses;

            const total  = stats.wins + stats.losses;
            const wr     = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : "0.0";
            const odTotal = stats.openingDrive.wins + stats.openingDrive.losses;
            const odWR    = odTotal > 0 ? ((stats.openingDrive.wins / odTotal) * 100).toFixed(1) : "N/A";

            console.log(
                `📊 ${symbolKey.padEnd(12)} | Trades: ${String(total).padStart(3)} | Skipped: ${stats.skipped} | WR: ${wr.padStart(5)}% | ` +
                `BO: ${stats.breakout.wins}W/${stats.breakout.losses}L | ` +
                `REV: ${stats.reversal.wins}W/${stats.reversal.losses}L | ` +
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
    const boTotal     = breakoutWins + breakoutLosses;
    const revTotal    = reversalWins + reversalLosses;
    const odTotal     = openingDriveWins + openingDriveLosses;

    console.log("\n" + "=".repeat(80));
    console.log(`🏆 BACKTEST COMPLETE — Exact mirror of live script`);
    console.log(`   Slippage modelled : +0.3% on entry (live LIMIT = price * 1.003)`);
    console.log(`   EOD resolution    : LOSS if neither target nor SL hit (conservative)`);
    console.log(`   One trade/stock/day enforced`);
    console.log("-".repeat(80));
    console.log(`📈 Total Trades  : ${totalTrades} | Skipped (too late): ${totalSkipped} | Overall WR: ${overallWR}%`);
    console.log(`📊 BREAKOUT      : ${boTotal}  trades | WR: ${boTotal  > 0 ? ((breakoutWins  / boTotal)  * 100).toFixed(2) : 0}%`);
    console.log(`🔄 REVERSAL      : ${revTotal} trades | WR: ${revTotal > 0 ? ((reversalWins  / revTotal) * 100).toFixed(2) : 0}%`);
    console.log(`🚀 OPENING DRIVE : ${odTotal}  trades | WR: ${odTotal  > 0 ? ((openingDriveWins / odTotal) * 100).toFixed(2) : 0}%`);

    console.log("\n📐 BREAK-EVEN REFERENCE:");
    console.log(`   RR 2.0 → need 33.3% WR | RR 1.8 → need 35.7% | RR 1.7 → need 37.0%`);
    console.log(`   (Add ~3-5% for brokerage; effective break-even ~37-42%)`);

    console.log("\n📅 SESSION BREAKDOWN:");
    console.log("-".repeat(60));
    for (const [session, s] of Object.entries(sessionStats)) {
        const t  = s.wins + s.losses;
        if (t === 0) continue;
        const wr = ((s.wins / t) * 100).toFixed(2);
        console.log(`  ${session.padEnd(20)} | ${String(t).padStart(4)} trades | WR: ${wr.padStart(6)}% | ${s.wins}W / ${s.losses}L`);
    }
    console.log(`\n⚠️  NOTE: 2-day window = very small sample. historicalAvgVol has only`);
    console.log(`   1 reference candle → Opening Drive volume filter is unreliable.`);
    console.log(`   Use this for a quick signal-quality spot-check, not statistical conclusions.\n`);
    console.log("=".repeat(80) + "\n");
}

backtestStrategy();