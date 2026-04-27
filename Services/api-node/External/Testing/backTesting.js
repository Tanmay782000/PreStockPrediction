import { Bullish_SYMBOL_MAP } from '../../Common/stockInfo.js';
import yahooFinance from "yahoo-finance2";

const yf = new yahooFinance();

const TWO_DAYS_MS   = 2 * 24 * 60 * 60 * 1000;
const FIVE_DAYS_MS  = 5 * 24 * 60 * 60 * 1000; // enough to get yesterday's daily close
const START_DATE_DAILY = Math.floor((Date.now() - FIVE_DAYS_MS)  / 1000);
const START_DATE_15M   = Math.floor((Date.now() - TWO_DAYS_MS)   / 1000);

const average = (arr) =>
    arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

// ================================================================
//  TIME-ADJUSTED TARGETS — exact copy from live script
//  candleDate is passed as a real Date object (candle.date)
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
        if (hoursLeft >= 4.5) return { target: entryPrice * 1.0070, stopLoss: entryPrice * 0.9965, riskReward: "2.0", session: "EARLY DRIVE" };
        if (hoursLeft >= 3.0) return { target: entryPrice * 1.0060, stopLoss: entryPrice * 0.9970, riskReward: "2.0", session: "MID DRIVE" };
        return null;
    }

    if (signalType === "BREAKOUT") {
        if (hoursLeft >= 4.5) return { target: entryPrice * 1.0100, stopLoss: entryPrice * 0.9950, riskReward: "1.7", session: "EARLY BREAKOUT" };
        if (hoursLeft >= 3.0) return { target: entryPrice * 1.0080, stopLoss: entryPrice * 0.9960, riskReward: "1.8", session: "MID BREAKOUT" };
        return null; // late breakout → skip (33% WR proven bad)
    }

    if (signalType === "REVERSAL") {
        if (hoursLeft >= 4.5) return { target: entryPrice * 1.0070, stopLoss: entryPrice * 0.9965, riskReward: "2.0", session: "EARLY REVERSAL" };
        if (hoursLeft >= 3.0) return { target: entryPrice * 1.0100, stopLoss: entryPrice * 0.9950, riskReward: "1.8", session: "MID REVERSAL" };
        return        { target: entryPrice * 1.0070, stopLoss: entryPrice * 0.9965, riskReward: "2.0", session: "LATE REVERSAL" };
    }

    return { target: entryPrice * 1.0070, stopLoss: entryPrice * 0.9965, riskReward: "1.7", session: "DEFAULT" };
}

// ================================================================
//  NIFTY BULLISH CHECK — mirrors getNiftySentiment() in live script
//  Uses a single Nifty candle at index i (same position as stock candle)
//  Running VWAP computed up to candle i (not full-day, same as live
//  which computes VWAP from all todayQuotes at scan time → approximated
//  here as cumulative to avoid look-ahead)
// ================================================================
function isNiftyBullish(todayNiftyQuotes, candleIdx, yesterdayNiftyClose) {
    if (!todayNiftyQuotes[candleIdx]) return false;

    // Compute VWAP from candle 0 → candleIdx (mirrors live: all todayQuotes)
    let tVal = 0, tVol = 0;
    for (let k = 0; k <= candleIdx; k++) {
        const q = todayNiftyQuotes[k];
        tVal += q.close * (q.volume || 1);
        tVol += (q.volume || 1);
    }
    const vwap = tVal / tVol;

    const nCandle    = todayNiftyQuotes[candleIdx];
    const close      = nCandle.close;
    const open       = nCandle.open;
    const high       = nCandle.high;
    const low        = nCandle.low;

    const isAbovePrev  = close > yesterdayNiftyClose;
    const isAboveVWAP  = close > vwap * 0.9998;
    const bodyToRange  = (high - low) > 0 ? Math.abs(close - open) / (high - low) : 0;
    const isStrong     = bodyToRange > 0.3;

    return isAbovePrev && (isAboveVWAP || isStrong);
}

