import { SmartAPI } from "smartapi-javascript";
import { TOTP } from "otpauth";
import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { client } from "../db/dynamo.client.js";
import { get } from "./stocksDeepAnalysis.js";

//----------------- IMPORTS & GLOBALS ----------------

const PlaceStocks = process.env.PlacedStocksTable;

// ---------------- CONFIGURATION ----------------
const CONFIG = {
  api_key: "YOUR_API_KEY",
  client_code: "YOUR_CLIENT_CODE",
  password: "YOUR_PASSWORD",
  totp_secret: "YOUR_TOTP_SECRET", // The 2FA secret key from AngelOne
};

// Map your symbols to numeric Tokens (Essential for AngelOne)
const SYMBOL_MAP = {
  NIFTY: { token: "99926000", symbol: "Nifty 50", exchange: "NSE" }, // Nifty Index
  RAMCOCEM: { token: "11532", symbol: "RAMCOCEM-EQ", exchange: "NSE" },
  APLAPOLLO: { token: "13517", symbol: "APLAPOLLO-EQ", exchange: "NSE" },
  TITAN: { token: "3506", symbol: "TITAN-EQ", exchange: "NSE" },
  MANAPPURAM: { token: "13328", symbol: "MANAPPURAM-EQ", exchange: "NSE" },
};

const smart_api = new SmartAPI({ api_key: CONFIG.api_key });

// ---------------- TECHNICAL HELPERS ----------------
const average = (arr) =>
  arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

// AngelOne Candle Data Format: [timestamp, open, high, low, close, volume]
// Indices: 0:time, 1:O, 2:H, 3:L, 4:C, 5:V
async function calculateATRFromAngel(candles, period = 20) {
  if (candles.length < period + 1) return 0;
  let trs = [];
  const recent = candles.slice(-(period + 1));
  for (let i = 1; i < recent.length; i++) {
    const tr = Math.max(
      recent[i][2] - recent[i][3], // H - L
      Math.abs(recent[i][2] - recent[i - 1][4]), // H - Prev C
      Math.abs(recent[i][3] - recent[i - 1][4]), // L - Prev C
    );
    trs.push(tr);
  }
  return average(trs);
}

// ---------------- SESSION MANAGER ----------------
async function initializeSession() {
  try {
    const totp = new TOTP({ secret: CONFIG.totp_secret }).generate();
    const session = await smart_api.generateSession(
      CONFIG.client_code,
      CONFIG.password,
      totp,
    );
    if (!session.status) throw new Error(session.message);
    console.log("✅ Angel One Session Authenticated");
  } catch (err) {
    console.error("❌ Login Failed:", err.message);
    process.exit(1);
  }
}

// ---------------- NIFTY SENTIMENT ENGINE (AGGRESSIVE) ----------------
async function getNiftySentiment() {
  try {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // Fetch 15m Intraday
    const candleRes = await smart_api.getCandleData({
      exchange: "NSE",
      symboltoken: SYMBOL_MAP.NIFTY.token,
      interval: "FIFTEEN_MINUTE",
      fromdate: `${today} 09:15`,
      todate: `${today} 15:30`,
    });

    // Fetch Daily (for yesterday's close)
    const dailyRes = await smart_api.getCandleData({
      exchange: "NSE",
      symboltoken: SYMBOL_MAP.NIFTY.token,
      interval: "ONE_DAY",
      fromdate: "2026-04-01 09:15", // Pull enough for history
      todate: `${today} 15:30`,
    });

    const iQuotes = candleRes.data;
    const dQuotes = dailyRes.data;

    if (!iQuotes || iQuotes.length === 0)
      return { isBullish: false, reason: "Market Not Open" };

    const yesterdayClose = dQuotes[dQuotes.length - 2][4];
    const lastCandle = iQuotes[iQuotes.length - 1];
    const [time, open, high, low, close, volume] = lastCandle;

    let tVal = 0,
      tVol = 0;
    iQuotes.forEach((q) => {
      tVal += q[4] * (q[5] || 1);
      tVol += q[5] || 1;
    });

    const currentVWAP = tVal / tVol;
    const body = Math.abs(close - open);
    const range = high - low;

    const isAboveYesterday = close > yesterdayClose;
    const isStrongBody = range > 0 ? body / range > 0.3 : false;
    const isAboveVWAP = close > currentVWAP * 0.9998;

    const isBullish = isAboveYesterday && (isAboveVWAP || isStrongBody);

    return {
      isBullish,
      price: close.toFixed(2),
      status: isBullish ? "🟢 STRONG" : "🔴 WEAK",
    };
  } catch (err) {
    return { isBullish: false, status: "ERR" };
  }
}

