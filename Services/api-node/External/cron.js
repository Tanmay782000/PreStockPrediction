import yahooFinance from "yahoo-finance2";
import { STOCKS } from "../Common/stockInfo.js";

const yf = new yahooFinance();

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function calculateReturns(closes, period) {
  const len = closes.length;
  if (len < period + 1) return 0;
  return (
    (closes[len - 1] - closes[len - period - 1]) / closes[len - period - 1]
  );
}

// ---------------- ATR ----------------
function calculateATR(quotes, period = 14) {
  if (quotes.length < period + 1) return 0;

  let trs = [];

  for (let i = 1; i < quotes.length; i++) {
    const high = quotes[i].high;
    const low = quotes[i].low;
    const prevClose = quotes[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose),
    );

    trs.push(tr);
  }

  return average(trs.slice(-period));
}

// ---------------- MARKET TREND ----------------
async function getMarketTrend() {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 59);

  const queryOptions = {
    period1: startDate, // Start date (yahoo-finance2 accepts Date objects)
    interval: "15m", // 15-minute interval
  };
  const data = await yf.chart("^NSEI", queryOptions);
  // const data = await yf.chart("^NSEI", {
  // period1: await getUnixDaysAgo(60), // max allowed
  // period2: Math.floor(Date.now() / 1000),
  // interval: "15m",
  // });

  const closes = data.quotes.map((q) => q.close).filter(Boolean);

  const shortMA = average(closes.slice(-20));
  const longMA = average(closes.slice(-50));

  if (shortMA > longMA) return "BULL";
  if (shortMA < longMA) return "BEAR";
  return "SIDEWAYS";
}

// ---------------- INTRADAY BREAKOUT ----------------
// Added 'allowPowerBreakouts' parameter
async function getIntradayBreakout(
  symbol,
  resistance,
  allowPowerBreakouts = false,
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 59);

  const queryOptions = {
    period1: startDate, // Start date (yahoo-finance2 accepts Date objects)
    interval: "15m", // 15-minute interval
  };

  const data = await yf.chart(symbol, queryOptions);

  // const data = await yf.chart(symbol, {
  // period1: await getUnixDaysAgo(60), // max allowed
  // period2: Math.floor(Date.now() / 1000),
  // interval: "15m",
  // });

  const candles = data.quotes;
  if (candles.length < 3) return false;

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  const bodySize = Math.abs(last.close - last.open);
  const candleRange = last.high - last.low;

  const strongCandle =
    last.close > resistance && candleRange > 0 && bodySize / candleRange > 0.6;

  const sustainedBreakout = prev.close > resistance && last.close > resistance;

  const retestValid = last.low <= resistance * 1.01 && last.close > resistance;

  const recentRanges = candles.slice(-10).map((c) => c.high - c.low);
  const avgRange = average(recentRanges);
  const currentRange = last.high - last.low;

  const volatilityExpansion = currentRange > avgRange * 1.2;

  // LOGIC TOGGLE: Strict vs Power Breakout
  if (allowPowerBreakouts) {
    // Ignores 'retestValid' requirement to catch rockets
    return strongCandle && sustainedBreakout && volatilityExpansion;
  } else {
    // STRICT MODE: Requires the pullback retest to be safe
    return (
      strongCandle && sustainedBreakout && retestValid && volatilityExpansion
    );
  }
}

