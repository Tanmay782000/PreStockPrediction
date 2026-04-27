import axios from "axios";
import yahooFinance from "yahoo-finance2";
import { PutCommand, ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { client } from "../db/dynamo.client.js";
import { BearStocks } from "../Common/stockInfo.js";

const yf = new yahooFinance();

const PlaceStocks = process.env.PlacedStocksTable;
const Barish_STOCKS = BearStocks;
// ---------------- CONFIGURATION ----------------
const CONFIG = {
  apiKey: process.env.Smart_API_KEY ?? "uVNH5DtC",
  jwtToken:
    process.env.Smart_API_JWT_TOKEN ??
    "eyJhbGciOiJIUzUxMiJ9.eyJ1c2VybmFtZSI6IkFBQ0c2NjE4MjciLCJyb2xlcyI6MCwidXNlcnR5cGUiOiJVU0VSIiwidG9rZW4iOiJleUpoYkdjaU9pSlNVekkxTmlJc0luUjVjQ0k2SWtwWFZDSjkuZXlKMWMyVnlYM1I1Y0dVaU9pSmpiR2xsYm5RaUxDSjBiMnRsYmw5MGVYQmxJam9pZEhKaFpHVmZZV05qWlhOelgzUnZhMlZ1SWl3aVoyMWZhV1FpT2pNc0luTnZkWEpqWlNJNklqTWlMQ0prWlhacFkyVmZhV1FpT2lJd05UWmhaRGs1WWkxaE1qWTFMVE5tTkdVdFlXSmlOaTA1T0RabFltSTNOalk0Wm1JaUxDSnJhV1FpT2lKMGNtRmtaVjlyWlhsZmRqSWlMQ0p2Ylc1bGJXRnVZV2RsY21sa0lqb3pMQ0p3Y205a2RXTjBjeUk2ZXlKa1pXMWhkQ0k2ZXlKemRHRjBkWE1pT2lKaFkzUnBkbVVpZlN3aWJXWWlPbnNpYzNSaGRIVnpJam9pWVdOMGFYWmxJbjE5TENKcGMzTWlPaUowY21Ga1pWOXNiMmRwYmw5elpYSjJhV05sSWl3aWMzVmlJam9pUVVGRFJ6WTJNVGd5TnlJc0ltVjRjQ0k2TVRjM056TTBPRE0wT1N3aWJtSm1Jam94TnpjM01qWXhOelk1TENKcFlYUWlPakUzTnpjeU5qRTNOamtzSW1wMGFTSTZJakV6TUROaE1tWXdMV0V4WkRZdE5HSmlOaTA1TUdNMUxUTmxNemRtWVRJNU9HVmlPQ0lzSWxSdmEyVnVJam9pSW4wLlN1LXI2dC1aTFBuOEsxalJvcHNsX29NeXpkTDh1cjlndUx6MW1uU3MwU3ktUmhodzZKTXVtM2MxWDc1MFdvUENieS1kdmE2MFR1WU9rYU4wWmM2dmtxdmk4dEQ3bEx2NS16MWM0TGlzUzl3TEJpaVc3YkJpZjlxdzlyQzhSUEVuQjVaaGFNVVJacFotUFlYNVVvSHc3Y2Q3OXVYeFgtWHdSYUpwd2NoV1N1USIsIkFQSS1LRVkiOiJ1Vk5INUR0QyIsIlgtT0xELUFQSS1LRVkiOmZhbHNlLCJpYXQiOjE3NzcyNjE5NDksImV4cCI6MTc3NzMxNDYwMH0.aKTKeLdv6VgT86FYMEVziTCP3wpRaOuG2BSHJ5eR9nyZYvRU97mFiqS8lfwJTOucjezS4ETnrzH5FnxjbppvTw",
  publicIP: process.env.Smart_API_PublicIP ?? "45.114.212.194", // From your earlier whitelisting screenshot
  localIP: process.env.Smart_API_LocalIP ?? "127.0.0.1",
  capital: process.env.Capital ?? 100000,
  risk_per_trade: process.env.Risk_Per_Trade ?? 0.4,
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
    "X-ClientPublicIP": "45.114.212.194",
    "X-MACAddress": "02:00:00:00:00:00",
    "X-PrivateKey": CONFIG.apiKey,
    "Content-Type": "application/json",
  },
});

// ---------------- TECHNICAL HELPERS ----------------
const average = (arr) =>
  arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

