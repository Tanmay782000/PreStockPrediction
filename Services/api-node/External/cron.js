import axios from "axios";
import yahooFinance from "yahoo-finance2";
import { PutCommand, ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { client } from "../db/dynamo.client.js";
import { BullStocks } from "../Common/stockInfo.js";

const yf = new yahooFinance();

const PlaceStocks = process.env.PlacedStocksTable;
const Bullish_STOCKS = BullStocks;

// ---------------- CONFIGURATION ----------------
const CONFIG = {
  apiKey: process.env.Smart_API_KEY ?? "uVNH5DtC",
  jwtToken:
    process.env.Smart_API_JWT_TOKEN ??
    "eyJhbGciOiJIUzUxMiJ9.eyJ1c2VybmFtZSI6IkFBQ0c2NjE4MjciLCJyb2xlcyI6MCwidXNlcnR5cGUiOiJVU0VSIiwidG9rZW4iOiJleUpoYkdjaU9pSlNVekkxTmlJc0luUjVjQ0k2SWtwWFZDSjkuZXlKMWMyVnlYM1I1Y0dVaU9pSmpiR2xsYm5RaUxDSjBiMnRsYmw5MGVYQmxJam9pZEhKaFpHVmZZV05qWlhOelgzUnZhMlZ1SWl3aVoyMWZhV1FpT2pNc0luTnZkWEpqWlNJNklqTWlMQ0prWlhacFkyVmZhV1FpT2lJd05UWmhaRGs1WWkxaE1qWTFMVE5tTkdVdFlXSmlOaTA1T0RabFltSTNOalk0Wm1JaUxDSnJhV1FpT2lKMGNtRmtaVjlyWlhsZmRqSWlMQ0p2Ylc1bGJXRnVZV2RsY21sa0lqb3pMQ0p3Y205a2RXTjBjeUk2ZXlKa1pXMWhkQ0k2ZXlKemRHRjBkWE1pT2lKaFkzUnBkbVVpZlN3aWJXWWlPbnNpYzNSaGRIVnpJam9pWVdOMGFYWmxJbjE5TENKcGMzTWlPaUowY21Ga1pWOXNiMmRwYmw5elpYSjJhV05sSWl3aWMzVmlJam9pUVVGRFJ6WTJNVGd5TnlJc0ltVjRjQ0k2TVRjM056UXpOVFk1T1N3aWJtSm1Jam94TnpjM016UTVNVEU1TENKcFlYUWlPakUzTnpjek5Ea3hNVGtzSW1wMGFTSTZJbUV3T0RGa1lqTmtMVGhsWm1VdE5EWm1ZeTA1TmpNMUxUUXhZemcyTlRrNVlXRTVNaUlzSWxSdmEyVnVJam9pSW4wLmZBNFRPVjFiVGtYdGFkck15VUhPcWxXLUUwU2hocDU0YWg0ZklPeTdiTllMTi11QXl0dE5LemlTc1g2bEVNXzNYcTN2TEhUSFdtZzhOX0RpbEFLdFZ6VDZHdW56UTBlcVBrNlQ0N2xvVG05RjVxZDNHRHYxVHJrdUZkWnI3bFVvN05TX1dxOUpHQWs2RnBhVXplQ0Y2R3NYY0ZsWklmamh3V3FEZXdQaEdkMCIsIkFQSS1LRVkiOiJ1Vk5INUR0QyIsIlgtT0xELUFQSS1LRVkiOmZhbHNlLCJpYXQiOjE3NzczNDkyOTksImV4cCI6MTc3NzQwMTAwMH0.4t0l4-LV_xfqn70jCPonMBw94-ErArTbUByCBn2bSGQbhy0SQfrP7XAma4uT5z0fFv4zSPOl7cvmEN_MBXbWKw",
  publicIP: process.env.Smart_API_PublicIP ?? "45.114.212.194", // From your earlier whitelisting screenshot
  localIP: process.env.Smart_API_LocalIP ?? "127.0.0.1",
  capital: process.env.Capital ?? 100000,
  risk_per_trade: process.env.Risk_Per_Trade ?? 40,
};

// ---------------- AXIOS BASE CLIENT (AngelOne) ----------------
// Used exclusively for Nifty index data (not available on Yahoo Finance)
const angelClient = axios.create({
  baseURL: "https://apiconnect.angelone.in",
  headers: {
    Authorization: `Bearer ${CONFIG.jwtToken}`,
    Accept: "application/json",
    "X-SourceID": "WEB",
    "X-UserType": "USER",
    "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": "15.207.159.248",
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
//  Cron fires at :01, :16, :31, :46 (1 min after candle close)
//  Candles close at :00, :15, :30, :45
//  Allow 2-min buffer for any cron delay
// ================================================================
function isNearCandleClose() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const secondsIntoInterval = (now.getMinutes() % 15) * 60 + now.getSeconds();
  return secondsIntoInterval <= 120;
}

// ================================================================
//  HELPERS
// ================================================================
function toISTDateStr(date) {
  return new Date(date).toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
}

function isISTToday(date, todayStr) {
  return toISTDateStr(date) === todayStr;
}

function validateCandleInterval(quotes, expectedMinutes = 15) {
  if (quotes.length < 2) return false;
  const diffs = [];
  for (let i = 1; i < Math.min(quotes.length, 5); i++) {
    const diff = (new Date(quotes[i].date) - new Date(quotes[i - 1].date)) / 60000;
    diffs.push(diff);
  }
  const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  return Math.abs(avg - expectedMinutes) < 2;
}

// ================================================================
//  NIFTY SENTIMENT ENGINE — uses AngelOne API
// ================================================================
async function getNiftySentiment() {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
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
      return { isBullish: false, reason: "Market Not Open" };
    }

    const yesterdayClose = dailyQuotes[dailyQuotes.length - 2][4];

    // Drop live candle from Nifty too — same logic
    const closedQuotes = (() => {
      if (quotes.length < 2) return quotes;
      const last = quotes[quotes.length - 1];
      const prev = quotes[quotes.length - 2];
      // AngelOne format: [timestamp, open, high, low, close, volume]
      const lastTs = new Date(last[0]).getTime();
      const prevTs = new Date(prev[0]).getTime();
      const intervalMs = lastTs - prevTs;
      const candleCloseTime = lastTs + intervalMs;
      if (candleCloseTime > Date.now()) return quotes.slice(0, -1);
      return quotes;
    })();

    if (closedQuotes.length === 0) {
      return { isBullish: false, reason: "Market Not Open" };
    }

    const last = closedQuotes[closedQuotes.length - 1];
    const [, open, high, low, close] = last;

    let tVal = 0, tVol = 0;
    closedQuotes.forEach((q) => {
      tVal += q[4] * q[5];
      tVol += q[5];
    });
    const vwap = tVol > 0 ? tVal / tVol : 0;

    const isAbovePrev = close > yesterdayClose;
    const isAboveVWAP = close > vwap * 0.9998;
    const bodyToRange = high - low > 0 ? Math.abs(close - open) / (high - low) : 0;
    const isStrong = bodyToRange > 0.3;
    const isBullish = isAbovePrev && (isAboveVWAP || isStrong);

    return {
      isBullish,
      price: close.toFixed(2),
      status: isBullish ? "🟢 STRONG" : "🔴 WEAK",
    };
  } catch (err) {
    console.error("❌ Nifty Sentiment Error:", err.message);
    return { isBullish: false, status: "ERR" };
  }
}

// ================================================================
//  LAST PRICE — SmartAPI LTP
// ================================================================
async function getLastPrice(symboltoken, exchange = "NSE") {
  try {
    const res = await angelClient.post(
      "/rest/secure/angelbroking/market/v1/quote/",
      {
        mode: "LTP",
        exchangeTokens: { [exchange]: [symboltoken] },
      },
    );
    return res.data?.data?.fetched?.[0]?.ltp ?? null;
  } catch (err) {
    console.error(`❌ LTP fetch failed — ${err.message}`);
    return null;
  }
}

// ================================================================
//  STOCK SIGNAL ENGINE
// ================================================================
async function getExpertTimingSignal(symbol, niftyStatus, smartAPISymbol) {
  try {
    console.log("Processing:", symbol, smartAPISymbol);

    const intradayData = await yf.chart(`${symbol}.NS`, {
      period1: Math.floor(Date.now() / 1000) - 5 * 24 * 60 * 60,
      period2: Math.floor(Date.now() / 1000),
      interval: "15m",
      includePrePost: false,
    });

    const dailyData = await yf.chart(`${symbol}.NS`, {
      period1: Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60,
      interval: "1d",
    });

    const iQuotes = intradayData.quotes.filter((q) => q.close && q.volume);
    const dQuotes = dailyData.quotes.filter((q) => q.close);

    const todayStr = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });

    // ── Step 1: filter today's candles using IST ──────────────────
    const allTodayQuotes = iQuotes.filter((q) => isISTToday(q.date, todayStr));

    // ── Step 2: validate interval — catch Yahoo returning 1m candles
    if (allTodayQuotes.length >= 2 && !validateCandleInterval(allTodayQuotes, 15)) {
      const actualInterval = (
        (new Date(allTodayQuotes[1].date) - new Date(allTodayQuotes[0].date)) / 60000
      ).toFixed(0);
      console.error(`❌ Wrong interval for ${symbol}: got ${actualInterval}min candles`);
      return { status: "REJECTED", reason: `Wrong interval (${actualInterval}m)` };
    }

    // ── Step 3: drop live (unclosed) candle ───────────────────────
    //    Cron fires at :01/:16/:31/:46 — 1 min after candle close.
    //    But the candle that OPENED at :45 doesn't close until :00.
    //    So at 9:46, the 9:45 candle is still live — drop it.
    const todayQuotes = (() => {
      if (allTodayQuotes.length < 2) return allTodayQuotes;
      const last = allTodayQuotes[allTodayQuotes.length - 1];
      const prev = allTodayQuotes[allTodayQuotes.length - 2];
      const intervalMs = new Date(last.date) - new Date(prev.date); // 900000ms
      const candleCloseTime = new Date(last.date).getTime() + intervalMs;
      if (candleCloseTime > Date.now()) {
        console.log(
          `⚠️ Dropping live candle: ${new Date(last.date).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}`,
        );
        return allTodayQuotes.slice(0, -1);
      }
      return allTodayQuotes;
    })();

    // Need at least 2 closed candles for signal logic
    // Earliest possible: 10:01 cron tick (9:15, 9:30, 9:45 all closed)
    if (todayQuotes.length < 2)
      return { status: "WAITING", reason: `Need 2 closed candles (${todayQuotes.length}/2)` };

    if (dQuotes.length < 2)
      return { status: "WAITING", reason: "Insufficient daily data" };

    // ── Calculations ──────────────────────────────────────────────
    const yesterdayClose = dQuotes[dQuotes.length - 2].close;
    const gapPercent = ((todayQuotes[0].open - yesterdayClose) / yesterdayClose) * 100;

    if (gapPercent > 5.0) return { status: "REJECTED", reason: "High Gap" };

    // Morning range = first two closed 15m candles (9:15 + 9:30)
    const morningHigh = Math.max(todayQuotes[0].high, todayQuotes[1].high);
    const avgMorningVol = (todayQuotes[0].volume + todayQuotes[1].volume) / 2;

    // VWAP across all closed candles today
    let sVal = 0, sVol = 0;
    for (let k = 0; k < todayQuotes.length; k++) {
      sVal += todayQuotes[k].close * todayQuotes[k].volume;
      sVol += todayQuotes[k].volume;
    }
    const stockVWAP = sVol > 0 ? sVal / sVol : 0;

    // lastCandle  = most recent CLOSED candle
    // prevCandle  = one before that
    const lastCandle = todayQuotes[todayQuotes.length - 1];
    const prevCandle = todayQuotes[todayQuotes.length - 2];
    const firstCandle = todayQuotes[0];

    console.log(
      `   lastCandle  : ${new Date(lastCandle.date).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} close=${lastCandle.close}`,
    );
    console.log(
      `   prevCandle  : ${new Date(prevCandle.date).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} close=${prevCandle.close}`,
    );

    // ── Signal logic ──────────────────────────────────────────────
    const isBullishCandle = lastCandle.close > lastCandle.open;

    const morningRange =
      Math.max(todayQuotes[0].high, todayQuotes[1].high) -
      Math.min(todayQuotes[0].low, todayQuotes[1].low);
    const isMeaningfulMorningRange = morningRange > lastCandle.close * 0.003;

    const isBreakout =
      isBullishCandle &&
      isMeaningfulMorningRange &&
      lastCandle.close > morningHigh * 1.001 &&
      prevCandle.close <= morningHigh &&
      lastCandle.close > stockVWAP;

    const candleMid = (lastCandle.high + lastCandle.low) / 2;
    const testedVWAP = lastCandle.low <= stockVWAP * 1.0008;
    const closeAboveMid = lastCandle.close > candleMid;

    const isReclaimingValue =
      isBullishCandle &&
      prevCandle.close < stockVWAP &&
      lastCandle.close > stockVWAP * 1.0005 &&
      testedVWAP &&
      closeAboveMid;

    const hasVolumeSurge = lastCandle.volume > avgMorningVol * 1.5;

    const sBody = Math.abs(lastCandle.close - lastCandle.open);
    const sRange = lastCandle.high - lastCandle.low;
    const isStrongCandle =
      isBullishCandle && (sRange > 0 ? sBody / sRange > 0.5 : false);

    // Historical opening candles — 4 prev days for real avg vol
    const historicalOpeningCandles = iQuotes.filter((q) => {
      if (isISTToday(q.date, todayStr)) return false;
      const ist = new Date(
        new Date(q.date).toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      );
      return ist.getHours() === 9 && ist.getMinutes() === 15;
    });

    const historicalAvgVol =
      historicalOpeningCandles.length > 0
        ? average(historicalOpeningCandles.map((q) => q.volume))
        : firstCandle.volume;

    const isOpeningDrive =
      firstCandle.close > firstCandle.open &&
      firstCandle.volume > historicalAvgVol * 1.5 &&
      lastCandle.close > firstCandle.open &&
      lastCandle.close > stockVWAP;

    const isRegularSignal =
      hasVolumeSurge && isStrongCandle && (isBreakout || isReclaimingValue);
    const isOpeningDriveSignal = isOpeningDrive && isStrongCandle;

    if (isRegularSignal || isOpeningDriveSignal) {
      const signalType = isBreakout
        ? "BREAKOUT"
        : isOpeningDriveSignal
          ? "OPENING_DRIVE"
          : "REVERSAL";

      console.log(`\n🔥 SIGNAL: ${symbol} — ${signalType}`);
      console.log(`   Closed candles  : ${todayQuotes.length}`);
      console.log(`   lastCandle.close: ${lastCandle.close}`);
      console.log(`   stockVWAP       : ${stockVWAP.toFixed(2)}`);
      console.log(`   prevCandle.close: ${prevCandle.close}`);
      console.log(`   volume surge    : ${lastCandle.volume} vs avg ${avgMorningVol.toFixed(0)}`);
      console.log(`   body/range      : ${(sBody / sRange).toFixed(2)}`);
      console.log(`   hist candles    : ${historicalOpeningCandles.length}`);

      const lastPrice = await getLastPrice(smartAPISymbol);

      if (!lastPrice) {
        console.log(`⚠️ LTP fetch failed for ${symbol}.`);
        return {
          status: "Error",
          price: lastCandle.close.toFixed(2),
          reason: "LTP Fetch Failed",
        };
      }

      const timeAdjusted = await getTimeAdjustedTargets(
        lastPrice,
        signalType,
        new Date(lastCandle.date),
      );

      if (!timeAdjusted) {
        console.log(`⏭️ ${symbol} — outside valid trading window`);
        return { status: "WAITING", reason: "Outside Trading Window" };
      }

      return {
        status: "TRIGGERED",
        type: timeAdjusted.session,
        symbol,
        price: lastPrice.toFixed(2),
        time: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        date: todayStr,
        target: timeAdjusted.target,
        stopLoss: timeAdjusted.stopLoss,
        riskReward: timeAdjusted.riskReward,
        stockToken: smartAPISymbol,
      };
    }

    return { status: "WAITING", price: lastCandle.close.toFixed(2) };
  } catch (err) {
    console.error(`❌ Error in getExpertTimingSignal(${symbol}):`, err.message);
    return { status: "ERROR", message: err.message };
  }
}

