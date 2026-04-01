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

async function getBullishStocks() {
  const results = [];

  for (const stock of STOCK_LIST) {
    if (stock.sector !== TARGET_SECTOR) continue;

    try {
      const data = await yf.chart(stock.symbol, {
        period1: "2024-01-01",
        interval: "1d",
      });

      const quotes = data.quotes;
      const closes = quotes.map((q) => q.close).filter(Boolean);
      const volumes = quotes.map((q) => q.volume).filter(Boolean);

      if (closes.length < 60) continue;

      // --- Indicators ---
      const momentum_20 = calculateReturns(closes, 20);
      const momentum_60 = calculateReturns(closes, 60);

      const volume_today = volumes[volumes.length - 1];
      const avg_volume_20d = average(volumes.slice(-20));
      const volume_ratio = volume_today / avg_volume_20d;

      const lastClose = closes[closes.length - 1];

      const quote = await yf.quote(stock.symbol);
      const currentPrice = quote?.regularMarketPrice ?? lastClose;

      if (!currentPrice) {
        currentPrice = lastClose;
      }
      // --- Support & Resistance ---
      const recentCloses = closes.slice(-20);
      const resistance_20 = Math.max(...recentCloses);

      const distance_resistance_20 =
        (resistance_20 - currentPrice) / resistance_20;

      const breakout_20 = currentPrice >= resistance_20 ? 1 : 0;
      const near_breakout = distance_resistance_20 <= 0.02;

      // --- FILTER ---
      const isValid =
        momentum_20 > momentum_60 &&
        volume_ratio > 1.2 &&
        (breakout_20 === 1 || near_breakout);

      if (!isValid) continue;

      // ==============================
      // 🔥 PROBABILITY CALCULATION
      // ==============================
      let probability = 50;

      // Momentum strength
      if (momentum_20 > momentum_60) probability += 10;
      if (momentum_20 > 0.05) probability += 10; // strong uptrend

      // Volume confirmation
      if (volume_ratio > 1.5) probability += 10;
      else if (volume_ratio > 1.2) probability += 5;

      // Breakout strength
      if (breakout_20 === 1) probability += 15;
      else if (near_breakout) probability += 8;

      // Trend consistency
      if (momentum_60 > 0) probability += 5;

      // Clamp between 0–100
      probability = Math.min(100, Math.max(0, probability));

      // ==============================
      // Expected Move (2–5 days)
      // ==============================
      let expectedMove = "2% - 4%";
      if (probability >= 75) expectedMove = "5% - 8%";
      else if (probability >= 65) expectedMove = "3% - 6%";

      results.push({
        symbol: stock.symbol,
        category: stock.category,
        displayName: stock.displayName,
        eventCategory: "Underperformer",
        Prediction: "Profit",
        sector: stock.sector,
        stockNameCategory: stock.stockNameCategory,
        keyCatalysts:
          "Sector strength supported by breakout and rising volume indicates bullish continuation",
        suggestedBy: "Stock Suggestion Based on Strongest Sector",
        timehorizon: "Intraday",
      });
    } catch (err) {
      console.error(`Error fetching ${stock.symbol}`, err.message);
    }
  }

  // Sort best opportunities first
  return results.sort((a, b) => b.probability - a.probability);
}

async function getBearishStocks() {
  const results = [];
  for (const stock of STOCK_LIST) {
    if (stock.sector !== TARGET_SECTOR) continue;

    try {
      const data = await yf.chart(stock.symbol, {
        period1: "2024-01-01",
        interval: "1d",
      });

      const quotes = data.quotes;
      const closes = quotes.map((q) => q.close).filter(Boolean);
      const volumes = quotes.map((q) => q.volume).filter(Boolean);

      if (closes.length < 60) continue;

      // --- Indicators ---
      const momentum_20 = calculateReturns(closes, 20);
      const momentum_60 = calculateReturns(closes, 60);

      const volume_today = volumes[volumes.length - 1];
      const avg_volume_20d = average(volumes.slice(-20));
      const volume_ratio = volume_today / avg_volume_20d;

      const lastClose = closes[closes.length - 1];

      const quote = await yf.quote(stock.symbol);
      const currentPrice = quote?.regularMarketPrice ?? lastClose;

      if (!currentPrice) {
        currentPrice = lastClose;
      }

      // --- Support & Resistance ---
      const recentCloses = closes.slice(-20);

      const support_20 = Math.min(...recentCloses);
      const resistance_20 = Math.max(...recentCloses);

      const distance_resistance_20 =
        (resistance_20 - currentPrice) / resistance_20;

      const distance_support_20 = (currentPrice - support_20) / support_20;

      // --- Breakdown Logic ---
      const breakdown_20 = currentPrice <= support_20 ? 1 : 0;

      const near_resistance = distance_resistance_20 <= 0.02;
      const near_breakdown = distance_support_20 <= 0.02;

      // --- FILTER CONDITIONS (BEARISH) ---
      const isValid =
        momentum_20 < momentum_60 &&
        volume_ratio > 1.2 &&
        (breakdown_20 === 1 || near_resistance);

      if (!isValid) continue;

      // --- 🔥 PROBABILITY SCORING ---
      let score = 0;

      // Momentum (trend weakness)
      if (momentum_20 < momentum_60) score += 30;

      // Volume confirmation
      if (volume_ratio > 1.5) score += 30;
      else if (volume_ratio > 1.2) score += 20;

      // Structure
      if (breakdown_20 === 1) score += 30;
      else if (near_resistance) score += 15;

      // Extra: near breakdown adds continuation probability
      if (near_breakdown) score += 10;

      // Risk control (avoid oversold crash)
      if (momentum_20 < -0.25) score -= 10;

      // Clamp probability
      const probability = Math.max(40, Math.min(90, score));

      results.push({
        symbol: stock.symbol,
        category: stock.category,
        displayName: stock.displayName,
        eventCategory: "Underperformer",
        Prediction: "Loss",
        sector: stock.sector,
        stockNameCategory: stock.stockNameCategory,
        keyCatalysts:
          "Sector weakness with breakdown and selling pressure indicates bearish continuation",
        suggestedBy: "Stock Suggestion Based on Weakest Sector",
        timehorizon: "Intraday",
      });
    } catch (err) {
      console.error(`Error fetching ${stock.symbol}`, err.message);
    }
  }

  // --- 🔥 SORT BY BEST SETUP ---
  results.sort((a, b) => b.probability_of_bearish - a.probability_of_bearish);

  // Optional: pick top 3
  return results.slice(0, 3);
}

await sectorStockSelector({ niftySentiment: "Bearish" }).then((res) =>
  console.log("Selected Sector", res),
);