/**
 * Yahoo Finance quote format: { date, open, high, low, close, volume }
 * Used for individual stock ATR calculation.
 */
// async function calculateIntradayATR(quotes, period = 20) {
//   if (quotes.length < period + 1) return 0;
//   const recent = quotes.slice(-(period + 1));
//   const trs = [];
//   for (let i = 1; i < recent.length; i++) {
//     const tr = Math.max(
//       recent[i].high - recent[i].low,
//       Math.abs(recent[i].high - recent[i - 1].close),
//       Math.abs(recent[i].low - recent[i - 1].close),
//     );
//     trs.push(tr);
//   }
//   return average(trs);
// }

// ================================================================
//  CANDLE-CLOSE GUARD
//  Your cron fires every 2 minutes, but 15m candles close only at
//  :00, :15, :30, :45 of each hour. Evaluating a live incomplete
//  candle gives false signals — volume and close are not final.
//
//  This function returns true ONLY when the current IST time is
//  within a 90-second window just AFTER a 15m candle has closed:
//    e.g. 10:30:00 → 10:31:30  ✅ evaluate
//         10:28:00             ❌ skip (candle still live)
//
//  Why 90 seconds?
//  - Your cron runs every 2 min, so the worst-case delay after
//    candle close is ~2 min. A 90s window ensures every candle
//    close is caught by at least one cron tick, with no overlap
//    into the next candle.
// ================================================================
function isNearCandleClose() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  // 15m candles close at :00, :15, :30, :45
  // We allow evaluation in the 90 seconds AFTER the close
  const secondsIntoInterval = (minutes % 15) * 60 + seconds;

  // Allow: 0s–90s after candle close (i.e. first 90s of each 15m block)
  return secondsIntoInterval <= 150;
}

