import axios from "axios";
import yahooFinance from "yahoo-finance2";
import { PutCommand, ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { client } from "../db/dynamo.client.js";
import { OIL_AND_GAS_ENERGY } from "../Common/stockInfo.js";

const yf = new yahooFinance();

const PlaceStocks = process.env.PlacedStocksTable;
const Bullish_STOCKS = OIL_AND_GAS_ENERGY;

// ---------------- CONFIGURATION ----------------
const CONFIG = {
  apiKey: process.env.Smart_API_KEY ?? "uVNH5DtC",
  jwtToken: process.env.Smart_API_JWT_TOKEN ?? "eyJhbGciOiJIUzUxMiJ9.eyJ1c2VybmFtZSI6IkFBQ0c2NjE4MjciLCJyb2xlcyI6MCwidXNlcnR5cGUiOiJVU0VSIiwidG9rZW4iOiJleUpoYkdjaU9pSlNVekkxTmlJc0luUjVjQ0k2SWtwWFZDSjkuZXlKMWMyVnlYM1I1Y0dVaU9pSmpiR2xsYm5RaUxDSjBiMnRsYmw5MGVYQmxJam9pZEhKaFpHVmZZV05qWlhOelgzUnZhMlZ1SWl3aVoyMWZhV1FpT2pNc0luTnZkWEpqWlNJNklqTWlMQ0prWlhacFkyVmZhV1FpT2lJd05UWmhaRGs1WWkxaE1qWTFMVE5tTkdVdFlXSmlOaTA1T0RabFltSTNOalk0Wm1JaUxDSnJhV1FpT2lKMGNtRmtaVjlyWlhsZmRqSWlMQ0p2Ylc1bGJXRnVZV2RsY21sa0lqb3pMQ0p3Y205a2RXTjBjeUk2ZXlKa1pXMWhkQ0k2ZXlKemRHRjBkWE1pT2lKaFkzUnBkbVVpZlN3aWJXWWlPbnNpYzNSaGRIVnpJam9pWVdOMGFYWmxJbjE5TENKcGMzTWlPaUowY21Ga1pWOXNiMmRwYmw5elpYSjJhV05sSWl3aWMzVmlJam9pUVVGRFJ6WTJNVGd5TnlJc0ltVjRjQ0k2TVRjM05qTXlNREk1TWl3aWJtSm1Jam94TnpjMk1qTXpOekV5TENKcFlYUWlPakUzTnpZeU16TTNNVElzSW1wMGFTSTZJbUkxWXpFM09EVmtMV1ppTTJVdE5EUXpaaTA1WVRJMExUUmpOMlJoWkRsbFl6bG1aQ0lzSWxSdmEyVnVJam9pSW4wLkZBaUhGNjhhWW5YRllxQ2NwTVVyNjNETTVSMmV6emFsZEtaZ2JJOTd3cXZKYVFaTUdldUZ0S3p6Ti0xV19jVGRWd2xpOGxnTDhPY09FNnlzeEpLb0x0b0NOYjFxWmR3N1VfZFhUZ25aQTllOWZNRktWUlA5b3g2LTl3MzQzcGc5LUFjNk9DcjV0R1JGTXd4a2hrWnlaRkVhMnZWdTVtR0RVcktCNkhmU1JSQSIsIkFQSS1LRVkiOiJ1Vk5INUR0QyIsIlgtT0xELUFQSS1LRVkiOmZhbHNlLCJpYXQiOjE3NzYyMzM4OTIsImV4cCI6MTc3NjI3NzgwMH0.r1gMSMsr3tVJFLmw5-M8lF0BC66xMQerdv-U3D4tKgZrTNkBrhcySQmR1luroeL3iCgzQ8KmYXWnTZn7h0BWZA",
  publicIP: process.env.Smart_API_PublicIP ?? "45.114.212.194", // From your earlier whitelisting screenshot
  localIP:  process.env.Smart_API_LocalIP ?? "127.0.0.1",
  capital:  process.env.Capital ?? 10000,
  risk_per_trade:  process.env.Risk_Per_Trade ?? 0.2,
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
async function calculateIntradayATR(quotes, period = 20) {
  if (quotes.length < period + 1) return 0;
  const recent = quotes.slice(-(period + 1));
  const trs = [];
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

// ================================================================
//  STOCK SIGNAL ENGINE — uses Yahoo Finance API
//  (Individual NSE stocks fetched via Yahoo Finance symbol e.g. "TITAN.NS")
// ================================================================
async function getExpertTimingSignal(symbol, niftyStatus) {
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

    const isBreakout =
      lastCandle.close > morningHigh && lastCandle.close > stockVWAP;
    const isReclaimingValue =
      lastCandle.close > stockVWAP && prevCandle.close < stockVWAP;
    const hasVolumeSurge = lastCandle.volume > avgMorningVol * 1.1;
    const sBody = Math.abs(lastCandle.close - lastCandle.open);
    const sRange = lastCandle.high - lastCandle.low;
    const isStrongCandle = sRange > 0 ? sBody / sRange > 0.5 : false;

    if (hasVolumeSurge && isStrongCandle && (isBreakout || isReclaimingValue)) {
      const atrValue = await calculateIntradayATR(iQuotes, 20);
      const getTimeAdjustedTarget = getTimeAdjustedTargets(lastCandle.close, atrValue);
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


async function getTimeAdjustedTargets(entryPrice, atrValue) {
const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const istTime = new Date(now);
  const hour = istTime.getHours();
  const minutes = istTime.getMinutes();
  
  // Minutes remaining until 15:15
  const minutesLeft = (15 * 60 + 15) - (hour * 60 + minutes);
  const hoursLeft = minutesLeft / 60;

  let targetMultiplier;
  let slMultiplier;

  if (hoursLeft >= 4.5) {
    // Early session - full ATR targets
    targetMultiplier = 5.0;
    slMultiplier = 2.5;
  } else if (hoursLeft >= 3.0) {
    // Mid session - moderate targets
    targetMultiplier = 3.5;
    slMultiplier = 2.0;
  } else if (hoursLeft >= 2.0) {
    // Late session - conservative
    targetMultiplier = 2.5;
    slMultiplier = 1.5;
  } else {
    // Too late - reject trade entirely
    return null; // Signal to skip this trade
  }

  return {
    target: (entryPrice + atrValue * targetMultiplier).toFixed(2),
    stopLoss: (entryPrice - atrValue * slMultiplier).toFixed(2),
    riskReward: (targetMultiplier / slMultiplier).toFixed(1)
  };

}


// ---------------- DATABASE OPERATION ----------------
async function insertStock(signal) {
  const getStocks = await client.send(
    new ScanCommand({ TableName: PlaceStocks ?? "PlacedStocks" }),
  );

  if (getStocks.Items.length >= 4) {
    console.log("⚠️ Already have 4 stocks in the system. Skipping insertion.");
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
        limitPrice: "0",
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
  const amount = CONFIG.capital * CONFIG.risk_per_trade;
  const qty = Math.floor(amount / signal.price);
  if (qty < 1) {
    console.log(`⚠️ Qty < 1 for ${signal.symbolKey}. Skipping order.`);
    return;
  }
  
  const limitPrice = (signal.price * 1.003).toFixed(2); // 0.3% buffer

  const payload = {
    variety: "NORMAL",
    tradingsymbol: `${signal.symbol}-EQ`,
    symboltoken: Bullish_STOCKS[signal.symbol]?.token,
    transactiontype: "BUY",
    exchange: "NSE",
    ordertype: "LIMIT",
    producttype: "INTRADAY",
    duration: "DAY",
    price: limitPrice.toString(),
    squareoff:signal.target.toString(),
    stoploss:signal.stopLoss.toString(),
    riskReward: signal.riskReward.toString(),
    quantity: qty.toString(),
  };

  console.log(
    `🚀 Placing order for ${signal.symbol}: qty=${qty} @ ₹${limitPrice}`,
  );

  // Uncomment to actually place:
  // const res = await angelClient.post('/rest/secure/angelbroking/order/v1/placeOrder', payload);
  // if (res.data.status) console.log(`✅ Order placed: ${signal.symbolKey} @ ${limitPrice}`);

  console.log(`✅ Order placed: ${signal.symbol} @ ${limitPrice}`);

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
        stopLoss: getStockInfo.Item.stopLoss,
        riskReward: getStockInfo.Item.riskReward,
        type: getStockInfo.Item.type,
        transactiontype: "BUY",
        limitPrice : limitPrice.toString(),
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
export const cron = async () => {
  const time = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  console.log(`\n🔍 Scan Started: ${time}`);
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
      const signal = await getExpertTimingSignal(symbolKey, nifty);

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

    // Yahoo Finance rate limit: be gentle (~2 req/sec)
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log("━".repeat(55));
  console.log(`🔍 Scan Complete: ${new Date().toLocaleTimeString("en-IN")}\n`);
};

await cron();



