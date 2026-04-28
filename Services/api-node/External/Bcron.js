import axios from "axios";
import yahooFinance from "yahoo-finance2";
import { PutCommand, ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { client } from "../db/dynamo.client.js";
import { BearStocks } from "../Common/stockInfo.js";

const yf = new yahooFinance();

const PlaceStocks = process.env.BearPlacedStocksTable;
const Barish_STOCKS = BearStocks;
// ---------------- CONFIGURATION ----------------
const CONFIG = {
  apiKey: process.env.Smart_API_KEY ?? "uVNH5DtC",
  jwtToken:
    process.env.Smart_API_JWT_TOKEN ??
    "eyJhbGciOiJIUzUxMiJ9.eyJ1c2VybmFtZSI6IkFBQ0c2NjE4MjciLCJyb2xlcyI6MCwidXNlcnR5cGUiOiJVU0VSIiwidG9rZW4iOiJleUpoYkdjaU9pSlNVekkxTmlJc0luUjVjQ0k2SWtwWFZDSjkuZXlKMWMyVnlYM1I1Y0dVaU9pSmpiR2xsYm5RaUxDSjBiMnRsYmw5MGVYQmxJam9pZEhKaFpHVmZZV05qWlhOelgzUnZhMlZ1SWl3aVoyMWZhV1FpT2pNc0luTnZkWEpqWlNJNklqTWlMQ0prWlhacFkyVmZhV1FpT2lJd05UWmhaRGs1WWkxaE1qWTFMVE5tTkdVdFlXSmlOaTA1T0RabFltSTNOalk0Wm1JaUxDSnJhV1FpT2lKMGNtRmtaVjlyWlhsZmRqSWlMQ0p2Ylc1bGJXRnVZV2RsY21sa0lqb3pMQ0p3Y205a2RXTjBjeUk2ZXlKa1pXMWhkQ0k2ZXlKemRHRjBkWE1pT2lKaFkzUnBkbVVpZlN3aWJXWWlPbnNpYzNSaGRIVnpJam9pWVdOMGFYWmxJbjE5TENKcGMzTWlPaUowY21Ga1pWOXNiMmRwYmw5elpYSjJhV05sSWl3aWMzVmlJam9pUVVGRFJ6WTJNVGd5TnlJc0ltVjRjQ0k2TVRjM056UXpOVFk1T1N3aWJtSm1Jam94TnpjM016UTVNVEU1TENKcFlYUWlPakUzTnpjek5Ea3hNVGtzSW1wMGFTSTZJbUV3T0RGa1lqTmtMVGhsWm1VdE5EWm1ZeTA1TmpNMUxUUXhZemcyTlRrNVlXRTVNaUlzSWxSdmEyVnVJam9pSW4wLmZBNFRPVjFiVGtYdGFkck15VUhPcWxXLUUwU2hocDU0YWg0ZklPeTdiTllMTi11QXl0dE5LemlTc1g2bEVNXzNYcTN2TEhUSFdtZzhOX0RpbEFLdFZ6VDZHdW56UTBlcVBrNlQ0N2xvVG05RjVxZDNHRHYxVHJrdUZkWnI3bFVvN05TX1dxOUpHQWs2RnBhVXplQ0Y2R3NYY0ZsWklmamh3V3FEZXdQaEdkMCIsIkFQSS1LRVkiOiJ1Vk5INUR0QyIsIlgtT0xELUFQSS1LRVkiOmZhbHNlLCJpYXQiOjE3NzczNDkyOTksImV4cCI6MTc3NzQwMTAwMH0.4t0l4-LV_xfqn70jCPonMBw94-ErArTbUByCBn2bSGQbhy0SQfrP7XAma4uT5z0fFv4zSPOl7cvmEN_MBXbWKw",
  publicIP: process.env.Smart_API_PublicIP ?? "45.114.212.194",
  localIP: process.env.Smart_API_LocalIP ?? "127.0.0.1",
  capital: process.env.Capital ?? 100000,
  risk_per_trade: process.env.Risk_Per_Trade ?? 40,
};

// ---------------- AXIOS BASE CLIENT (AngelOne) ----------------
const angelClient = axios.create({
  baseURL: "https://apiconnect.angelone.in",
  headers: {
    Authorization: `Bearer ${CONFIG.jwtToken}`,
    Accept: "application/json",
    "X-SourceID": "WEB",
    "X-UserType": "USER",
    "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": "45.114.212.194",
    "X-MACAddress": "02:00:00:00:00:00",
    "X-PrivateKey": CONFIG.apiKey,
    "Content-Type": "application/json",
  },
});

// ---------------- TECHNICAL HELPERS ----------------
const average = (arr) =>
  arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

// ================================================================
//  CANDLE-CLOSE GUARD
// ================================================================
function isNearCandleClose() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const secondsIntoInterval = (minutes % 15) * 60 + seconds;
  return secondsIntoInterval <= 150;
}