// ---------------- CORE SIGNAL ENGINE (AGGRESSIVE) ----------------
async function getExpertTimingSignal(symbolKey, niftyStatus) {
  try {
    if (!niftyStatus.isBullish)
      return { status: "WAITING", reason: "Nifty Weak" };

    const tokenInfo = SYMBOL_MAP[symbolKey];
    const today = new Date().toISOString().split("T")[0];

    const candleRes = await smart_api.getCandleData({
      exchange: "NSE",
      symboltoken: tokenInfo.token,
      interval: "FIFTEEN_MINUTE",
      fromdate: `${today} 09:15`,
      todate: `${today} 15:30`,
    });

    const dailyRes = await smart_api.getCandleData({
      exchange: "NSE",
      symboltoken: tokenInfo.token,
      interval: "ONE_DAY",
      fromdate: "2026-04-01 09:15",
      todate: `${today} 15:30`,
    });

    const todayQuotes = candleRes.data;
    const dQuotes = dailyRes.data;

    if (!todayQuotes || todayQuotes.length < 3)
      return { status: "WAITING", reason: "Syncing" };

    const yesterdayClose = dQuotes[dQuotes.length - 2][4];
    const gapPercent =
      ((todayQuotes[0][1] - yesterdayClose) / yesterdayClose) * 100;

    if (gapPercent > 3.0) return { status: "REJECTED", reason: "High Gap" };

    const morningHigh = Math.max(todayQuotes[0][2], todayQuotes[1][2]);
    const avgMorningVol = (todayQuotes[0][5] + todayQuotes[1][5]) / 2;

    let sVal = 0,
      sVol = 0;
    todayQuotes.forEach((q) => {
      sVal += q[4] * q[5];
      sVol += q[5];
    });

    const stockVWAP = sVal / sVol;
    const lastCandle = todayQuotes[todayQuotes.length - 1];
    const prevCandle = todayQuotes[todayQuotes.length - 2];
    const [time, L_open, L_high, L_low, L_close, L_vol] = lastCandle;

    const isAboveVWAP = L_close > stockVWAP * 0.9998;
    const isBreakout = L_close > morningHigh && isAboveVWAP;
    const isReclaimingValue = isAboveVWAP && prevCandle[4] < stockVWAP;

    const hasVolumeSurge = L_vol > avgMorningVol * 1.1;
    const sBody = Math.abs(L_close - L_open);
    const sRange = L_high - L_low;
    const isStrongCandle = sRange > 0 ? sBody / sRange > 0.3 : false;

    if (hasVolumeSurge && isStrongCandle && (isBreakout || isReclaimingValue)) {
      const atrValue = await calculateATRFromAngel(todayQuotes, 20);
      return {
        status: "TRIGGERED",
        symbolKey: symbolKey,
        type: isBreakout ? "BREAKOUT" : "REVERSAL",
        price: L_close.toFixed(2),
        target: (L_close + atrValue * 5).toFixed(2),
        stopLoss: (L_close - atrValue * 2.5).toFixed(2),
      };
    }

    return { status: "WAITING", price: L_close.toFixed(2) };
  } catch (err) {
    return { status: "ERROR", message: err.message };
  }
}

// ---------------- DATABASE OPERATION OF ORDER PLACEMENT ----------------
async function insertStock(res) {
  var getStocks = await client.send(
    new ScanCommand({
      TableName: PlaceStocks,
    }),
  );

  if (getStocks.Items.length < 3) {
    if (!getStocks.Items.any((s) => s.symbolKey === res.symbolKey)) {
      //insert into the database
      let isInserted = await client.send(
        new PutCommand({
          TableName: PlaceStocks,
        }),
      );
      if (isInserted) {
        console.log(`✅ Signal for ${signal.symbolKey} stored in DB.`);
        await placeStock(res);
        return true;
      } else {
        console.log(`❌ Failed to store signal for ${signal.symbolKey}.`);
      }
      return false;
    }
  } else {
    console.log("⚠️ Already have 2 stocks in the system. Skipping insertion.");
    return false; // Already have 2 stocks, skip insertion
  }
}

// ---------------- OPERATION OF STOCK PLACEMENT ----------------
async function placeStock(res){

  let calculatedData = await calculatetotalPercentage()


  // Logic to place stock order using AngelOne API
  // This would typically involve calling the order placement endpoint of AngelOne with the required parameters
  // such as symbol, quantity, price, order type, etc.
}

// ---------------- CALCULATE TOTAL PERCENTAGE ----------------
async function calculatetotalPercentage(stockInfo){

let capital = 10000;
let amount = capital * 0.4; // 30% of capital per trade

let currentPriceStock = 1200;
let quantity = Math.floor(amount / currentPriceStock);

let targetPrice = stockInfo.target; // Assuming this comes from the signal
let stopLossPrice = stockInfo.stopLoss; // Assuming this comes from the signal
}

// ---------------- MAIN EXECUTION ----------------
export const cron = async () => {
  await initializeSession();

  const time = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  console.log(`🔍 Execution Start: ${time}`);

  const nifty = await getNiftySentiment();
  console.log(`NIFTY Status: ${nifty.status} (${nifty.price})`);

  for (const key of Object.keys(SYMBOL_MAP)) {
    if (key === "NIFTY") continue;

    const res = await getExpertTimingSignal(key, nifty);

    if (res.status === "TRIGGERED") {
      console.log(`🔥 [${res.type}] SIGNAL: ${key} @ ₹${res.price}`);
      console.log(`🎯 TARGET: ₹${res.target} | 🛑 SL: ₹${res.stopLoss}`);

      let isInserted = await insertStock(res);
      if (isInserted) {
        console.log(`✅ Signal for ${key} stored in DB.`);
      } else {
        console.log(`❌ Failed to store signal for ${key}.`);
      }
    } else {
      console.log(
        `⏳ ${key}: ${res.price || "Syncing"} [${res.reason || "Waiting"}]`,
      );
    }

    // AngelOne Rate Limit: 3 calls per second
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  console.log("🔍 Execution Complete.");
};

await cron();
