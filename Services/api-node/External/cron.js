import yahooFinance from "yahoo-finance2";
import { STOCKS } from "../Common/stockInfo.js";

const yf = new yahooFinance();

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function calculateReturns(closes, period) {
  const len = closes.length;
  if (len < period + 1) return 0;
  return (closes[len - 1] - closes[len - period - 1]) / closes[len - period - 1];
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
      Math.abs(low - prevClose)
    );

    trs.push(tr);
  }

  return average(trs.slice(-period));
}

// ---------------- MARKET TREND ----------------
async function getMarketTrend() {
  const data = await yf.chart("^NSEI", {
  period1: await getUnixDaysAgo(60), // max allowed
  period2: Math.floor(Date.now() / 1000),
  interval: "15m",
  });

  const closes = data.quotes.map(q => q.close).filter(Boolean);

  const shortMA = average(closes.slice(-20));
  const longMA = average(closes.slice(-50));

  if (shortMA > longMA) return "BULL";
  if (shortMA < longMA) return "BEAR";
  return "SIDEWAYS";
}

// ---------------- INTRADAY BREAKOUT ----------------
async function getIntradayBreakout(symbol, resistance) {
  const data = await yf.chart(symbol, {
  period1: await getUnixDaysAgo(60), // max allowed
  period2: Math.floor(Date.now() / 1000),
  interval: "15m",
  });

  const candles = data.quotes;
  if (candles.length < 3) return false;

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  const bodySize = Math.abs(last.close - last.open);
  const candleRange = last.high - last.low;

  const strongCandle =
    last.close > resistance &&
    candleRange > 0 &&
    bodySize / candleRange > 0.6;

  const sustainedBreakout =
    prev.close > resistance &&
    last.close > resistance;

  const retestValid =
    last.low <= resistance * 1.01 &&
    last.close > resistance;

  const recentRanges = candles.slice(-10).map(c => c.high - c.low);
  const avgRange = average(recentRanges);
  const currentRange = last.high - last.low;

  const volatilityExpansion =
    currentRange > avgRange * 1.2;

  return (
    strongCandle &&
    sustainedBreakout &&
    retestValid &&
    volatilityExpansion
  );
}

// ---------------- MAIN ENGINE ----------------
export async function analyzeStock(stock) {
  try {
    const data = await yf.chart(stock.symbol, {
      period1: "2024-01-01",
      interval: "1d",
    });

    const quotes = data.quotes;
    const closes = quotes.map(q => q.close).filter(Boolean);
    const volumes = quotes.map(q => q.volume).filter(Boolean);

    if (closes.length < 60) return null;

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

    const volume_trend_5d =
      average(volumes.slice(-5)) / avg_volume_20d;

    // ---------------- SUPPORT / RESISTANCE ----------------
    const recent = closes.slice(-20);
    const resistance_20 = Math.max(...recent);
    const support_20 = Math.min(...recent);

    const distance_resistance =
      (resistance_20 - currentPrice) / resistance_20;

    const breakout_20 = currentPrice >= resistance_20 ? 1 : 0;
    const near_breakout = distance_resistance <= 0.02;

    // ---------------- REVERSAL LOGIC ----------------
    const recentLow = Math.min(...closes.slice(-10));

    const priceRecovery =
      currentPrice > recentLow * 1.02;

    const momentumShift =
      momentum_20 > momentum_60 ||
      (momentum_20 > -0.02 && momentum_60 < 0);

    const reclaimMove =
      currentPrice > closes[closes.length - 3] &&
      currentPrice > closes[closes.length - 5];

    const intradayRecovery =
      reclaimMove &&
      volume_ratio > 1.3;

    const reversalSignal =
      (
        priceRecovery ||
        intradayRecovery
      ) &&
      momentumShift &&
      volume_ratio > 1.3 &&
      (stock.sentiment_score || 0) > 0.6;

    // ---------------- MARKET ----------------
    const marketTrend = await getMarketTrend();

    const allowTrade =
      marketTrend === "BULL" ||
      marketTrend === "SIDEWAYS" ||
      (marketTrend === "BEAR" && reversalSignal);

    if (!allowTrade) return null;

    // ---------------- INTRADAY ----------------
    const intradayBreakout = await getIntradayBreakout(
      stock.symbol,
      resistance_20
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

    if (stock.sentiment_score)
      score += stock.sentiment_score * 10;

    if (volume_ratio < 1) score -= 5;
    if (momentum_20 < 0 && !reversalSignal) score -= 5;

    const confidenceScore = Math.max(0, Math.min(100, score));

    // ---------------- ENTRY TYPE ----------------
    let entryType = "";
    if (breakout_20) entryType = "BREAKOUT";
    else if (reversalSignal) entryType = "REVERSAL";
    else if (near_breakout) entryType = "EARLY";

    const validEntry =
      (entryType === "BREAKOUT" && intradayBreakout) ||
      (entryType === "REVERSAL" && reversalSignal) ||
      (entryType === "EARLY" && intradayBreakout);

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
      target
    };

  } catch (err) {
    console.error("Error:", stock.symbol, err.message);
    return null;
  }
}

async function main() {
  for (let i = 0; i < STOCKS.length; i++) {
    console.log("symbollllllll",STOCKS[i].symbol)
    var item = {
      "sentiment_score":75,
      "symbol": STOCKS[i].symbol
    }
    var data = await analyzeStock(item);
    console.log(data);
   }
}

async function getUnixDaysAgo(days) {
  return Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);
}

await main();