// ================================================================
//  NIFTY BEARISH SENTIMENT ENGINE — uses AngelOne API
// ================================================================
async function getNiftyBearishSentiment() {
  const today = new Date().toISOString().split("T")[0];
  try {
    const intraDayRes = await angelClient.post(
      "/rest/secure/angelbroking/historical/v1/getCandleData",
      {
        exchange: "NSE",
        symboltoken: "99926000",
        interval: "FIFTEEN_MINUTE",
        fromdate: `${today} 09:15`,
        todate: `${today} 15:30`,
      },
    );

    const dailyRes = await angelClient.post(
      "/rest/secure/angelbroking/historical/v1/getCandleData",
      {
        exchange: "NSE",
        symboltoken: "99926000",
        interval: "ONE_DAY",
        fromdate: "2026-04-01 09:15",
        todate: `${today} 15:30`,
      },
    );

    const quotes = intraDayRes.data?.data;
    const dailyQuotes = dailyRes.data?.data;

    if (!quotes || quotes.length === 0) {
      return { isBearish: false, reason: "Market Not Open" };
    }

    const yesterdayClose = dailyQuotes[dailyQuotes.length - 2][4];
    const last = quotes[quotes.length - 1];
    const [, open, high, low, close, volume] = last;

    let tVal = 0,
      tVol = 0;
    quotes.forEach((q) => {
      tVal += q[4] * (q[5] || 1);
      tVol += q[5] || 1;
    });
    const vwap = tVal / tVol;

    const isBelowPrev = close < yesterdayClose;
    const isBelowVWAP = close < vwap * 1.0002;
    const isStrongRed =
      high - low > 0 ? Math.abs(close - open) / (high - low) > 0.3 : false;

    const isBearish = isBelowPrev && (isBelowVWAP || isStrongRed);

    return {
      isBearish,
      price: close.toFixed(2),
      status: isBearish ? "🔴 WEAK" : "🟢 NEUTRAL",
    };
  } catch (err) {
    console.error("❌ Nifty Bearish Sentiment Error:", err.message);
    return { isBearish: false, status: "ERR" };
  }
}

// ===============================================================
// Last price of stock — mirrors bullish script exactly
// ===============================================================
async function getLastPrice(symboltoken, exchange = "NSE") {
  try {
    const res = await angelClient.post(
      "/rest/secure/angelbroking/market/v1/quote/",
      {
        mode: "LTP",
        exchangeTokens: {
          [exchange]: [symboltoken],
        },
      },
    );

    const ltp = res.data?.data?.fetched?.[0]?.ltp;
    return ltp;
  } catch (err) {
    console.error(`❌ LTP fetch failed — ${err.message}`);
    return null;
  }
}

