import { PutCommand, ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { client } from "../db/dynamo.client.js";
import { STOCKS } from "../Common/stockInfo.js";
import yahooFinance from "yahoo-finance2";

const yf = new yahooFinance();

let TARGET_SECTOR = "Energy";
let SENTIMENT = "Bullish";
let STOCK_LIST = [];

export const sectorStockSelector = async (input) => {
  const niftySentiment = input.niftySentiment;
  let selectedStocks = {};
  let index = 0;
  let finalStocks = [];

  while (finalStocks.length <= 3 && index < 11) {
    selectedStocks = await getTheSector(niftySentiment, index);

    let stocksSector = STOCKS.filter(
      (s) => s.sector === selectedStocks.sector
    );

    STOCK_LIST = stocksSector;
    TARGET_SECTOR = stocksSector[0].sector;
    SENTIMENT = niftySentiment;

    finalStocks =
      SENTIMENT === "Bearish"
        ? await getBearishStocks()
        : await getBullishStocks();

    index++;
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
    })
  );

  const item = result.Item.sectorSummery;
  const arr = item.probabilityArr.map((obj) => Object.entries(obj)[0]);

  let sorted;

  if (niftySentiment === "Bearish") {
    sorted = arr.sort((a, b) => a[1] - b[1]);
  } else {
    sorted = arr.sort((a, b) => b[1] - a[1]);
  }

  return {
    sector: sorted[index]?.[0],
    score: sorted[index]?.[1],
  };
}

// ---------------- UTILS ----------------
function calculateReturns(closes, period) {
  const len = closes.length;
  if (len < period + 1) return 0;
  return (
    (closes[len - 1] - closes[len - period - 1]) /
    closes[len - period - 1]
  );
}

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function calculateRSI(closes, period = 14) {
  if (!closes || closes.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];

    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss =
        (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(2));
}

// ---------------- BULLISH ----------------
async function getBullishStocks() {
  const results = [];

  for (const stock of STOCK_LIST) {
    if (stock.sector !== TARGET_SECTOR) continue;

    try {
      const res = await yf.search(stock.displayName);

      const stc = res.quotes.find(
        (q) =>
          q.exchange === "NSI" ||
          q.exchange === "NSE" ||
          q.symbol?.endsWith(".NS")
      );

      const finalStockSymbol = stc?.symbol ?? stock.symbol;

      const data = await yf.chart(finalStockSymbol, {
        period1: "2024-01-01",
        interval: "1d",
      });

      const quotes = data.quotes || [];
      if (quotes.length < 60) continue;

      const closes = quotes.map((q) => q.close).filter(Boolean);
      const volumes = quotes.map((q) => q.volume).filter(Boolean);

      const quote = await yf.quote(finalStockSymbol);

      const currentPrice =
        quote?.regularMarketPrice ?? closes.at(-1);
      const currentVolume =
        quote?.regularMarketVolume ?? volumes.at(-1);

      const updatedCloses = [...closes.slice(0, -1), currentPrice];
      const updatedVolumes = [...volumes.slice(0, -1), currentVolume];

      // ---- MOMENTUM ----
      const momentum_20 = calculateReturns(updatedCloses, 20);
      const momentum_60 = calculateReturns(updatedCloses, 60);

      // ---- VOLUME ----
      const volume_today = updatedVolumes.at(-1);
      const avg_volume_20d = average(updatedVolumes.slice(-20));
      const volume_ratio = volume_today / avg_volume_20d;

      // ---- SUPPORT / RESISTANCE ----
      const recentCloses = updatedCloses.slice(-21, -1);
      const support_20 = Math.min(...recentCloses);
      const resistance_20 = Math.max(...recentCloses);

      const breakout_20 = currentPrice > resistance_20 ? 1 : 0;

      // ---- 🔥 NEW NEAR BREAKOUT LOGIC ----
      const distanceToResistance =
        (resistance_20 - currentPrice) / resistance_20;

      const near_breakout =
        distanceToResistance >= 0 &&
        distanceToResistance <= 0.015;

      // ---- COMPRESSION ----
      const last5 = updatedCloses.slice(-6, -1);
      const range5 = Math.max(...last5) - Math.min(...last5);
      const avgPrice5 = average(last5);

      const isCompressing = range5 / avgPrice5 < 0.02;

      // ---- VOLUME BUILDUP ----
      const avgVol5 = average(updatedVolumes.slice(-5));
      const avgVol20 = average(updatedVolumes.slice(-20));

      const volume_building =
        avgVol5 > avgVol20 * 0.9 &&
        avgVol5 < avgVol20 * 1.3;

      // ---- RSI ----
      const rsi_14 = calculateRSI(updatedCloses, 14);
      if (!rsi_14) continue;

      // ---- FILTERS ----
      const isOverbought =
        momentum_20 > 0.15 || rsi_14 > 68;

      if (isOverbought) continue;

      const isNearBreakoutCandidate =
        momentum_20 > 0 &&
        momentum_20 >= momentum_60 &&
        near_breakout &&
        isCompressing &&
        volume_building;

      const isValid =
        (momentum_20 > momentum_60 &&
          volume_ratio > 1.2 &&
          breakout_20 === 1) ||
        isNearBreakoutCandidate;

      if (!isValid) continue;

      // ---- SCORING ----
      let score = 0;

      if (momentum_20 > momentum_60) score += 30;

      if (volume_ratio > 1.5) score += 30;
      else if (volume_ratio > 1.2) score += 20;

      if (breakout_20 === 1) score += 30;

      if (isNearBreakoutCandidate) score += 25;
      if (isCompressing) score += 10;
      if (volume_building) score += 10;

      const probability = Math.max(40, Math.min(90, score));

      const eventCategory =
        breakout_20 === 1
          ? "Breakout"
          : isNearBreakoutCandidate
          ? "Near Breakout"
          : "Momentum";

      results.push({
        symbol: finalStockSymbol,
        displayName: stock.displayName,
        sector: stock.sector,
        Prediction: "Profit",
        eventCategory,
        probability,
        currentPrice,
        support_20,
        resistance_20,
        volume_ratio: Number(volume_ratio.toFixed(2)),
        keyCatalysts:
          "Compression + volume buildup near resistance",
        timehorizon: "Intraday",
      });
    } catch (err) {
      console.error(`Error fetching ${stock.symbol}`, err.message);
    }
  }

  return results.sort((a, b) => b.probability - a.probability);
}

