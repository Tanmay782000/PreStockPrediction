import yahooFinance from "yahoo-finance2";

const yf = yahooFinance;

// ---------------- SETTINGS & PICKS ----------------
let MY_PICKS = ["RELIANCE.NS", "HDFCBANK.NS", "INFY.NS", "TATASTEEL.NS"];
const SCAN_INTERVAL = 60000; // 1 Minute scan

// ---------------- TECHNICAL HELPERS ----------------
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const average = (arr) => arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

function isMarketOpen() {
  const now = new Date();
  const day = now.getDay(); 
  const time = now.getHours() * 100 + now.getMinutes();
  // Indian Market: Monday-Friday, 9:15 AM to 3:30 PM
  return day >= 1 && day <= 5 && time >= 915 && time <= 1530;
}

/**
 * Calculates ATR based on the most recent 15-minute candles.
 * This measures TODAY'S volatility, not yesterday's.
 */
function calculateIntradayATR(iQuotes, period = 20) {
  if (iQuotes.length < period + 1) return 0;
  
  let trs = [];
  // Take only the most recent candles needed for the period
  const recent = iQuotes.slice(-(period + 1));

  for (let i = 1; i < recent.length; i++) {
    const tr = Math.max(
      recent[i].high - recent[i].low,
      Math.abs(recent[i].high - recent[i - 1].close),
      Math.abs(recent[i].low - recent[i - 1].close)
    );
    trs.push(tr);
  }
  return average(trs);
}

// ---------------- CORE SIGNAL ENGINE ----------------
async function getExpertTimingSignal(symbol) {
  try {
    // We fetch 2 days of intraday to ensure we have 20+ candles even at 9:15 AM
    const intradayData = await yf.chart(symbol, { 
      period1: Math.floor(Date.now() / 1000) - (48 * 60 * 60), 
      interval: "15m" 
    });
    
    // We still need daily for the Gap Check
    const dailyData = await yf.chart(symbol, { 
      period1: Math.floor(Date.now() / 1000) - (5 * 24 * 60 * 60), 
      interval: "1d" 
    });

    const iQuotes = intradayData.quotes.filter(q => q.close && q.volume);
    const dQuotes = dailyData.quotes.filter(q => q.close);

    // Initial Data Guard
    if (dQuotes.length < 2 || iQuotes.length < 3) return { status: "WAITING", reason: "Syncing..." };

    // 1. GAP CHECK (Safety Filter)
    const yesterdayClose = dQuotes[dQuotes.length - 2].close;
    // Today's first candle is found by looking for the 09:15 timestamp
    const todayQuotes = iQuotes.filter(q => new Date(q.date).getHours() >= 9);
    if (todayQuotes.length === 0) return { status: "WAITING", reason: "Pre-Market" };

    const todayOpen = todayQuotes[0].open;
    const gapPercent = ((todayOpen - yesterdayClose) / yesterdayClose) * 100;

    if (gapPercent > 3.0) return { status: "REJECTED", reason: `High Gap (${gapPercent.toFixed(2)}%)` };

    // 2. INTRADAY ATR (Current Volatility)
    const atrValue = calculateIntradayATR(iQuotes, 20);

    // 3. MORNING RANGE & VWAP
    const morningRange = todayQuotes.slice(0, 2); // 9:15 and 9:30 candles
    if (morningRange.length < 2) return { status: "WAITING", reason: "Setting Morning Range..." };

    const morningHigh = Math.max(...morningRange.map(q => q.high));
    const avgMorningVol = (morningRange[0].volume + morningRange[1].volume) / 2;

    let totalVal = 0, totalVol = 0;
    todayQuotes.forEach(q => { totalVal += (q.close * q.volume); totalVol += q.volume; });
    const currentVWAP = totalVal / totalVol;

    // 4. CURRENT CANDLE ANALYSIS
    const lastCandle = todayQuotes[todayQuotes.length - 1];
    const prevCandle = todayQuotes.length > 1 ? todayQuotes[todayQuotes.length - 2] : lastCandle;
    const currentPrice = lastCandle.close;

    // 5. FILTERS (Breakout, Reversal, Volume, and Body)
    const isBreakout = currentPrice > morningHigh && currentPrice > currentVWAP;
    const isReclaimingValue = currentPrice > currentVWAP && prevCandle.close < currentVWAP;
    const hasVolumeSurge = lastCandle.volume > avgMorningVol * 1.1;

    const candleBodySize = Math.abs(lastCandle.close - lastCandle.open);
    const candleTotalRange = lastCandle.high - lastCandle.low;
    const isStrongCandle = candleTotalRange > 0 ? (candleBodySize / candleTotalRange) > 0.5 : false;

    // ---------------- FINAL DECISION ----------------
    if (hasVolumeSurge && isStrongCandle) {
      if (isBreakout || isReclaimingValue) {
        const type = isBreakout ? "BREAKOUT" : "REVERSAL";
        return {
          status: "TRIGGERED",
          type: type,
          symbol: symbol,
          price: currentPrice.toFixed(2),
          target: (currentPrice + (atrValue * 3.0)).toFixed(2),
          stopLoss: (currentPrice - (atrValue * 1.5)).toFixed(2),
          timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
        };
      }
    }

    return { status: "WAITING", price: currentPrice.toFixed(2), atr: atrValue.toFixed(2) };
  } catch (err) {
    return { status: "ERROR", message: err.message };
  }
}

// ---------------- MONITORING LOOP ----------------
async function runMonitor() {
  console.log("🛠️ Assassin Engine Live: Intraday ATR + Body Filter Enabled.");

  while (true) {
    if (!isMarketOpen()) {
      console.log(`😴 Market Closed. Sleeping...`);
      await sleep(60000); 
      continue;
    }

    console.log(`\n--- 🔍 Scan: ${new Date().toLocaleTimeString('en-IN')} ---`);

    for (let i = MY_PICKS.length - 1; i >= 0; i--) {
      const symbol = MY_PICKS[i];
      const res = await getExpertTimingSignal(symbol);

      if (res.status === "TRIGGERED") {
        console.log(`\n🔥 [${res.type}] SIGNAL: ${symbol} @ ₹${res.price}`);
        console.log(`⏰ Trigger Time: ${res.timestamp}`);
        console.log(`🎯 Target: ₹${res.target} | 🛑 SL: ₹${res.stopLoss}`);
        
        MY_PICKS.splice(i, 1); 
        console.log(`✅ ${symbol} secured. Removed from list.\n`);
        
      } else if (res.status === "REJECTED") {
        console.log(`🚫 ${symbol}: Rejected (${res.reason})`);
        MY_PICKS.splice(i, 1); 
      } else {
        process.stdout.write(`⏳ ${symbol.split('.')[0]}: ${res.price} (ATR: ${res.atr}) | `);
      }
    }

    process.stdout.write("\n");
    await sleep(SCAN_INTERVAL);
  }
}

runMonitor();