// ================================================================
//  BEARISH STOCK SIGNAL ENGINE — uses Yahoo Finance API
// ================================================================
async function getBearishExpertSignal(symbol, niftyStatus, smartAPISymbol) {
  try {
    console.log("By Passing Nifty Filter", niftyStatus, symbol,smartAPISymbol);

    // if (!niftyStatus.isBearish) {
    //   return { status: "WAITING", reason: "Nifty Bullish/Strong" };
    // }

    const intradayData = await yf.chart(`${symbol}.NS`, {
      period1: Math.floor(Date.now() / 1000) - 48 * 60 * 60,
      interval: "15m",
    });

    const dailyData = await yf.chart(`${symbol}.NS`, {
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

    if (todayQuotes.length < 3) {
      return {
        status: "WAITING",
        reason: `Data Sync (${todayQuotes.length}/3)`,
      };
    }

    const yesterdayClose = dQuotes[dQuotes.length - 2].close;

    const gapPercent =
      ((todayQuotes[0].open - yesterdayClose) / yesterdayClose) * 100;
    if (gapPercent < -5.0)
      return { status: "REJECTED", reason: "High Gap Down" };

    const morningLow = Math.min(todayQuotes[0].low, todayQuotes[1].low);
    const avgMorningVol = (todayQuotes[0].volume + todayQuotes[1].volume) / 2;

const lastIdx = todayQuotes.length - 1;
let sVal = 0, sVol = 0;
for (let k = 0; k <= lastIdx; k++) {
  sVal += todayQuotes[k].close * todayQuotes[k].volume;
  sVol += todayQuotes[k].volume;
}

    const stockVWAP = sVal / sVol;
    const lastCandle = todayQuotes[todayQuotes.length - 1];
    const prevCandle = todayQuotes[todayQuotes.length - 2];
    const secondCandle = todayQuotes[1];

    const isBearishCandle = lastCandle.close < lastCandle.open;

    // ── BEARISH OPENING DRIVE LOGIC ───────────────────────────────────
    const historicalOpeningCandles = iQuotes.filter((q) => {
      const date = new Date(q.date);
      const istDate = new Date(
        date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      );
      const hours = istDate.getHours();
      const minutes = istDate.getMinutes();
      const dateStr = istDate.toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      });
      return dateStr !== todayStr && hours === 9 && minutes === 15;
    });

    const historicalAvgVol = average(
      historicalOpeningCandles.map((q) => q.volume),
    );

    const firstCandle = todayQuotes[0];
    const firstBody = Math.abs(firstCandle.close - firstCandle.open);
    const firstRange = firstCandle.high - firstCandle.low;
    const firstBodyRatio = firstRange > 0 ? firstBody / firstRange : 0;

    const isOpeningDriveBearish =
          firstCandle.close < firstCandle.open &&        // first candle is red
          firstCandle.volume > historicalAvgVol * 1.5 && // above average volume
          lastCandle.close < firstCandle.open;            // still holding below open

    // ── REGULAR BEARISH CONDITIONS ────────────────────────────────────
    const morningRange =
      Math.max(todayQuotes[0].high, todayQuotes[1].high) -
      Math.min(todayQuotes[0].low, todayQuotes[1].low);
    const isMeaningfulMorningRange = morningRange > lastCandle.close * 0.003;

    const isBreakdown =
      isBearishCandle &&
      isMeaningfulMorningRange &&
      lastCandle.close < morningLow * 0.999 &&
      prevCandle.close >= morningLow &&
      lastCandle.close < stockVWAP;

    const candleMid = (lastCandle.high + lastCandle.low) / 2;
    const testedVWAP = lastCandle.high >= stockVWAP * 0.9992;
    const closeBelowMid = lastCandle.close < candleMid;

    const isLosingValue =
      isBearishCandle &&
      prevCandle.close > stockVWAP &&
      lastCandle.close < stockVWAP * 0.9995 &&
      testedVWAP &&
      closeBelowMid;

    const hasVolumeSurge = lastCandle.volume > avgMorningVol * 1.5;

    const sBody = Math.abs(lastCandle.close - lastCandle.open);
    const sRange = lastCandle.high - lastCandle.low;

    const isStrongRed =
      isBearishCandle && (sRange > 0 ? sBody / sRange > 0.5 : false);

    const isRegularBearishSignal =
      hasVolumeSurge && isStrongRed && (isBreakdown || isLosingValue);
    const isOpeningDriveBearishSignal = isOpeningDriveBearish && isStrongRed;

    if (isRegularBearishSignal || isOpeningDriveBearishSignal) {
      console.log("lastCandle.close", lastCandle.close);
      console.log("stockVWAP", stockVWAP);
      console.log("prevCandle.close", prevCandle.close);
      console.log("lastCandle.volume", lastCandle.volume);
      console.log("isStrongRed", sBody / sRange);
      console.log("Stock is going to place SHORT");

const signalType = isOpeningDriveBearishSignal
  ? "OPENING_DRIVE"
  : isBreakdown
    ? "BREAKDOWN"
    : "VALUE_LOSS";

      // ── Fetch live LTP via SmartAPI (mirrors bullish script) ──────────
      const lastPrice = await getLastPrice(smartAPISymbol);

            // ── Guard: LTP fetch failed ───────────────────────────────────────
      if (lastPrice == null || lastPrice == undefined || lastPrice == 0) {
        console.log(`⚠️ Failed to fetch LTP for ${symbol}. Using last candle close as fallback.`);
        return { status: "Error", price: lastCandle.close.toFixed(2), reason: "LTP Fetch Failed" };
      }

      const getTimeAdjustedTarget = await getTimeAdjustedTargets(
        lastPrice,
        signalType,
        new Date(lastCandle.date)
      );

      // ── Guard: Too late to trade ──────────────────────────────────────
      if (!getTimeAdjustedTarget) {
        return { status: "WAITING", reason: "Too Late To Trade" };
      }

      const showDate = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      });

      return {
        status: "TRIGGERED",
        type: getTimeAdjustedTarget.session,
        symbol: symbol,          // live LTP used as symbolKey (mirrors bullish)
        price: lastPrice.toFixed(2),
        time: showDate,
        date: todayStr,
        target: getTimeAdjustedTarget.target,
        stopLoss: getTimeAdjustedTarget.stopLoss,
        riskReward: getTimeAdjustedTarget.riskReward,
        stockToken: smartAPISymbol, // stored for order placement
      };
    }

    return { status: "WAITING", price: lastCandle.close.toFixed(2) };
  } catch (err) {
    return { status: "ERROR", message: err.message };
  }
}