// ================================================================
//  NIFTY BEARISH SENTIMENT ENGINE — uses AngelOne API
//  (Nifty index is not reliably available on Yahoo Finance)
// ================================================================
async function getNiftyBearishSentiment() {
  const today = new Date().toISOString().split("T")[0];
  try {
    // Fetch 15-minute intraday candles for Nifty
    const intraDayRes = await angelClient.post(
      "/rest/secure/angelbroking/historical/v1/getCandleData",
      {
        exchange: "NSE",
        symboltoken: "99926000", // Nifty 50 token
        interval: "FIFTEEN_MINUTE",
        fromdate: `${today} 09:15`,
        todate: `${today} 15:30`,
      },
    );

    // Fetch daily candles to get yesterday's close
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
    // AngelOne format: [timestamp, open, high, low, close, volume]
    const [, open, high, low, close, volume] = last;

    // VWAP Calculation
    let tVal = 0,
      tVol = 0;
    quotes.forEach((q) => {
      tVal += q[4] * (q[5] || 1);
      tVol += q[5] || 1;
    });
    const vwap = tVal / tVol;

    // BEARISH GUARD: Below yesterday's close AND (Below VWAP OR Strong Red Body)
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

// ================================================================
//  BEARISH STOCK SIGNAL ENGINE — uses Yahoo Finance API
// ================================================================
async function getBearishExpertSignal(symbol, niftyStatus) {
  try {
    console.log("niftyStatus & Symbol", niftyStatus, symbol);

    if (!niftyStatus.isBearish) {
      return { status: "WAITING", reason: "Nifty Bullish/Strong" };
    }

    const intradayData = await yf.chart(`${symbol}.NS`, {
      period1: Math.floor(Date.now() / 1000) - 48 * 60 * 60, // 2 days back
      interval: "15m",
    });

    const dailyData = await yf.chart(`${symbol}.NS`, {
      period1: Math.floor(Date.now() / 1000) - 5 * 24 * 60 * 60, // 5 days back
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

    // Gap Down Protection: Don't short if it gapped down more than 5%
    const gapPercent =
      ((todayQuotes[0].open - yesterdayClose) / yesterdayClose) * 100;
    if (gapPercent < -5.0)
      return { status: "REJECTED", reason: "High Gap Down" };

    const morningLow = Math.min(todayQuotes[0].low, todayQuotes[1].low);
    const avgMorningVol = (todayQuotes[0].volume + todayQuotes[1].volume) / 2;

    let sVal = 0,
      sVol = 0;
    todayQuotes.forEach((q) => {
      sVal += q.close * q.volume;
      sVol += q.volume;
    });
    const stockVWAP = sVal / sVol;

    const lastCandle = todayQuotes[todayQuotes.length - 1];
    const prevCandle = todayQuotes[todayQuotes.length - 2];
    const secondCandle = todayQuotes[1];

    const isBearishCandle = lastCandle.close < lastCandle.open;

    // ── BEARISH OPENING DRIVE LOGIC ───────────────────────────────────
    // Mirror of bull mode: build historicalOpeningCandles from iQuotes
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
      // Only 9:15 candles from previous days
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
      historicalAvgVol > 0 && // have historical data
      firstCandle.close < firstCandle.open && // candle 1 red
      firstBodyRatio > 0.6 && // strong body, not doji
      firstCandle.volume > historicalAvgVol * 2.0 && // 2x historical volume
      secondCandle.close < secondCandle.open && // candle 2 also red (holding)
      lastCandle.close < lastCandle.open && // lastCandle also red
      lastCandle.close < stockVWAP && // below VWAP
      lastCandle.close < firstCandle.open; // holding below opening price

    // ── REGULAR BEARISH CONDITIONS ────────────────────────────────────
    const morningRange =
      Math.max(todayQuotes[0].high, todayQuotes[1].high) -
      Math.min(todayQuotes[0].low, todayQuotes[1].low);
    const isMeaningfulMorningRange = morningRange > lastCandle.close * 0.003;

    const isBreakdown =
      isBearishCandle &&
      isMeaningfulMorningRange &&
      lastCandle.close < morningLow * 0.999 && // meaningful break, not just a touch
      prevCandle.close >= morningLow && // first candle to break (no chasing)
      lastCandle.close < stockVWAP;

    // ── LOSING VALUE ────────────────────────────────────
    const candleMid = (lastCandle.high + lastCandle.low) / 2;
    const testedVWAP = lastCandle.high >= stockVWAP * 0.9992; // wick reached VWAP zone
    const closeBelowMid = lastCandle.close < candleMid; // closed in lower half

    const isLosingValue =
      isBearishCandle &&
      prevCandle.close > stockVWAP && // was above VWAP before
      lastCandle.close < stockVWAP * 0.9995 && // meaningful close below VWAP
      testedVWAP && // actually tested VWAP (rejection)
      closeBelowMid; // closed in lower half of candle

    const hasVolumeSurge = lastCandle.volume > avgMorningVol * 1.5;

    const sBody = Math.abs(lastCandle.close - lastCandle.open);
    const sRange = lastCandle.high - lastCandle.low;

    const isStrongRed =
      isBearishCandle && (sRange > 0 ? sBody / sRange > 0.5 : false);

    // ── BEARISH SIGNAL LOGIC ──────────────────────────────────────────
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

      // Mirror bull mode: derive signalType, pass it to getTimeAdjustedTargets
      const signalType = isBreakdown
        ? "BREAKDOWN"
        : isOpeningDriveBearishSignal
          ? "OPENING_DRIVE"
          : "VALUE_LOSS";

      const getTimeAdjustedTarget = await getTimeAdjustedTargets(
        lastCandle.close,
        signalType,
      );

      // Too late to trade — getTimeAdjustedTargets returns null
      if (!getTimeAdjustedTarget) {
        return { status: "WAITING", reason: "Too Late To Trade" };
      }

      const showDate = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      });

      return {
        status: "TRIGGERED",
        type: getTimeAdjustedTarget.session,
        symbol: symbol,
        price: lastCandle.close.toFixed(2),
        time: showDate,
        date: todayStr,
        target: getTimeAdjustedTarget.target,
        stopLoss: getTimeAdjustedTarget.stopLoss,
        riskReward: getTimeAdjustedTarget.riskReward,
      };
    }

    return { status: "WAITING", price: lastCandle.close.toFixed(2) };
  } catch (err) {
    return { status: "ERROR", message: err.message };
  }
}

// ================================================================
//  TIME-ADJUSTED TARGETS — BEARISH (SHORT) VERSION
//  Mirror of bull mode's getTimeAdjustedTargets, but inverted:
//    target   = entry - X%   (price falls to here → profit)
//    stopLoss = entry + X%   (price rises to here → cut loss)
//
//  Signal types:
//    OPENING_DRIVE — strong red open, tight RR, quick exit
//    BREAKDOWN     — clean break below morning low + VWAP
//    VALUE_LOSS    — VWAP rejection (counter-trend), tightest RR
// ================================================================
async function getTimeAdjustedTargets(entryPrice, signalType, candleDate) {
    // Reconstruct IST time from the candle's date
    const istString = candleDate.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const istTime   = new Date(istString);
    const hour      = istTime.getHours();
    const minutes   = istTime.getMinutes();

    // Minutes remaining until 15:15 IST
    const minutesLeft = (15 * 60 + 15) - (hour * 60 + minutes);
    const hoursLeft   = minutesLeft / 60;

    // ── TOO LATE TO TRADE ─────────────────────────────────────────────
    if (hoursLeft < 2.0) return null;

    // ── OPENING DRIVE ─────────────────────────────────────────────
    // Logic: Stock dumped early, catching the continuation at 9:45
    if (signalType === "OPENING_DRIVE") {
        if (hoursLeft >= 4.5) {
            // 9:45–10:45 → fresh momentum
            return {
                target:   (entryPrice * (1 - 0.0070)).toFixed(2), // -0.70%
                stopLoss: (entryPrice * (1 + 0.0035)).toFixed(2), // +0.35%
                riskReward: "2.0",
                session:    "EARLY DRIVE"
            };
        } else if (hoursLeft >= 3.0) {
            // 10:45–12:15 → momentum fading, take what you can get
            return {
                target:   (entryPrice * (1 - 0.0060)).toFixed(2), // -0.60%
                stopLoss: (entryPrice * (1 + 0.0030)).toFixed(2), // +0.30%
                riskReward: "2.0",
                session:    "MID DRIVE"
            };
        } else {
            return null;
        }
    }

    // ── BREAKDOWN ──────────────────────────────────────────────────
    // Logic: Clean break below morning low + VWAP
    // Breakdowns in institutional stocks move fast; giving it more room (1.7 - 1.8 RR)
    if (signalType === "BREAKDOWN") {
        if (hoursLeft >= 4.5) {
            return {
                target:   (entryPrice * (1 - 0.0100)).toFixed(2), // -1.00%
                stopLoss: (entryPrice * (1 + 0.0050)).toFixed(2), // +0.50%
                riskReward: "1.7",
                session:    "EARLY BREAKDOWN"
            };
        } else if (hoursLeft >= 3.0) {
            return {
                target:   (entryPrice * (1 - 0.0100)).toFixed(2), // -1.00%
                stopLoss: (entryPrice * (1 + 0.0050)).toFixed(2), // +0.50%
                riskReward: "1.8",
                session:    "MID BREAKDOWN"
            };
        } else {
            return null;
        }
    }

    // ── VALUE LOSS (VWAP REJECTION) ────────────────────────────────
    // Logic: Price tried to go up, hit VWAP, and failed
    if (signalType === "VALUE_LOSS") {
        if (hoursLeft >= 4.5) {
            // Early session VWAP is jittery
            return {
                target:   (entryPrice * (1 - 0.0070)).toFixed(2), // -0.70%
                stopLoss: (entryPrice * (1 + 0.0035)).toFixed(2), // +0.35%
                riskReward: "2.0",
                session:    "EARLY VALUE LOSS"
            };
        } else if (hoursLeft >= 3.0) {
            // Mid-session VWAP rejection is high conviction
            return {
                target:   (entryPrice * (1 - 0.0100)).toFixed(2), // -1.00%
                stopLoss: (entryPrice * (1 + 0.0050)).toFixed(2), // +0.50%
                riskReward: "1.8",
                session:    "MID VALUE LOSS"
            };
        } else {
            // Late session, tight target for rapid exit
            return {
                target:   (entryPrice * (1 - 0.0070)).toFixed(2), // -0.70%
                stopLoss: (entryPrice * (1 + 0.0035)).toFixed(2), // +0.35%
                riskReward: "2.0",
                session: "LATE VALUE LOSS"
            };
        }
    }

    // ── FALLBACK ──────────────────────────────────────────────────
    return {
        target:   (entryPrice * (1 - 0.0070)).toFixed(2),
        stopLoss: (entryPrice * (1 + 0.0035)).toFixed(2),
        riskReward: "2.0",
        session:    "DEFAULT"
    };
}

// ---------------- DATABASE OPERATION ----------------
async function insertStock(signal) {
  const getStocks = await client.send(
    new ScanCommand({ TableName: PlaceStocks ?? "PlacedStocks" }),
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
      TableName: PlaceStocks ?? "PlacedStocks",
      Item: {
        symbolKey: signal.symbol,
        price: signal.price,
        target: signal.target,
        transactiontype: "SELL",
        riskReward: signal.riskReward,
        stopLoss: signal.stopLoss,
        limitPrice: "0",
        type: signal.type,
        status: 0, // 0 = Placed, 1 = Executed, 2 = Closed
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
  const amount = CONFIG.capital * CONFIG.risk_per_trade;
  const qty = Math.floor(amount / signal.price);

  if (qty < 1) {
    console.log(`⚠️ Qty < 1 for ${signal.symbol}. Skipping order.`);
    return;
  }

  const limitPrice = (signal.price * 0.997).toFixed(2); // 0.3% buffer BELOW for short sells

  const payload = {
    variety: "NORMAL",
    tradingsymbol: `${signal.symbol}-EQ`,
    symboltoken: Barish_STOCKS[signal.symbol]?.token,
    transactiontype: "SELL", // SHORT position
    exchange: "NSE",
    ordertype: "LIMIT",
    producttype: "INTRADAY",
    duration: "DAY",
    riskReward: signal.riskReward.toString(),
    price: limitPrice.toString(),
    squareoff: signal.target.toString(),
    stoploss: signal.stopLoss.toString(),
    quantity: qty.toString(),
  };

  console.log(
    `🚀 Placing SHORT order for ${signal.symbol}: qty=${qty} @ ₹${limitPrice}`,
  );

  // Uncomment to actually place:
  // const res = await angelClient.post('/rest/secure/angelbroking/order/v1/placeOrder', payload);
  // if (res.data.status) console.log(`✅ SHORT placed: ${signal.symbol} @ ${limitPrice}`);

  console.log(`✅ SHORT order placed: ${signal.symbol} @ ₹${limitPrice}`);

  // Update status in database to Executed (1)
  const getStockInfo = await client.send(
    new GetCommand({
      TableName: PlaceStocks ?? "PlacedStocks",
      Key: { symbolKey: signal.symbol },
    }),
  );

  if (!getStockInfo.Item) {
    console.log(
      `⚠️ No record found for ${signal.symbol}. Cannot update status.`,
    );
    return;
  }

  const c_date = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );

  await client.send(
    new PutCommand({
      TableName: PlaceStocks ?? "PlacedStocks",
      Item: {
        symbolKey: getStockInfo.Item.symbolKey,
        price: getStockInfo.Item.price,
        target: getStockInfo.Item.target,
        transactiontype: "SELL",
        stopLoss: getStockInfo.Item.stopLoss,
        limitPrice: limitPrice.toString(),
        type: getStockInfo.Item.type,
        riskReward: getStockInfo.Item.riskReward,
        status: 1, // 0 = Placed, 1 = Executed, 2 = Closed
        createdAt: getStockInfo.Item.createdAt,
        updatedAt: c_date.toString(),
      },
    }),
  );
}

// ================================================================
//  MAIN CRON — Entry Point
// ================================================================
export const Bcron = async () => {
  const time = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  console.log(`\n🔍 Bearish Scan Started: ${time}`);

  // ── Candle-Close Guard ─────────────────────────────────────────
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

  // ── Step 1: Nifty Bearish Sentiment via AngelOne (index data) ──
  const nifty = await getNiftyBearishSentiment();
  // const nifty = { isBearish: true, price: "22000", status: "🔴 WEAK" }; // ← mock for testing

  console.log(`NIFTY: ${nifty.status || "N/A"} @ ₹${nifty.price || "?"}`);

  if (nifty.status === "ERR") {
    console.error("❌ Aborted: Could not fetch Nifty data.");
    return;
  }

  console.log("━".repeat(55));

  // ── Step 2: Scan stocks via Yahoo Finance ──────────────────────
  for (const [symbolKey, stockData] of Object.entries(Barish_STOCKS)) {
    try {
      const signal = await getBearishExpertSignal(symbolKey, nifty);

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

    // Yahoo Finance rate limit: be gentle (~2 req/sec)
    // await new Promise((r) => setTimeout(r, 500));
  }

  console.log("━".repeat(55));
  console.log(
    `🔍 Bearish Scan Complete: ${new Date().toLocaleTimeString("en-IN")}\n`,
  );
};

// await Bcron();
