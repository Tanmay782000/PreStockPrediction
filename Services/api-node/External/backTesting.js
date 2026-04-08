import yahooFinance from "yahoo-finance2";
import { STOCKS } from "../Common/stockInfo.js";

const yf = new yahooFinance();

// ---------------- SETTINGS ----------------
const BACKTEST_STOCKS =  STOCKS.map(s => s.symbol); // Test on top 10 stocks for speed
const ATR_PERIOD = 20;

// ---------------- HELPERS ----------------
const average = (arr) => arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

function getHistoricalATR(allQuotes, currentIndex, period) {
    if (currentIndex < period) return 0;
    
    let trs = [];
    for (let i = currentIndex - period + 1; i <= currentIndex; i++) {
        const high = allQuotes[i].high;
        const low = allQuotes[i].low;
        const prevClose = allQuotes[i - 1].close;

        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        trs.push(tr);
    }
    return average(trs);
}

// ---------------- BACKTEST ENGINE ----------------
async function backtestStock(symbol) {
    try {
        const history = await yf.chart(symbol, {
            period1: Math.floor(Date.now() / 1000) - (59 * 24 * 60 * 60),
            interval: "15m"
        });

        const dailyHistory = await yf.chart(symbol, {
            period1: Math.floor(Date.now() / 1000) - (70 * 24 * 60 * 60),
            interval: "1d"
        });

        const all15mQuotes = history.quotes.filter(q => q.close && q.volume);
        const allDailyQuotes = dailyHistory.quotes.filter(q => q.close);

        const daysMap = {};
        all15mQuotes.forEach(q => {
            const dateStr = q.date.toISOString().split('T')[0];
            if (!daysMap[dateStr]) daysMap[dateStr] = [];
            daysMap[dateStr].push(q);
        });

        let stats = { wins: 0, losses: 0, skippedGap: 0, totalTrades: 0 };
        const dateKeys = Object.keys(daysMap);

        for (let d = 0; d < dateKeys.length; d++) {
            const todayStr = dateKeys[d];
            const todayQuotes = daysMap[todayStr];

            if (todayQuotes.length < 10) continue;

            const dailyIdx = allDailyQuotes.findIndex(dq => dq.date.toISOString().startsWith(todayStr));
            if (dailyIdx <= 0) continue;
            const yesterdayClose = allDailyQuotes[dailyIdx - 1].close;

            const todayOpen = todayQuotes[0].open;
            const gapPercent = ((todayOpen - yesterdayClose) / yesterdayClose) * 100;
            if (gapPercent > 3.0) {
                stats.skippedGap++;
                continue;
            }

            const morningHigh = Math.max(todayQuotes[0].high, todayQuotes[1].high);
            const avgMorningVol = (todayQuotes[0].volume + todayQuotes[1].volume) / 2;

            let vwapSumPV = 0;
            let vwapSumV = 0;

            for (let i = 0; i < todayQuotes.length; i++) {
                const candle = todayQuotes[i];
                vwapSumPV += (candle.close * candle.volume);
                vwapSumV += candle.volume;
                const currentVWAP = vwapSumPV / vwapSumV;

                if (i < 2) continue;

                const currentPrice = candle.close;
                const prevPrice = todayQuotes[i - 1].close;

                const globalIdx = all15mQuotes.findIndex(q => q.date === candle.date);
                const atrValue = getHistoricalATR(all15mQuotes, globalIdx, ATR_PERIOD);

                // --- FIXED VARIABLE NAMES HERE ---
                const isBreakout = currentPrice > morningHigh && currentPrice > currentVWAP;
                const isReclaimingValue = currentPrice > currentVWAP && prevPrice < currentVWAP;
                const hasVolume = candle.volume > avgMorningVol * 1.1;
                
                const body = Math.abs(candle.close - candle.open);
                const range = candle.high - candle.low;
                const isStrong = range > 0 ? (body / range) > 0.5 : false;

                // TRIGGER
                if (hasVolume && isStrong && (isBreakout || isReclaimingValue)) {
                    const entryPrice = currentPrice;
                    const stopLoss = entryPrice - (atrValue * 1.5);
                    const target = entryPrice + (atrValue * 3.0);

                    let dayOutcome = null;

                    for (let j = i + 1; j < todayQuotes.length; j++) {
                        if (todayQuotes[j].low <= stopLoss) {
                            dayOutcome = "LOSS";
                            break;
                        }
                        if (todayQuotes[j].high >= target) {
                            dayOutcome = "WIN";
                            break;
                        }
                    }

                    if (!dayOutcome) {
                        const closePrice = todayQuotes[todayQuotes.length - 1].close;
                        dayOutcome = closePrice > entryPrice ? "WIN" : "LOSS";
                    }

                    if (dayOutcome === "WIN") stats.wins++;
                    else stats.losses++;
                    
                    stats.totalTrades++;
                    break; 
                }
            }
        }

        return stats;
    } catch (err) {
        console.error(`Backtest Error [${symbol}]:`, err.message);
        return null;
    }
}

async function runBacktest() {
    console.log("🚀 Starting Corrected Backtest...");
    let totalW = 0;
    let totalL = 0;

    for (const stock of BACKTEST_STOCKS) {
        const res = await backtestStock(stock);
        if (res && res.totalTrades > 0) {
            const wr = ((res.wins / res.totalTrades) * 100).toFixed(2);
            console.log(`📈 ${stock.padEnd(12)} | Trades: ${res.totalTrades} | WinRate: ${wr}%`);
            totalW += res.wins;
            totalL += res.losses;
        }
    }

    const finalWR = ((totalW / (totalW + totalL)) * 100).toFixed(2);
    console.log(`\n🏆 FINAL ACCURACY: ${finalWR}% | Total Trades: ${totalW + totalL}`);
}

runBacktest();