// ================================================================
//  TIME-ADJUSTED TARGETS — BEARISH (SHORT) VERSION
//  Target / SL percentages now mirror bullish mode exactly.
//  Direction is inverted: target goes DOWN, stopLoss goes UP.
// ================================================================
async function getTimeAdjustedTargets(entryPrice, signalType, candleDate) {
  const istString = candleDate.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const istTime   = new Date(istString);
  const hour      = istTime.getHours();
  const minutes   = istTime.getMinutes();

  const minutesLeft = (15 * 60 + 15) - (hour * 60 + minutes);
  const hoursLeft   = minutesLeft / 60;

  if (hoursLeft < 2.0) return null;

  // ── OPENING DRIVE ─────────────────────────────────────────────
  // Mirrors bull: 0.70% target / 0.35% SL = 2.0 RR (inverted for short)
  if (signalType === "OPENING_DRIVE") {
    if (hoursLeft >= 4.5) {
      return {
        target:     (entryPrice * (1 - 0.0100)).toFixed(2), // -1.0%
        stopLoss:   (entryPrice * (1 + 0.0060)).toFixed(2), // +0.60%
        riskReward: "2.0",
        session:    "EARLY DRIVE",
      };
    } else if (hoursLeft >= 3.0) {
      return {
        target:     (entryPrice * (1 - 0.0100)).toFixed(2), // -1.0%
        stopLoss:   (entryPrice * (1 + 0.0060)).toFixed(2), // +0.60%
        riskReward: "2.0",
        session:    "MID DRIVE",
      };
    } else {
      return null;
    }
  }

  // ── BREAKDOWN (mirrors BREAKOUT) ───────────────────────────────
  // Mirrors bull: 1.0% target / 0.5% SL early; 0.8% / 0.4% mid
  if (signalType === "BREAKDOWN") {
    if (hoursLeft >= 4.5) {
      return {
        target:     (entryPrice * (1 - 0.0100)).toFixed(2), // -1.0%
        stopLoss:   (entryPrice * (1 + 0.0060)).toFixed(2), // +0.60%
        riskReward: "1.7",
        session:    "EARLY BREAKDOWN",
      };
    } else if (hoursLeft >= 3.0) {
      return {
        target:     (entryPrice * (1 - 0.0100)).toFixed(2), // -1.0%
        stopLoss:   (entryPrice * (1 + 0.0060)).toFixed(2), // +0.60%
        riskReward: "1.8",
        session:    "MID BREAKDOWN",
      };
    } else {
      return null;
    }
  }

  // ── VALUE LOSS (mirrors REVERSAL) ──────────────────────────────
  // Mirrors bull REVERSAL: early tight, mid wide, late tight
  if (signalType === "VALUE_LOSS") {
    if (hoursLeft >= 4.5) {
      return {
        target:     (entryPrice * (1 - 0.0100)).toFixed(2), // -1.0%
        stopLoss:   (entryPrice * (1 + 0.0060)).toFixed(2), // +0.60%
        riskReward: "2.0",
        session:    "EARLY VALUE LOSS",
      };
    } else if (hoursLeft >= 3.0) {
      return {
        target:     (entryPrice * (1 - 0.0100)).toFixed(2), // -1.0%
        stopLoss:   (entryPrice * (1 + 0.0060)).toFixed(2), // +0.60%
        riskReward: "1.8",
        session:    "MID VALUE LOSS",
      };
    } else {
      return {
        target:     (entryPrice * (1 - 0.0100)).toFixed(2), // -1.0%
        stopLoss:   (entryPrice * (1 + 0.0060)).toFixed(2), // +0.60%
        riskReward: "2.0",
        session:    "LATE VALUE LOSS",
      };
    }
  }

  // ── FALLBACK ──────────────────────────────────────────────────
  return {
    target:     (entryPrice * (1 - 0.0070)).toFixed(2),
    stopLoss:   (entryPrice * (1 + 0.0035)).toFixed(2),
    riskReward: "2.0",
    session:    "DEFAULT",
  };
}