// ---------------- MAIN ENGINE ----------------
// Added 'strictMode' parameter (defaults to true for safety)
export async function analyzeStock(stock, strictMode = true) {
  try {
    const data = await yf.chart(stock.symbol, {
      period1: "2024-01-01",
      interval: "1d",
    });

    const quotes = data.quotes;
    const closes = quotes.map((q) => q.close).filter(Boolean);
    const volumes = quotes.map((q) => q.volume).filter(Boolean);

    if (closes.length < 60) return null;

    // --- NEW: GAP FILTER LOGIC ---
    const yesterdayClose = quotes[quotes.length - 2].close;
    const todayOpen = quotes[quotes.length - 1].open;
    const gapPercent = ((todayOpen - yesterdayClose) / yesterdayClose) * 100;

    // Filter out stocks that gapped up more than 3% or gapped down below -1%
    if (gapPercent > 3 || gapPercent < -1) {
      return null;
    }
    // -----------------------------

    const currentPrice = closes[closes.length - 1];

    // ---------------- ATR ----------------
    const atr = calculateATR(quotes, 14);
    if (!atr || atr === 0) return null;

    // Volatility filter (PRO)
    const atrPercent = (atr / currentPrice) * 100;
    if (atrPercent < 1) return null;

    // ---------------- INDICATORS ----------------
    const momentum_20 = calculateReturns(closes, 20);
    const momentum_60 = calculateReturns(closes, 60);

    const volume_today = volumes[volumes.length - 1];
    const avg_volume_20d = average(volumes.slice(-20));
    const volume_ratio = volume_today / avg_volume_20d;

    const volume_trend_5d = average(volumes.slice(-5)) / avg_volume_20d;

    // ---------------- SUPPORT / RESISTANCE ----------------
    const recent = closes.slice(-20);
    const resistance_20 = Math.max(...recent);
    const support_20 = Math.min(...recent);

    const distance_resistance = (resistance_20 - currentPrice) / resistance_20;

    const breakout_20 = currentPrice >= resistance_20 ? 1 : 0;
    const near_breakout = distance_resistance <= 0.02;

    // ---------------- REVERSAL LOGIC ----------------
    const macroLow = Math.min(...closes.slice(-40));

    // Stock must be bouncing at least 2.5% off that major low
    const priceRecovery = currentPrice > macroLow * 1.025;

    // NEW: Ensure the stock is actually in a downtrend/pullback before calling it a reversal
    // Current price should be below its recent 20-day high to prevent triggering at the top
    const isPullback = currentPrice < resistance_20 * 0.95;

    const momentumShift =
      momentum_20 > momentum_60 || (momentum_20 > -0.02 && momentum_60 < 0);

    const reclaimMove =
      currentPrice > closes[closes.length - 3] &&
      currentPrice > closes[closes.length - 5];

    const intradayRecovery = reclaimMove && volume_ratio > 1.3;

    // Add this near the top of your analyzeStock logic
const currentHour = new Date().getHours();
const currentMinute = new Date().getMinutes();
const currentTimeStr = currentHour + (currentMinute / 60);
console.log("current time:", currentTimeStr);

const reversalSignal =
      (priceRecovery || intradayRecovery) &&
      isPullback && // <--- Adding the safety check here
      momentumShift &&
      volume_ratio > 1.3 && currentTimeStr <= 14.25 &&
      (stock.sentiment_score || 0) > 0.6;

    // ---------------- MARKET ----------------
    const marketTrend = await getMarketTrend();

    const allowTrade =
      marketTrend === "BULL" ||
      marketTrend === "SIDEWAYS" ||
      (marketTrend === "BEAR" && reversalSignal);

    if (!allowTrade) return null;

    // ---------------- INTRADAY ----------------
    // Pass the toggle state to the intraday function. If strictMode is true, allowPowerBreakouts is false.
    const intradayBreakout = await getIntradayBreakout(
      stock.symbol,
      resistance_20,
      !strictMode,
    );

    // ---------------- SCORING ----------------
    let score = 0;

    if (momentum_20 > momentum_60) score += 15;
    if (momentum_20 > 0) score += 5;
    if (momentum_20 > momentum_60 * 1.2) score += 5;

    if (volume_ratio > 1.2) score += 10;
    if (volume_ratio > 1.5) score += 5;
    if (volume_trend_5d > 1) score += 5;

    if (breakout_20) score += 15;
    else if (near_breakout) score += 10;
    if (reversalSignal) score += 10;

    if (marketTrend === "BULL") score += 10;
    else if (marketTrend === "SIDEWAYS") score += 5;
    else if (reversalSignal) score += 5;

    if (stock.sentiment_score) score += stock.sentiment_score * 10;

    if (volume_ratio < 1) score -= 5;
    if (momentum_20 < 0 && !reversalSignal) score -= 5;

    const confidenceScore = Math.max(0, Math.min(100, score));

    // ---------------- ENTRY TYPE ----------------
    let entryType = "";
    if (breakout_20) entryType = "BREAKOUT";
    else if (reversalSignal) entryType = "REVERSAL";
    else if (near_breakout) entryType = "EARLY";

    const todayHigh = Math.max(...data.quotes.slice(-1).map(q => q.high));
    const todayLow = Math.min(...data.quotes.slice(-1).map(q => q.low));
    const dayMidpoint = (todayHigh + todayLow) / 2;

    const validEntry =
      (entryType === "BREAKOUT" && intradayBreakout) ||
      (entryType === "REVERSAL" && reversalSignal && currentPrice > dayMidpoint) 
      // (entryType === "EARLY" && volume_ratio > 1.5 && momentum_20 > 0 && currentPrice > todayOpen); 

    if (!validEntry) return null;

    // ---------------- ATR BASED SL / TARGET ----------------
    let slMultiplier, targetMultiplier;

    if (entryType === "BREAKOUT") {
      slMultiplier = 1.5;
      targetMultiplier = 3;
    } else if (entryType === "REVERSAL") {
      slMultiplier = 1.2;
      targetMultiplier = 2.5;
    } else {
      slMultiplier = 1.3;
      targetMultiplier = 2.5;
    }

    const stopLoss = currentPrice - atr * slMultiplier;
    const risk = currentPrice - stopLoss;
    const target = currentPrice + atr * targetMultiplier;

    // ---------------- OUTPUT ----------------
    return {
      symbol: stock.symbol,
      price: currentPrice,
      gapPercent: gapPercent.toFixed(2) + "%", // Added so you can see the gap size in logs
      confidenceScore,
      entryType,
      score,
      marketTrend,
      momentum_20,
      momentum_60,
      volume_ratio,
      breakout_20,
      reversalSignal,
      atr,
      atrPercent,
      stopLoss,
      target,
    };
  } catch (err) {
    console.error("Error:", stock.symbol, err.message);
    return null;
  }
}

async function main() {
  // Set to 'true' to require retests (Safe Mode)
  // Set to 'false' to allow Power Breakouts (Aggressive Mode)
  const USE_STRICT_MODE = true;

  for (let i = 0; i < STOCKS.length; i++) {
    console.log("Checking:", STOCKS[i].symbol);
    var item = {
      sentiment_score: 55,
      symbol: STOCKS[i].symbol,
    };

    // Pass the mode toggle into analyzeStock
    var data = await analyzeStock(item, USE_STRICT_MODE);

    if (data) {
      console.log("MATCH FOUND:", data);
    }
  }
}

async function getUnixDaysAgo(days) {
  return Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
}

await main();