// ---------------- BEARISH (UNCHANGED CORE) ----------------
async function getBearishStocks() {
  const results = [];

  for (const stock of STOCK_LIST) {
    if (stock.sector !== TARGET_SECTOR) continue;

    try {
      const res = await yf.search(stock.displayName);

      const stc = res.quotes.find(
        (q) =>
          q.exchange === "NSI" ||
          q.exchange === "NSE" ||
          q.symbol?.endsWith(".NS")
      );

      const finalStockSymbol = stc?.symbol ?? stock.symbol;

      const data = await yf.chart(finalStockSymbol, {
        period1: "2024-01-01",
        interval: "1d",
      });

      const quotes = data.quotes || [];
      if (quotes.length < 60) continue;

      const closes = quotes.map((q) => q.close).filter(Boolean);
      const volumes = quotes.map((q) => q.volume).filter(Boolean);

      const quote = await yf.quote(finalStockSymbol);

      const currentPrice =
        quote?.regularMarketPrice ?? closes.at(-1);
      const currentVolume =
        quote?.regularMarketVolume ?? volumes.at(-1);

      const updatedCloses = [...closes.slice(0, -1), currentPrice];
      const updatedVolumes = [...volumes.slice(0, -1), currentVolume];

      const momentum_20 = calculateReturns(updatedCloses, 20);
      const momentum_60 = calculateReturns(updatedCloses, 60);

      const avgVol20 = average(updatedVolumes.slice(-20));
      const volume_ratio =
        updatedVolumes.at(-1) / avgVol20;

      const recent = updatedCloses.slice(-20);
      const support_20 = Math.min(...recent);
      const resistance_20 = Math.max(...recent);

      const breakdown = currentPrice <= support_20;

      if (
        momentum_20 < momentum_60 &&
        volume_ratio > 1.2 &&
        breakdown
      ) {
        results.push({
          symbol: finalStockSymbol,
          displayName: stock.displayName,
          Prediction: "Loss",
          probability: 70,
        });
      }
    } catch (err) {
      console.error(err.message);
    }
  }

  return results;
}

await sectorStockSelector({ niftySentiment: "Bullish" }).then((res) =>
  console.log("Selected Sector", res),
);