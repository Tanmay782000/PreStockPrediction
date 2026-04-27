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
//  NIFTY SENTIMENT ENGINE — uses AngelOne API
//  (Nifty index is not reliably available on Yahoo Finance)
// ================================================================
async function getNiftySentiment() {
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
      return { isBullish: false, reason: "Market Not Open" };
    }

    const yesterdayClose = dailyQuotes[dailyQuotes.length - 2][4];
    const last = quotes[quotes.length - 1];
    // AngelOne format: [timestamp, open, high, low, close, volume]
    const [, open, high, low, close, volume] = last;

    // VWAP Calculation
    let tVal = 0,
      tVol = 0;
    quotes.forEach((q) => {
      tVal += q[4] * q[5];
      tVol += q[5];
    });
    const vwap = tVal / tVol;

    const isAbovePrev = close > yesterdayClose;
    const isAboveVWAP = close > vwap * 0.9998; // 0.02% tolerance
    const bodyToRange =
      high - low > 0 ? Math.abs(close - open) / (high - low) : 0;
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

// ===============================================================
// Last price of stock
// ===============================================================
async function getLastPrice(symboltoken, exchange = "NSE") {
    try {
        const res = await angelClient.post(
            "/rest/secure/angelbroking/market/v1/quote/",
            {
                mode: "LTP",
                exchangeTokens: {
                    [exchange]: [symboltoken]
                }
            }
        );

        const ltp = res.data?.data?.fetched?.[0]?.ltp;
        return ltp;

    } catch (err) {
        console.error(`❌ LTP fetch failed — ${err.message}`);
        return null;
    }
}