// ================================================================
//  HISTORICAL OPENING VOLUME — same logic as live script
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
//  SIMULATE SLIPPAGE — mirrors live limitPrice = price * 1.003
//  Backtest enters at candle close * 1.003, same as live LIMIT order
// ================================================================
function applySlippage(price) {
    return price * 1.003;
}

// ================================================================
//  OUTCOME RESOLUTION
//  Checks subsequent candles for SL or target hit.
//  If neither hit by EOD → only counts as WIN if close >= target
//  (not just close > entry — fixes inflated WR from old script)
// ================================================================
function resolveOutcome(quotes, fromIdx, entry, target, stopLoss) {
    for (let j = fromIdx; j < quotes.length; j++) {
        if (quotes[j].low  <= stopLoss) return "LOSS";
        if (quotes[j].high >= target)   return "WIN";
    }
    // EOD: not hit either way — conservative: count as LOSS
    // (live ROBO order squares off at market; rarely hits exact target at close)
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

    // ── Aggregate counters ────────────────────────────────────────
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
        const niftyIntra  = await yf.chart("^NSEI", { period1: START_DATE_15M,   interval: "15m" });
        const niftyDaily  = await yf.chart("^NSEI", { period1: START_DATE_DAILY, interval: "1d"  });
        allNiftyQuotes    = niftyIntra.quotes.filter(q => q.close);
        allNiftyDaily     = niftyDaily.quotes.filter(q => q.close);
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
                breakout:     { wins: 0, losses: 0 },
                reversal:     { wins: 0, losses: 0 },
                openingDrive: { wins: 0, losses: 0 },
            };

            // ── Per-day loop ──────────────────────────────────────
            for (const todayStr of Object.keys(daysMap).sort()) {
                const todayStockQuotes = daysMap[todayStr];

                // Mirror live: need at least 3 candles
                if (todayStockQuotes.length < 3) continue;

                // Get today's Nifty candles (same date)
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

                // ── Gap filter — mirrors live script ──────────────
                const gapPercent = ((todayStockQuotes[0].open - yesterdayStockClose) / yesterdayStockClose) * 100;
                if (gapPercent > 5.0) continue;

                // ── Morning reference values — mirrors live ────────
                const firstCandle  = todayStockQuotes[0];
                const secondCandle = todayStockQuotes[1];
                const morningHigh  = Math.max(firstCandle.high, secondCandle.high);
                const avgMorningVol = (firstCandle.volume + secondCandle.volume) / 2;

                // ── Historical opening volume — mirrors live ───────
                const historicalAvgVol = getHistoricalOpeningVolume(allStockQuotes, todayStr);

                // ── Opening Drive check — mirrors live exactly ─────
                // Live checks: firstCandle, secondCandle, then lastCandle
                // In live, lastCandle is whatever candle triggered the cron
                // In backtest we scan every candle from index 2 onward as potential "lastCandle"
                // to find the earliest trigger — same as live would find it candle by candle

                const firstBody      = Math.abs(firstCandle.close - firstCandle.open);
                const firstRange     = firstCandle.high - firstCandle.low;
                const firstBodyRatio = firstRange > 0 ? firstBody / firstRange : 0;

                // Candle 1 + 2 conditions (static per day)
                const openingDriveBase =
                    historicalAvgVol > 0 &&
                    firstCandle.close > firstCandle.open &&   // candle 1 green
                    firstBodyRatio > 0.6 &&                    // strong body
                    firstCandle.volume > historicalAvgVol * 2.0 && // 2x hist vol
                    secondCandle.close > secondCandle.open;   // candle 2 green

                let tradedToday = false;

                // Scan from candle index 2 onward (lastCandle in live)
                for (let i = 2; i < todayStockQuotes.length; i++) {
                    if (tradedToday) break;

                    const lastCandle = todayStockQuotes[i];
                    const prevCandle = todayStockQuotes[i - 1];

                    // ── VWAP: computed over all today's candles UP TO i ──
                    // Live computes VWAP from ALL todayQuotes at scan time.
                    // Since live runs at candle close, all candles 0→i are final.
                    let sVal = 0, sVol = 0;
                    for (let k = 0; k <= i; k++) {
                        sVal += todayStockQuotes[k].close * todayStockQuotes[k].volume;
                        sVol += todayStockQuotes[k].volume;
                    }
                    const stockVWAP = sVal / sVol;

                    // ── Nifty sentiment at this candle index ──────
                    // Use same index i — if Nifty has fewer candles, skip
                    const niftyOk = isNiftyBullish(todayNiftyQuotes, i, yesterdayNiftyClose);
                    if (!niftyOk) continue;

                    // ── Signal conditions — exact copy of live ────
                    const isBullishCandle = lastCandle.close > lastCandle.open;

                    // BREAKOUT
                    const morningRange = Math.max(firstCandle.high, secondCandle.high)
                                       - Math.min(firstCandle.low,  secondCandle.low);
                    const isMeaningfulMorningRange = morningRange > lastCandle.close * 0.003;

                    const isBreakout =
                        isBullishCandle &&
                        isMeaningfulMorningRange &&
                        lastCandle.close > morningHigh * 1.001 &&  // meaningful break
                        prevCandle.close <= morningHigh &&          // first candle to break
                        lastCandle.close > stockVWAP;               // above VWAP

                    // REVERSAL (reclaimingValue)
                    const candleMid     = (lastCandle.high + lastCandle.low) / 2;
                    const testedVWAP    = lastCandle.low <= stockVWAP * 1.0008;
                    const closeAboveMid = lastCandle.close > candleMid;

                    const isReclaimingValue =
                        isBullishCandle &&
                        prevCandle.close < stockVWAP &&             // was below VWAP
                        lastCandle.close > stockVWAP * 1.0005 &&   // meaningful close above
                        testedVWAP &&                               // wick dipped into VWAP
                        closeAboveMid;                              // closed upper half

                    // Volume + candle strength — exact thresholds from live
                    const hasVolumeSurge = lastCandle.volume > avgMorningVol * 1.5;
                    const sBody = Math.abs(lastCandle.close - lastCandle.open);
                    const sRange = lastCandle.high - lastCandle.low;
                    const isStrongCandle = isBullishCandle && (sRange > 0 ? sBody / sRange > 0.5 : false);

                    // OPENING DRIVE: candle 1+2 base + lastCandle conditions
                    const isOpeningDrive =
                        openingDriveBase &&
                        lastCandle.close > lastCandle.open &&  // lastCandle green
                        lastCandle.close > stockVWAP &&        // above VWAP
                        lastCandle.close > firstCandle.open;   // above opening price

                    const isRegularSignal      = hasVolumeSurge && isStrongCandle && (isReclaimingValue);
                    const isOpeningDriveSignal = isOpeningDrive && isStrongCandle;

                    if (!isRegularSignal && !isOpeningDriveSignal) continue;

                    // ── Signal fired — determine type ─────────────
                    const signalType = isBreakout
                        ? "BREAKOUT"
                        : isOpeningDriveSignal
                            ? "OPENING_DRIVE"
                            : "REVERSAL";

                    // ── Time-adjusted targets ─────────────────────
                    const targets = getTimeAdjustedTargets(lastCandle.close, signalType, lastCandle.date);
                    if (!targets) { stats.skipped++; totalSkipped++; break; } // too late → skip day

                    // ── Apply slippage (mirrors live limitPrice * 1.003) ──
                    const entry    = applySlippage(lastCandle.close);
                    // Recalculate target/SL from slippage-adjusted entry
                    // (live calculates squareoffDiff = target - limitPrice)
                    const target   = applySlippage(lastCandle.close) * (targets.target   / lastCandle.close);
                    const stopLoss = applySlippage(lastCandle.close) * (targets.stopLoss / lastCandle.close);

                    // ── Resolve outcome from next candle onward ───
                    const outcome = resolveOutcome(todayStockQuotes, i + 1, entry, target, stopLoss);

                    // ── Record result ─────────────────────────────
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

                    tradedToday = true; // one trade per stock per day (mirrors live DB cap)
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

    // Break-even WR at each RR (after slippage already baked into entry)
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