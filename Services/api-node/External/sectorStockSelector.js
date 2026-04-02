import { PutCommand, ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { client } from "../db/dynamo.client.js";
import { STOCKS } from "../Common/stockInfo.js";
import yahooFinance from "yahoo-finance2";
import vader from "vader-sentiment";

const yf = new yahooFinance();
let TARGET_SECTOR = "Energy";
let SENTIMENT = "Bullish"; // or Bearish
let STOCK_LIST = [];
export const sectorStockSelector = async (input) => {
  const niftySentiment = input.niftySentiment; //barrish or bullish
  let selectedStocks = {};
  let index = 0;
  let finalStocks = [];
  while (finalStocks.length === 0 && index < 11) {
    console.log("data here");
    selectedStocks = await getTheSector(niftySentiment, index);
    let stocksSector = STOCKS.filter((s) => s.sector === selectedStocks.sector);
    STOCK_LIST = stocksSector;
    TARGET_SECTOR = stocksSector[0].sector;
    SENTIMENT = niftySentiment;
    if (SENTIMENT === "Bearish") {
      finalStocks = await getBearishStocks();
    } else {
      finalStocks = await getBullishStocks();
    }
    index++;
    console.log("final stocks", finalStocks);
  }
  return {
    statusCode: 200,
    body: finalStocks,
  };
};

async function getTheSector(niftySentiment, index, id = 1) {
  const TABLE = "FilteredNews";

  const result = await client.send(
    new GetCommand({
      TableName: TABLE,
      Key: { countryId: Number(id) },
    }),
  );

  const item = result.Item.sectorSummery;

  const arr = item.probabilityArr.map((obj) => Object.entries(obj)[0]);

  let sorted;

  if (niftySentiment === "Bearish") {
    // Low → High
    sorted = arr.sort((a, b) => a[1] - b[1]);

    // 2nd lowest
    return {
      sector: sorted[index]?.[0],
      score: sorted[index]?.[1],
    };
  } else {
    // High → Low
    sorted = arr.sort((a, b) => b[1] - a[1]);

    // 2nd highest
    return {
      sector: sorted[index]?.[0],
      score: sorted[index]?.[1],
    };
  }
}

function calculateReturns(closes, period) {
  const len = closes.length;
  if (len < period + 1) return 0;
  return (
    (closes[len - 1] - closes[len - period - 1]) / closes[len - period - 1]
  );
}

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function calculateRSI(closes, period = 14) {
  if (!closes || closes.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  // Initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Smooth RSI (Wilder's method)
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];

    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  return Number(rsi.toFixed(2));
}

async function getBullishStocks() {
  const results = [];

  for (const stock of STOCK_LIST) {
    if (stock.sector !== TARGET_SECTOR) continue;

    try {
      // --- 🔍 SEARCH ---
      const res = await yf.search(stock.displayName);

      const stc = res.quotes.find(
        (q) =>
          q.exchange === "NSI" ||
          q.exchange === "NSE" ||
          q.symbol?.endsWith(".NS")
      );

      const finalStockSymbol = stc?.symbol ?? stock.symbol;

      // --- 📊 HISTORICAL DATA ---
      const data = await yf.chart(finalStockSymbol, {
        period1: "2024-01-01",
        interval: "1d",
      });

      const quotes = data.quotes || [];
      if (quotes.length < 60) continue;

      const closes = quotes.map((q) => q.close).filter(Boolean);
      const volumes = quotes.map((q) => q.volume).filter(Boolean);

      const lastClose = closes[closes.length - 1];

      // --- 📈 LIVE DATA ---
      const quote = await yf.quote(finalStockSymbol);

      let currentPrice = quote?.regularMarketPrice ?? lastClose;
      const currentVolume =
        quote?.regularMarketVolume ?? volumes[volumes.length - 1];

      // --- 🔄 REAL-TIME ADJUSTMENT ---
      const updatedCloses = [...closes.slice(0, -1), currentPrice];
      const updatedVolumes = [...volumes.slice(0, -1), currentVolume];

      // --- 📉 MOMENTUM ---
      const momentum_20 = calculateReturns(updatedCloses, 20);
      const momentum_60 = calculateReturns(updatedCloses, 60);

      // --- 📊 VOLUME ---
      const volume_today = updatedVolumes[updatedVolumes.length - 1];
      const avg_volume_20d = average(updatedVolumes.slice(-20));
      const volume_ratio = volume_today / avg_volume_20d;

      // --- 🧱 SUPPORT / RESISTANCE (FIXED) ---
      const recentCloses = updatedCloses.slice(-21, -1); // 🔥 exclude current price

      const support_20 = Math.min(...recentCloses);
      const resistance_20 = Math.max(...recentCloses);

      // --- 📊 DISTANCE ---
      const breakout_20 = currentPrice > resistance_20 ? 1 : 0;

      const near_breakout =
        currentPrice >= resistance_20 * 0.98 &&
        currentPrice <= resistance_20 * 1.01;

      // --- 📊 RSI ---
      const rsi_14 = calculateRSI(updatedCloses, 14);
      if (!rsi_14) continue;

      // --- 🚫 OVERBOUGHT FILTER ---
      const breakout_strength =
        (currentPrice - resistance_20) / resistance_20;

      const isOverbought =
        momentum_20 > 0.15 ||                 // too fast up move
        rsi_14 > 68 ||                       // overbought zone
        breakout_strength > 0.015 ||         // >1.5% above resistance
        (volume_ratio > 1.8 && momentum_20 > 0.12); // blow-off

      if (isOverbought) continue;

      // --- 🚫 TOO EXTENDED FROM BASE ---
      const isTooExtendedFromBase =
        (currentPrice - support_20) / support_20 > 0.08;

      if (isTooExtendedFromBase) continue;

      // --- ❗ FINAL FILTER ---
      const isValid =
        momentum_20 > momentum_60 &&
        volume_ratio > 1.2 &&
        near_breakout; // 🔥 ONLY early breakout

      if (!isValid) continue;

      // --- 🔥 SCORING ---
      let score = 0;

      if (momentum_20 > momentum_60) score += 30;

      if (volume_ratio > 1.5) score += 30;
      else if (volume_ratio > 1.2) score += 20;

      if (breakout_20 === 1) score += 30;
      else if (near_breakout) score += 15;

      if (near_breakout) score += 10;

      const probability = Math.max(40, Math.min(90, score));

      // --- 📦 RESULT ---
      results.push({
        symbol: finalStockSymbol,
        category: stock.category,
        displayName: stock.displayName,
        eventCategory: "Outperformer",
        Prediction: "Profit",
        sector: stock.sector,
        stockNameCategory: stock.stockNameCategory,
        keyCatalysts:
          "Early breakout with strong momentum and volume, not overextended",
        suggestedBy: "Stock Suggestion Based on Strongest Sector",
        timehorizon: "Intraday",
        probability,
        currentPrice,
        support_20,
        resistance_20,
        volume_ratio: Number(volume_ratio.toFixed(2)),
      });

    } catch (err) {
      console.error(`Error fetching ${stock.symbol}`, err.message);
    }
  }

  return results.sort((a, b) => b.probability - a.probability);
}

async function getBearishStocks() {
  const results = [];

  for (const stock of STOCK_LIST) {
    if (stock.sector !== TARGET_SECTOR) continue;

    try {
      // --- 🔍 SEARCH ---
      const res = await yf.search(stock.displayName);

      const stc = res.quotes.find(
        (q) =>
          q.exchange === "NSI" ||
          q.exchange === "NSE" ||
          q.symbol?.endsWith(".NS"),
      );

      const finalStockSymbol = stc?.symbol ?? stock.symbol;

      // --- 📊 HISTORICAL DATA ---
      const data = await yf.chart(finalStockSymbol, {
        period1: "2024-01-01",
        interval: "1d",
      });

      const quotes = data.quotes || [];
      if (quotes.length < 60) continue;

      const closes = quotes.map((q) => q.close).filter(Boolean);
      const volumes = quotes.map((q) => q.volume).filter(Boolean);

      const lastClose = closes[closes.length - 1];

      // --- 📈 LIVE DATA ---
      const quote = await yf.quote(finalStockSymbol);

      let currentPrice = quote?.regularMarketPrice ?? lastClose;
      const currentVolume =
        quote?.regularMarketVolume ?? volumes[volumes.length - 1];

      // --- 🔄 REAL-TIME ADJUSTMENT ---
      const updatedCloses = [...closes.slice(0, -1), currentPrice];
      const updatedVolumes = [...volumes.slice(0, -1), currentVolume];

      // --- 📉 MOMENTUM ---
      const momentum_20 = calculateReturns(updatedCloses, 20);
      const momentum_60 = calculateReturns(updatedCloses, 60);

      // --- 📊 VOLUME ---
      const volume_today = updatedVolumes[updatedVolumes.length - 1];
      const avg_volume_20d = average(updatedVolumes.slice(-20));
      const volume_ratio = volume_today / avg_volume_20d;

      // --- 🧱 SUPPORT / RESISTANCE ---
      const recentCloses = updatedCloses.slice(-20);

      const support_20 = Math.min(...recentCloses);
      const resistance_20 = Math.max(...recentCloses);

      const distance_resistance_20 =
        (resistance_20 - currentPrice) / resistance_20;

      const distance_support_20 = (currentPrice - support_20) / support_20;

      // --- 🔻 BREAKDOWN LOGIC ---
      const breakdown_20 = currentPrice <= support_20 ? 1 : 0;
      const near_breakdown = distance_support_20 <= 0.02;

      // --- 🚫 LATE ENTRY / REVERSAL FILTERS (NEW) ---
      const breakdown_strength = (support_20 - currentPrice) / support_20;

      const isOversold =
        momentum_20 < -0.2 || // too stretched
        breakdown_strength > 0.03 || // already far below support
        (volume_ratio > 2 && momentum_20 < -0.15); // capitulation zone

      if (isOversold) continue;

      // --- ❗ FILTER ---
      const isValid =
        momentum_20 < momentum_60 &&
        volume_ratio > 1.2 &&
        (breakdown_20 === 1 || near_breakdown);

      if (!isValid) continue;
      const isTooExtendedFromBase =
        (support_20 - currentPrice) / support_20 > 0.1;

      if (isTooExtendedFromBase) continue;
      // --- 🔥 PROBABILITY SCORING ---
      let score = 0;

      // Trend weakness
      if (momentum_20 < momentum_60) score += 30;

      // Volume confirmation
      if (volume_ratio > 1.5) score += 30;
      else if (volume_ratio > 1.2) score += 20;

      // Structure (pure bearish now)
      if (breakdown_20 === 1) score += 30;
      else if (near_breakdown) score += 15;

      // Continuation boost
      if (near_breakdown) score += 10;

      const probability = Math.max(40, Math.min(90, score));

      // --- 📦 RESULT ---
      results.push({
        symbol: finalStockSymbol,
        category: stock.category,
        displayName: stock.displayName,
        eventCategory: "Underperformer",
        Prediction: "Loss",
        sector: stock.sector,
        stockNameCategory: stock.stockNameCategory,
        keyCatalysts:
          "Weak trend with controlled breakdown (not oversold), supported by volume expansion",
        suggestedBy: "Stock Suggestion Based on Weakest Sector",
        timehorizon: "Intraday",
        probability,
        currentPrice,
        support_20,
        resistance_20,
        volume_ratio: Number(volume_ratio.toFixed(2)),
      });
    } catch (err) {
      console.error(`Error fetching ${stock.symbol}`, err.message);
    }
  }

  return results;
}

// await sectorStockSelector({ niftySentiment: "Bullish" }).then((res) =>
//   console.log("Selected Sector", res),
// );