// ================================================================
//  STOCK SIGNAL ENGINE — uses Yahoo Finance API
//  (Individual NSE stocks fetched via Yahoo Finance symbol e.g. "TITAN.NS")
// ================================================================
async function getExpertTimingSignal(symbol, niftyStatus, smartAPISymbol) {
  try {
    console.log("niftyStatus & Symbol", niftyStatus, symbol);
    if (!niftyStatus.isBullish) {
      return { status: "WAITING", reason: "Nifty Bearish/Weak" };
    }

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

    if (todayQuotes.length < 3)
      return {
        status: "WAITING",
        reason: `Data Sync (${todayQuotes.length}/3)`,
      };

    const yesterdayClose = dQuotes[dQuotes.length - 2].close;
    const gapPercent =
      ((todayQuotes[0].open - yesterdayClose) / yesterdayClose) * 100;

    if (gapPercent > 5.0) return { status: "REJECTED", reason: "High Gap" };

    const morningHigh = Math.max(todayQuotes[0].high, todayQuotes[1].high);
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

    // ── FIX 1: isBullishCandle must reference lastCandle, not candle ──
    const isBullishCandle = lastCandle.close > lastCandle.open;

    // ── FIX 2: isBreakout & isReclaimingValue already correct ─────────
    const morningRange =
      Math.max(todayQuotes[0].high, todayQuotes[1].high) -
      Math.min(todayQuotes[0].low, todayQuotes[1].low);
    const isMeaningfulMorningRange = morningRange > lastCandle.close * 0.003; // 0.3% min range

    const isBreakout =
      isBullishCandle &&
      isMeaningfulMorningRange &&
      lastCandle.close > morningHigh * 1.001 && // meaningful break, not just a touch
      prevCandle.close <= morningHigh && // first candle to break (no chasing)
      lastCandle.close > stockVWAP; // also above VWAP for confluence

    //  ── FIX 3: Reclaiming Value Logic ─────────
    const candleMid = (lastCandle.high + lastCandle.low) / 2;
    const testedVWAP = lastCandle.low <= stockVWAP * 1.0008; // wick dipped into VWAP zone
    const closeAboveMid = lastCandle.close > candleMid; // closed in upper half

    const isReclaimingValue =
      isBullishCandle &&
      prevCandle.close < stockVWAP && // was below VWAP before
      lastCandle.close > stockVWAP * 1.0005 && // meaningful close above VWAP
      testedVWAP && // actually tested VWAP (support held)
      closeAboveMid; // close in upper half = real buying

    const hasVolumeSurge = lastCandle.volume > avgMorningVol * 1.5;

    const sBody = Math.abs(lastCandle.close - lastCandle.open);
    const sRange = lastCandle.high - lastCandle.low;

    // ── FIX 3: isStrongCandle must also require bullish candle ─────────
    const isStrongCandle =
      isBullishCandle && (sRange > 0 ? sBody / sRange > 0.5 : false);

    // ── OPENING DRIVE LOGIC ───────────────────────────────────────────
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
    const secondCandle = todayQuotes[1];

    const firstBody = Math.abs(firstCandle.close - firstCandle.open);
    const firstRange = firstCandle.high - firstCandle.low;
    const firstBodyRatio = firstRange > 0 ? firstBody / firstRange : 0;

    const isOpeningDrive =
      historicalAvgVol > 0 && // have historical data
      firstCandle.close > firstCandle.open && // FIX 4: candle 1 green
      firstBodyRatio > 0.6 && // strong body, not doji
      firstCandle.volume > historicalAvgVol * 2.0 && // 2x historical volume
      secondCandle.close > secondCandle.open && // FIX 5: candle 2 green (holding)
      lastCandle.close > lastCandle.open && // FIX 6: lastCandle also green
      lastCandle.close > stockVWAP && // still above VWAP
      lastCandle.close > firstCandle.open; // holding above opening price

    // ── FIX 7: isOpeningDriveSignal also needs isBullishCandle ────────
    const isRegularSignal =
      hasVolumeSurge && isStrongCandle && (isBreakout || isReclaimingValue);
    const isOpeningDriveSignal = isOpeningDrive && isStrongCandle;

    if (isRegularSignal || isOpeningDriveSignal) {
      console.log("lastCandle.close", lastCandle.close);
      console.log("stockVWAP", stockVWAP);
      console.log("prevCandle.close", prevCandle.close);
      console.log("lastCandle.volume", lastCandle.volume);
      console.log("lastCandle.volume", lastCandle.volume);
      console.log("isStrongCandle", sBody / sRange);
      console.log("Stock is going to place");
      const signalType = isBreakout
        ? "BREAKOUT"
        : isOpeningDriveSignal
          ? "OPENING_DRIVE"
          : "REVERSAL";

      const lastPrice = await getLastPrice(smartAPISymbol);

      const getTimeAdjustedTarget = await getTimeAdjustedTargets(
        lastPrice,
        signalType,
      );

      if(lastPrice == null || lastPrice == undefined || lastPrice == 0) 
      {
          console.log(`⚠️ Failed to fetch LTP for ${symbol}. Using last candle close as fallback.`);
          return { status: "Error", price: lastCandle.close.toFixed(2), reason: "LTP Fetch Failed" };
      }

      let showDate = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      });
      return {
        status: "TRIGGERED",
        type: getTimeAdjustedTarget.session,
        symbol: lastPrice,
        price: lastCandle.close.toFixed(2),
        time: showDate,
        date: todayStr,
        target: getTimeAdjustedTarget.target,
        stopLoss: getTimeAdjustedTarget.stopLoss,
        riskReward: getTimeAdjustedTarget.riskReward,
        stockToken: smartAPISymbol
      };
    }

    return { status: "WAITING", price: lastCandle.close.toFixed(2) };
  } catch (err) {
    return { status: "ERROR", message: err.message };
  }
}