// ---------------- DATABASE OPERATION ----------------
async function insertStock(signal) {
  const getStocks = await client.send(
    new ScanCommand({ TableName: PlaceStocks ?? "BearPlacedStocks" }),
  );

  if (getStocks.Items.length >= 2) {
    console.log("⚠️ Already have 2 stocks in the system. Skipping insertion.");
    return false;
  }

  console.log("SIGNAL TO INSERT", signal);

  const alreadyExists = getStocks.Items.some(
    (s) => s.symbolKey === signal.symbol,
  );
  if (alreadyExists) {
    console.log(`⚠️ ${signal.symbol} already tracked. Skipping.`);
    return false;
  }

  const c_date = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );

  const isInserted = await client.send(
    new PutCommand({
      TableName: PlaceStocks ?? "BearPlacedStocks",
      Item: {
        symbolKey: signal.symbol,
        price: signal.price,
        target: signal.target,
        transactiontype: "SELL",
        riskReward: signal.riskReward,
        stopLoss: signal.stopLoss,
        signalToken: signal.stockToken,   // ← added (mirrors bullish)
        limitPrice: "0",
        lots: "0",                          // ← added (mirrors bullish)
        type: signal.type,
        status: 0,
        createdAt: c_date.toString(),
        updatedAt: c_date.toString(),
      },
    }),
  );

  if (isInserted) {
    console.log(`✅ Signal for ${signal.symbol} stored in DB.`);
    await placeStock(signal);
    return true;
  }

  console.log(`❌ Failed to store signal for ${signal.symbol}.`);
  return false;
}

// ---------------- ORDER PLACEMENT ----------------
async function placeStock(signal) {
  // ── Lot calculation (mirrors bullish calculateLots) ───────────
  const qty = await calculateLots(signal);

  if (!qty || qty < 1) {
    console.log(`⚠️ Qty < 1 for ${signal.symbol}. Skipping.`);
    return;
  }

  // For shorts: limit price is 0.3% BELOW current price (better fill on SELL)
  const limitPrice    = parseFloat((parseFloat(signal.price) * 0.997).toFixed(2));
  const squareoffDiff = parseFloat((limitPrice - parseFloat(signal.target)).toFixed(2));  // price drops → profit
  const stoplossDiff  = parseFloat((parseFloat(signal.stopLoss) - limitPrice).toFixed(2)); // price rises → loss

  if (squareoffDiff <= 0 || stoplossDiff <= 0) {
    console.log(`⚠️ Invalid SL/Target for ${signal.symbol}. Skipping.`);
    return;
  }

  const payload = {
    variety:          "ROBO",
    tradingsymbol:    `${signal.symbol}-EQ`,
    symboltoken:      signal.stockToken,
    transactiontype:  "SELL",
    exchange:         "NSE",
    ordertype:        "LIMIT",
    producttype:      "INTRADAY",
    duration:         "DAY",
    price:            limitPrice.toString(),
    squareoff:        squareoffDiff.toString(),
    stoploss:         stoplossDiff.toString(),
    trailingStopLoss: "0",
    quantity:         qty.toString(),
  };

  // const res = await angelClient.post(
  //   "/rest/secure/angelbroking/order/v1/placeOrder",
  //   payload,
  // );

  // if (res.data?.status === true) {
  //   console.log(`✅ SHORT order placed : ${signal.symbol} @ ₹${limitPrice}`);
  //   console.log(`   Order ID          : ${res.data?.data?.orderid}`);
  //   console.log(`   Qty               : ${qty}`);
  //   console.log(`   Target            : ₹${signal.target} (-₹${squareoffDiff})`);
  //   console.log(`   Stop Loss         : ₹${signal.stopLoss} (+₹${stoplossDiff})`);
  // } else {
  //   console.log(`❌ Order failed : ${signal.symbol}`);
  //   console.log(`   Reason       : ${res.data?.message || "Unknown"}`);
  //   return null;
  // }

  // ── Update DB status to Executed (1) ──────────────────────────
  const getStockInfo = await client.send(
    new GetCommand({
      TableName: PlaceStocks ?? "BearPlacedStocks",
      Key: { symbolKey: signal.symbol },
    }),
  );

  if (!getStockInfo.Item) {
    console.log(`⚠️ No record found for ${signal.symbol}. Cannot update status.`);
    return;
  }

  const c_date = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );

  await client.send(
    new PutCommand({
      TableName: PlaceStocks ?? "BearPlacedStocks",
      Item: {
        symbolKey:       getStockInfo.Item.symbolKey,
        price:           getStockInfo.Item.price,
        target:          getStockInfo.Item.target,
        stopLoss:        getStockInfo.Item.stopLoss,
        riskReward:      getStockInfo.Item.riskReward,
        signalToken:     getStockInfo.Item.signalToken,
        transactiontype: "SELL",
        limitPrice:      limitPrice.toString(),
        lots:            qty.toString(),
        type:            getStockInfo.Item.type,
        status:          1, // 0 = Placed, 1 = Executed, 2 = Closed
        createdAt:       getStockInfo.Item.createdAt,
        updatedAt:       c_date.toString(),
      },
    }),
  );
}