// ================================================================
//  TIME ADJUSTED TARGETS
// ================================================================
async function getTimeAdjustedTargets(entryPrice, signalType, candleDate) {
  const istTime = new Date(
    candleDate.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const minutesLeft = 15 * 60 + 15 - (istTime.getHours() * 60 + istTime.getMinutes());
  const hoursLeft = minutesLeft / 60;

  if (hoursLeft < 2.0) return null;

  if (signalType === "OPENING_DRIVE") {
    if (hoursLeft >= 4.5) return { target: (entryPrice * 1.010).toFixed(2), stopLoss: (entryPrice * 0.994).toFixed(2), riskReward: "2.0", session: "EARLY DRIVE" };
    if (hoursLeft >= 3.0) return { target: (entryPrice * 1.010).toFixed(2), stopLoss: (entryPrice * 0.994).toFixed(2), riskReward: "2.0", session: "MID DRIVE" };
    return null;
  }

  if (signalType === "BREAKOUT") {
    if (hoursLeft >= 4.5) return { target: (entryPrice * 1.010).toFixed(2), stopLoss: (entryPrice * 0.994).toFixed(2), riskReward: "1.7", session: "EARLY BREAKOUT" };
    if (hoursLeft >= 3.0) return { target: (entryPrice * 1.010).toFixed(2), stopLoss: (entryPrice * 0.994).toFixed(2), riskReward: "1.8", session: "MID BREAKOUT" };
    return null;
  }

  if (signalType === "REVERSAL") {
    if (hoursLeft >= 4.5) return { target: (entryPrice * 1.010).toFixed(2), stopLoss: (entryPrice * 0.994).toFixed(2), riskReward: "2.0", session: "EARLY REVERSAL" };
    if (hoursLeft >= 3.0) return { target: (entryPrice * 1.010).toFixed(2), stopLoss: (entryPrice * 0.994).toFixed(2), riskReward: "1.8", session: "MID REVERSAL" };
    return { target: (entryPrice * 1.010).toFixed(2), stopLoss: (entryPrice * 0.994).toFixed(2), riskReward: "2.0", session: "LATE REVERSAL" };
  }

  return { target: (entryPrice * 1.007).toFixed(2), stopLoss: (entryPrice * 0.9965).toFixed(2), riskReward: "1.7", session: "DEFAULT" };
}

// ================================================================
//  DATABASE OPERATION
// ================================================================
async function insertStock(signal) {
  const getStocks = await client.send(
    new ScanCommand({ TableName: PlaceStocks ?? "PlacedStocks" }),
  );

  if (getStocks.Items.length >= 2) {
    console.log("⚠️ Already have 2 stocks. Skipping.");
    return false;
  }

  const alreadyExists = getStocks.Items.some((s) => s.symbolKey === signal.symbol);
  if (alreadyExists) {
    console.log(`⚠️ ${signal.symbol} already tracked. Skipping.`);
    return false;
  }

  const c_date = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );

  const isInserted = await client.send(
    new PutCommand({
      TableName: PlaceStocks ?? "PlacedStocks",
      Item: {
        symbolKey: signal.symbol,
        price: signal.price,
        target: signal.target,
        stopLoss: signal.stopLoss,
        riskReward: signal.riskReward,
        signalToken: signal.stockToken,
        limitPrice: "0",
        lots: "0",
        type: signal.type,
        transactiontype: "BUY",
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

// ================================================================
//  ORDER PLACEMENT
// ================================================================
async function placeStock(signal) {
  const qty = await calculateLots(signal);

  if (!qty || qty < 1) {
    console.log(`⚠️ Qty < 1 for ${signal.symbol}. Skipping.`);
    return;
  }

  const limitPrice    = parseFloat((parseFloat(signal.price) * 1.003).toFixed(2));
  const squareoffDiff = parseFloat((parseFloat(signal.target) - limitPrice).toFixed(2));
  const stoplossDiff  = parseFloat((limitPrice - parseFloat(signal.stopLoss)).toFixed(2));

  if (squareoffDiff <= 0 || stoplossDiff <= 0) {
    console.log(`⚠️ Invalid SL/Target for ${signal.symbol}. Skipping.`);
    return;
  }

  const payload = {
    variety:         "ROBO",
    tradingsymbol:   `${signal.symbol}-EQ`,
    symboltoken:     signal.stockToken,
    transactiontype: "BUY",
    exchange:        "NSE",
    ordertype:       "LIMIT",
    producttype:     "INTRADAY",
    duration:        "DAY",
    price:           limitPrice.toString(),
    squareoff:       squareoffDiff.toString(),
    stoploss:        stoplossDiff.toString(),
    trailingStopLoss:"0",
    quantity:        qty.toString(),
  };

  // const res = await angelClient.post('/rest/secure/angelbroking/order/v1/placeOrder', payload);
  // if (res.data?.status === true) {
  //   console.log(`✅ Order placed: ${signal.symbol} @ ₹${limitPrice}`);
  //   return res.data?.data?.orderid;
  // } else {
  //   console.log(`❌ Order failed: ${res.data?.message || "Unknown"}`);
  //   return null;
  // }

  const getStockInfo = await client.send(
    new GetCommand({
      TableName: PlaceStocks ?? "PlacedStocks",
      Key: { symbolKey: signal.symbol },
    }),
  );

  if (!getStockInfo.Item) {
    console.log(`⚠️ No record found for ${signal.symbol}.`);
    return;
  }

  const c_date = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );

  await client.send(
    new PutCommand({
      TableName: PlaceStocks ?? "PlacedStocks",
      Item: {
        ...getStockInfo.Item,
        lots: qty.toString(),
        limitPrice: limitPrice.toString(),
        transactiontype: "BUY",
        status: 1,
        updatedAt: c_date.toString(),
      },
    }),
  );
}

// ================================================================
//  LOT CALCULATION
// ================================================================
async function calculateLots(signal) {
  const capital = parseFloat(CONFIG.capital);
  const risk_per_trade = parseFloat(CONFIG.risk_per_trade);
  const amount = (capital * risk_per_trade) / 100;
  return Math.floor((amount * 5) / signal.price);
}

// ================================================================
//  MAIN CRON
// ================================================================
export const cron = async () => {
  const time = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  console.log(`\n🔍 Scan Started: ${time}`);

  if (!isNearCandleClose()) {
    console.log(`⏭️  Skipping — cron not aligned to candle close window`);
    return;
  }

  console.log("━".repeat(55));

  const nifty = await getNiftySentiment();
  console.log(`NIFTY: ${nifty.status || "N/A"} @ ₹${nifty.price || "?"}`);

  if (nifty.status === "ERR") {
    console.error("❌ Aborted: Could not fetch Nifty data.");
    return;
  }

  console.log("━".repeat(55));

  for (const [symbolKey, stockData] of Object.entries(Bullish_STOCKS)) {
    try {
      const signal = await getExpertTimingSignal(symbolKey, nifty, stockData.token);

      if (signal.status === "TRIGGERED") {
        console.log(
          `🔥 [${signal.type}] ${symbolKey} @ ₹${signal.price} | 🎯 ${signal.target} | 🛑 ${signal.stopLoss}`,
        );
        await insertStock(signal);
      } else {
        const label = {
          WAITING:  `⏳ ${signal.reason || "Monitoring"}`,
          REJECTED: `🚫 ${signal.reason}`,
          SYNCING:  "🔄 Syncing",
          ERROR:    `❌ ${signal.message || "Error"}`,
        }[signal.status] || signal.status;

        console.log(`${symbolKey.padEnd(14)}: ${label}`);
      }
    } catch (err) {
      console.error(`Error processing ${symbolKey}:`, err.message);
    }
  }

  console.log("━".repeat(55));
  console.log(`🔍 Scan Complete: ${new Date().toLocaleTimeString("en-IN")}\n`);
};