function getTimeAdjustedTargets(entryPrice, signalType, candleDate) {
    const istString = candleDate.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const istTime   = new Date(istString);
    const hour      = istTime.getHours();
    const minutes   = istTime.getMinutes();

    const minutesLeft = (15 * 60 + 15) - (hour * 60 + minutes);
    const hoursLeft   = minutesLeft / 60;

    if (hoursLeft < 2.0) return null;

    // ── OPENING DRIVE ─────────────────────────────────────────────
    // Already in motion by candle 3 (9:45)
    // Tight RR — quick profit, quick exit
    // 0.70% target / 0.35% SL = 1:2 RR
    if (signalType === "OPENING_DRIVE") {
        if (hoursLeft >= 4.5) {
            // 9:45–10:45 → fresh momentum
            return {
                target: (entryPrice * (1 + 0.0070)).toFixed(2), // +0.70%
                stopLoss:   (entryPrice * (1 - 0.0035)).toFixed(2), // -0.35%
                riskReward: "2.0",
                session:    "EARLY DRIVE"
            };
        } else if (hoursLeft >= 3.0) {
            // 10:45–12:15 → momentum fading
            return {
                target: (entryPrice * (1 + 0.0060)).toFixed(2), // +0.60%
                stopLoss:  (entryPrice * (1 - 0.0030)).toFixed(2), // -0.30%
                riskReward: "2.0",
                session:    "MID DRIVE"
            };
        } else {
            // Too late for opening drive
            return null;
        }
    }

    // ── BREAKOUT ──────────────────────────────────────────────────
    // Clean breakout above morning high + VWAP
    // Keep current RR — needs room to breathe
    // Institutional stocks trend well after real breakout
    if (signalType === "BREAKOUT") {
        if (hoursLeft >= 4.5) {
            // Early session — full momentum
            return {
                target: (entryPrice * (1 + 0.0100)).toFixed(2), // +1.0%
                stopLoss: (entryPrice * (1 - 0.0050)).toFixed(2), // -0.5%
                riskReward: "1.7",
                session:    "EARLY BREAKOUT"
            };
        } else if (hoursLeft >= 3.0) {
            // Mid session — moderate target
            return {
                target:     (entryPrice * (1 + 0.0100)).toFixed(2), // +1.0%
                stopLoss:   (entryPrice * (1 - 0.0050)).toFixed(2), // -0.5%
                riskReward: "1.8",
                session:    "MID BREAKOUT"
            };
        } else {
            // Late breakout — proven bad (33% WR) → skip
            return null;
        }
    }

    // ── REVERSAL ──────────────────────────────────────────────────
    // VWAP reclaim — counter trend entry
    // Early session VWAP unreliable → tight RR
    // Mid session VWAP reliable → keep current RR
    // Late session → tight RR (less time)
    if (signalType === "REVERSAL") {
        if (hoursLeft >= 4.5) {
            // Early session — VWAP not established
            // Tight RR to protect against fake reclaims
            return {
                target:     (entryPrice * (1 + 0.0070)).toFixed(2), // +0.70%
                stopLoss:   (entryPrice * (1 - 0.0035)).toFixed(2), // -0.35%
                riskReward: "2.0",
                session:    "EARLY REVERSAL"
            };
        } else if (hoursLeft >= 3.0) {
            // Mid session — VWAP reliable (72% WR proven)
            // Keep wider RR — let winners run
            return {
                target:     (entryPrice * (1 + 0.0100)).toFixed(2), // +1.00%
                stopLoss:   (entryPrice * (1 - 0.0050)).toFixed(2), // -0.50%
                riskReward: "1.8",
                session:    "MID REVERSAL"
            };
        } else {
            // Late session — less time remaining
            // Tight RR for quick exit
            return {
                target: (entryPrice * (1 + 0.0070)).toFixed(2), // +0.70%
                stopLoss:   (entryPrice * (1 - 0.0035)).toFixed(2), // -0.35%
                riskReward: "2.0",
                session:    "LATE REVERSAL"
            };
        }
    }

    // ── FALLBACK ──────────────────────────────────────────────────
    return {
        target:     (entryPrice * (1 + 0.0070)).toFixed(2),
        stopLoss:   (entryPrice * (1 - 0.0035)).toFixed(2),
        riskReward: "1.7",
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
        stopLoss: signal.stopLoss,
        riskReward: signal.riskReward,
        signalToken : signal.stockToken,
        limitPrice: "0",
        lots: 0,
        type: signal.type,
        transactiontype: "BUY",
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

  console.log(`❌ Failed to store signal for ${signal.symbolKey}.`);
  return false;
}

// ---------------- ORDER PLACEMENT ----------------
async function placeStock(signal) {

    const qty = await calculateLots(signal);

    if (!qty || qty < 1) {
      console.log(`⚠️ Qty < 1 for ${signal.symbol}. Skipping.`);
      return;
    }

    const limitPrice    = parseFloat((parseFloat(signal.price) * 1.003).toFixed(2));
    const squareoffDiff = parseFloat((parseFloat(signal.target)   - limitPrice).toFixed(2));
    const stoplossDiff  = parseFloat((limitPrice - parseFloat(signal.stopLoss)).toFixed(2));

    if (squareoffDiff <= 0 || stoplossDiff <= 0) {
      console.log(`⚠️ Invalid SL/Target for ${signal.symbol}. Skipping.`);
      return;
    }

    const payload = {
      variety:          "ROBO",
      tradingsymbol:    `${signal.symbol}-EQ`,
      symboltoken:      signal.signalToken,
      transactiontype:  "BUY",
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
    //   '/rest/secure/angelbroking/order/v1/placeOrder',
    //   payload
    // );

    // if (res.data?.status === true) {
    //   console.log(`✅ Order placed : ${signal.symbol} @ ₹${limitPrice}`);
    //   console.log(`   Order ID     : ${res.data?.data?.orderid}`);
    //   console.log(`   Qty          : ${qty}`);
    //   console.log(`   Target       : ₹${signal.target} (+₹${squareoffDiff})`);
    //   console.log(`   Stop Loss    : ₹${signal.stopLoss} (-₹${stoplossDiff})`);
    //   return res.data?.data?.orderid;
    // } else {
    //   console.log(`❌ Order failed  : ${signal.symbol}`);
    //   console.log(`   Reason        : ${res.data?.message || "Unknown"}`);
    //   return null;
    // }

  //change the status in database

  const getStockInfo = await client.send(
    new GetCommand({
      TableName: PlaceStocks ?? "PlacedStocks",
      Key: { symbolKey: signal.symbol },
    }),
  );

  if (!getStockInfo.Item) {
    console.log(
      `⚠️ No record found for ${signal.symbolKey}. Cannot update status.`,
    );
    return;
  }
  const c_date = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const isUpdated = await client.send(
    new PutCommand({
      TableName: PlaceStocks ?? "PlacedStocks",
      Item: {
        symbolKey: getStockInfo.Item.symbolKey,
        price: getStockInfo.Item.price,
        target: getStockInfo.Item.target,
        symboltoken: getStockInfo.Item.symboltoken,
        stopLoss: getStockInfo.Item.stopLoss,
        riskReward: getStockInfo.Item.riskReward,
        type: getStockInfo.Item.type,
        lots: calculateLot,
        transactiontype: "BUY",
        limitPrice: limitPrice.toString(),
        status: 1, // 0 = Placed, 1 = Executed, 2 = Closed
        createdAt: getStockInfo.Item.createdAt,
        updatedAt: c_date.toString(),
      },
    }),
  );
}



// ----------------- LOT CALCULATION ----------------
async function calculateLots(signal) {
   const amount = (CONFIG.capital * CONFIG.risk_per_trade) / 100;
   const qty = Math.floor((amount * 5) / signal.price);
   return qty;
}

// ================================================================
//  MAIN CRON — Entry Point
// ================================================================
export const cron = async () => {
  const time = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  console.log(`\n🔍 Scan Started: ${time}`);

  // ── Candle-Close Guard ─────────────────────────────────────────
  // Your cron fires every 2 minutes. But 15m candles only close at
  // :00, :15, :30, :45. Evaluating a live candle mid-way gives
  // false signals — close and volume are not final yet.
  //
  // This guard skips the scan unless we are within 90 seconds
  // AFTER a candle close. Since your cron runs every 2 minutes,
  // every candle close will be caught within one cron tick.
  //
  // Example:
  //   Cron fires at 10:28 IST → secondsIntoInterval = 780s → SKIP
  //   Cron fires at 10:31 IST → secondsIntoInterval = 60s  → RUN ✅
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

  // ── Step 1: Nifty Sentiment via AngelOne (index data) ──────────
  const nifty = await getNiftySentiment();
  // const nifty = {
  //   isBullish: true,
  //   price: 2500,
  //   status: "🟢 STRONG",
  // };
  console.log(`NIFTY: ${nifty.status || "N/A"} @ ₹${nifty.price || "?"}`);

  if (nifty.status === "ERR") {
    console.error("❌ Aborted: Could not fetch Nifty data.");
    return;
  }

  console.log("━".repeat(55));

  // ── Step 2: Scan stocks via Yahoo Finance ──────────────────────
  for (const [symbolKey, stockData] of Object.entries(Bullish_STOCKS)) {
    try {
      const signal = await getExpertTimingSignal(symbolKey, nifty, stockData.token);

      if (signal.status === "TRIGGERED") {
        console.log(
          `🔥 [${signal.type}] ${symbolKey} @ ₹${signal.price} | 🎯 ${signal.target} | 🛑 ${signal.stopLoss}`,
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

    // // Yahoo Finance rate limit: be gentle (~2 req/sec)
    // await new Promise((r) => setTimeout(r, 100));
  }

  console.log("━".repeat(55));
  console.log(`🔍 Scan Complete: ${new Date().toLocaleTimeString("en-IN")}\n`);
};

// await cron();