// ----------------- LOT CALCULATION (mirrors bullish) ----------------
async function calculateLots(signal) {
  const capital = parseFloat(CONFIG.capital);
  const risk_per_trade = parseFloat(CONFIG.risk_per_trade);
  const amount = (capital * risk_per_trade) / 100;
  const qty = Math.floor((amount * 5) / parseFloat(signal.price));
  return qty;
}

// ================================================================
//  MAIN CRON — Entry Point
// ================================================================
export const Bcron = async () => {
  const time = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  console.log(`\n🔍 Bearish Scan Started: ${time}`);

  if (!isNearCandleClose()) {
    console.log(
      `⏭️  Skipping — not near a 15m candle close. Next candle closes at :${String(
        (Math.floor(
          new Date(
            new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
          ).getMinutes() / 15,
        ) +
          1) *
          15,
      ).padStart(2, "0")}`,
    );
    return;
  }

  console.log("━".repeat(55));

  // ── Step 1: Nifty Bearish Sentiment via AngelOne ────────────────
  const nifty = await getNiftyBearishSentiment();

  console.log(`NIFTY: ${nifty.status || "N/A"} @ ₹${nifty.price || "?"}`);

  if (nifty.status === "ERR") {
    console.error("❌ Aborted: Could not fetch Nifty data.");
    return;
  }

  console.log("━".repeat(55));

  // ── Step 2: Scan stocks via Yahoo Finance ──────────────────────
  for (const [symbolKey, stockData] of Object.entries(Barish_STOCKS)) {
    try {
      const signal = await getBearishExpertSignal(symbolKey, nifty, stockData.token);

      if (signal.status === "TRIGGERED") {
        console.log(
          `🔥 [${signal.type}] SHORT: ${symbolKey} @ ₹${signal.price} | 🎯 ${signal.target} | 🛑 ${signal.stopLoss}`,
        );
        await insertStock(signal);
      } else {
        const statusLabel =
          {
            WAITING: `⏳ ${signal.reason || "Monitoring"}`,
            REJECTED: `🚫 ${signal.reason}`,
            SYNCING: "🔄 Syncing",
            ERROR: `❌ ${signal.message || "Error"}`,
          }[signal.status] || signal.status;

        console.log(`${symbolKey.padEnd(14)}: ${statusLabel}`);
      }
    } catch (err) {
      console.error(`Error processing ${symbolKey}:`, err.message);
    }
  }

  console.log("━".repeat(55));
  console.log(
    `🔍 Bearish Scan Complete: ${new Date().toLocaleTimeString("en-IN")}\n`,
  );
};

// await Bcron();