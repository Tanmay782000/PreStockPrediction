import yahooFinance from "yahoo-finance2";
const yf = new yahooFinance();

// ---------------- SETTINGS & PICKS ----------------
let MY_PICKS = ["RAMCOCEM.NS", "APLAPOLLO.NS", "TITAN.NS", "MANAPPURAM.NS"];

// ---------------- TECHNICAL HELPERS ----------------
const average = (arr) =>
  arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

function calculateIntradayATR(iQuotes, period = 20) {
  if (iQuotes.length < period + 1) return 0;
  let trs = [];
  const recent = iQuotes.slice(-(period + 1));

  for (let i = 1; i < recent.length; i++) {
    const tr = Math.max(
      recent[i].high - recent[i].low,
      Math.abs(recent[i].high - recent[i - 1].close),
      Math.abs(recent[i].low - recent[i - 1].close),
    );
    trs.push(tr);
  }
  return average(trs);
}

// ---------------- NIFTY SENTIMENT ENGINE ----------------
async function getNiftySentiment() {
  try {
    const niftyIntraday = await yf.chart("^NSEI", {
      interval: "15m",
      period1: Math.floor(Date.now() / 1000) - 24 * 60 * 60,
    });

    const niftyDaily = await yf.chart("^NSEI", {
      interval: "1d",
      period1: Math.floor(Date.now() / 1000) - 5 * 24 * 60 * 60,
    });

    const iQuotes = niftyIntraday.quotes.filter((q) => q.close);
    const dQuotes = niftyDaily.quotes.filter((q) => q.close);
    const todayStr = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });

    const todayQuotes = iQuotes.filter((q) =>
      new Date(q.date).toISOString().startsWith(todayStr),
    );

    if (todayQuotes.length === 0)
      return { isBullish: false, reason: "Market Not Open" };

    const yesterdayClose = dQuotes[dQuotes.length - 2].close;
    const lastCandle = todayQuotes[todayQuotes.length - 1];

    let tVal = 0, tVol = 0;
    todayQuotes.forEach((q) => {
      tVal += q.close * (q.volume || 1);
      tVol += q.volume || 1;
    });

    const currentVWAP = tVal / tVol;
    const body = Math.abs(lastCandle.close - lastCandle.open);
    const range = lastCandle.high - lastCandle.low;
    const isStrongBody = range > 0 ? body / range > 0.5 : false;

    const isBullish =
      lastCandle.close > yesterdayClose &&
      lastCandle.close > currentVWAP &&
      isStrongBody;

    return {
      isBullish,
      price: lastCandle.close.toFixed(2),
      vwap: currentVWAP.toFixed(2),
      status: isBullish ? "🟢 STRONG" : "🔴 WEAK",
    };
  } catch (err) {
    return { isBullish: false, status: "ERR" };
  }
}

// ---------------- CORE SIGNAL ENGINE ----------------
async function getExpertTimingSignal(symbol, niftyStatus) {
  try {
    if (!niftyStatus.isBullish) {
      return { status: "WAITING", reason: "Nifty Bearish/Weak" };
    }

    const intradayData = await yf.chart(symbol, {
      period1: Math.floor(Date.now() / 1000) - 48 * 60 * 60,
      interval: "15m",
    });

    const dailyData = await yf.chart(symbol, {
      period1: Math.floor(Date.now() / 1000) - 5 * 24 * 60 * 60,
      interval: "1d",
    });

    const iQuotes = intradayData.quotes.filter((q) => q.close && q.volume);
    const dQuotes = dailyData.quotes.filter((q) => q.close);
    const todayStr = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });

    const todayQuotes = iQuotes.filter((q) =>
      new Date(q.date).toISOString().startsWith(todayStr),
    );

    if (todayQuotes.length < 3)
      return { status: "WAITING", reason: `Data Sync (${todayQuotes.length}/3)` };

    const yesterdayClose = dQuotes[dQuotes.length - 2].close;
    const gapPercent = ((todayQuotes[0].open - yesterdayClose) / yesterdayClose) * 100;

    if (gapPercent > 3.0) return { status: "REJECTED", reason: "High Gap" };
    
    const morningHigh = Math.max(todayQuotes[0].high, todayQuotes[1].high);
    const avgMorningVol = (todayQuotes[0].volume + todayQuotes[1].volume) / 2;

    let sVal = 0, sVol = 0;
    todayQuotes.forEach((q) => {
      sVal += q.close * q.volume;
      sVol += q.volume;
    });

    const stockVWAP = sVal / sVol;
    const lastCandle = todayQuotes[todayQuotes.length - 1];
    const prevCandle = todayQuotes[todayQuotes.length - 2];

    const isBreakout = lastCandle.close > morningHigh && lastCandle.close > stockVWAP;
    const isReclaimingValue = lastCandle.close > stockVWAP && prevCandle.close < stockVWAP;
    const hasVolumeSurge = lastCandle.volume > avgMorningVol * 1.1;
    const sBody = Math.abs(lastCandle.close - lastCandle.open);
    const sRange = lastCandle.high - lastCandle.low;
    const isStrongCandle = sRange > 0 ? sBody / sRange > 0.5 : false;

    if (hasVolumeSurge && isStrongCandle && (isBreakout || isReclaimingValue)) {
      const atrValue = calculateIntradayATR(iQuotes, 20);
      let showDate = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      });
      return {
        status: "TRIGGERED",
        type: isBreakout ? "BREAKOUT" : "REVERSAL",
        symbol: symbol,
        price: lastCandle.close.toFixed(2),
        time: showDate,
        date: todayStr,
        target: (lastCandle.close + atrValue * 3.0).toFixed(2),
        stopLoss: (lastCandle.close - atrValue * 1.5).toFixed(2),
      };
    }

    return { status: "WAITING", price: lastCandle.close.toFixed(2) };
  } catch (err) {
    return { status: "ERROR", message: err.message };
  }
}

// ---------------- SINGLE EXECUTION RUN ----------------
export const cron = async () => {
  const time = new Date().toLocaleString("en-IN", {
  timeZone: "Asia/Kolkata",
});
  console.log(`🔍 Execution Start: ${time}`);
  
  const nifty = await getNiftySentiment();
  console.log(`NIFTY Status: ${nifty.status} (${nifty.price})`);

  for (const symbol of MY_PICKS) {
    const res = await getExpertTimingSignal(symbol, nifty);
    
    if (res.status === "TRIGGERED") {
      console.log("TIME: ", res.time)
      console.log("Date: ", res.date)
      console.log(`🔥 [${res.type}] SIGNAL: ${symbol} @ ₹${res.price}`);
      console.log(`🎯 TARGET: ₹${res.target} | 🛑 SL: ₹${res.stopLoss}`);
    } else if (res.status === "REJECTED") {
      console.log(`🚫 ${symbol}: Rejected (${res.reason})`);
    } else {
      console.log(`⏳ ${symbol}: ${res.price || "Syncing"} [${res.reason || "Waiting"}]`);
    }
  }
  
  console.log("🔍 Execution Complete.");
}