import axios from 'axios';
import { SYMBOL_MAP } from '../../Common/stockInfo.js';
import yahooFinance from "yahoo-finance2";

const yf = new yahooFinance();
// ---------------- CONFIGURATION ----------------
const CONFIG = {
    apiKey: "uVNH5DtC",
    // Use the JWT Token you provided (Ensure it is refreshed daily)
    jwtToken: "eyJhbGciOiJIUzUxMiJ9.eyJ1c2VybmFtZSI6IkFBQ0c2NjE4MjciLCJyb2xlcyI6MCwidXNlcnR5cGUiOiJVU0VSIiwidG9rZW4iOiJleUpoYkdjaU9pSlNVekkxTmlJc0luUjVjQ0k2SWtwWFZDSjkuZXlKMWMyVnlYM1I1Y0dVaU9pSmpiR2xsYm5RaUxDSjBiMnRsYmw5MGVYQmxJam9pZEhKaFpHVmZZV05qWlhOelgzUnZhMlZ1SWl3aVoyMWZhV1FpT2pNc0luTnZkWEpqWlNJNklqTWlMQ0prWlhacFkyVmZhV1FpT2lJd05UWmhaRGs1WWkxaE1qWTFMVE5tTkdVdFlXSmlOaTA1T0RabFltSTNOalk0Wm1JaUxDSnJhV1FpT2lKMGNtRmtaVjlyWlhsZmRqSWlMQ0p2Ylc1bGJXRnVZV2RsY21sa0lqb3pMQ0p3Y205a2RXTjBjeUk2ZXlKa1pXMWhkQ0k2ZXlKemRHRjBkWE1pT2lKaFkzUnBkbVVpZlN3aWJXWWlPbnNpYzNSaGRIVnpJam9pWVdOMGFYWmxJbjE5TENKcGMzTWlPaUowY21Ga1pWOXNiMmRwYmw5elpYSjJhV05sSWl3aWMzVmlJam9pUVVGRFJ6WTJNVGd5TnlJc0ltVjRjQ0k2TVRjM05qRTFNVEk0TkN3aWJtSm1Jam94TnpjMk1EWTBOekEwTENKcFlYUWlPakUzTnpZd05qUTNNRFFzSW1wMGFTSTZJakZrTkRjM05tUmxMVE5oWlRjdE5ERTJZeTFpTURJMkxUa3dNall5T0RkaU9ETXlNeUlzSWxSdmEyVnVJam9pSW4wLllReG9zdE1uWWJ5aVY4ZW5fWXgwLXBTeElFQlIzZnlQa1REcTc3UmZJMTdla0cxdVhRQTJHbWdZU0QtWEFEQ243STlFRmtyX1BhX3Bjd0FHSGZhQ2JickxCd3Q0YWlreXF3YkFLRUlEVzBXdUdoODQxZVEyODAtaWtkY0htZE1UUFlHei1senVsTVdaMFNaX2M5M0w2ZnFoZVhIZ0oyQzhJTUJoZVNmS2lGQSIsIkFQSS1LRVkiOiJ1Vk5INUR0QyIsIlgtT0xELUFQSS1LRVkiOmZhbHNlLCJpYXQiOjE3NzYwNjQ4ODQsImV4cCI6MTc3NjEwNTAwMH0.BQ8aqhDAlkDLTM25DcaGP1rWuBkhkwaXpaQ7Ac3fHrTcWUvqu9tvwpXYegYZxRcSNRsqDkJa1pHjAV4CKKTU-g", 
    publicIP: "45.114.212.194", // From your earlier whitelisting screenshot
    localIP: "127.0.0.1"
};

const ATR_PERIOD = 20;
const sYMBOL_MAP = SYMBOL_MAP;
 
// ---------------- RAW AXIOS HELPER (For Nifty/AngelOne) ----------------
async function callAngelApi(payload) {
  const config = {
    method: "post",
    url: "https://apiconnect.angelone.in/rest/secure/angelbroking/historical/v1/getCandleData",
    headers: {
      "X-PrivateKey": CONFIG.apiKey,
      Accept: "application/json",
      "X-SourceID": "WEB",
      "X-ClientLocalIP": CONFIG.localIP,
      "X-ClientPublicIP": CONFIG.publicIP,
      "X-MACAddress": "02:00:00:00:00:00",
      "X-UserType": "USER",
      Authorization: `Bearer ${CONFIG.jwtToken}`,
      "Content-Type": "application/json",
    },
    data: JSON.stringify(payload),
  };

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error("API Call Failed:", error.response ? error.response.data : error.message);
    return { status: false };
  }
}

// ---------------- YAHOO FINANCE HELPER (For Stocks) ----------------
/**
 * Fetches data from Yahoo Finance and converts it to the [time, o, h, l, c, v] format
 * to maintain compatibility with your existing strategy logic.
 */
async function fetchStockDataYahoo(symbol, interval, days) {
  try {
    const period1 = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
    
    // Yahoo Finance needs .NS suffix for NSE stocks
    const ticker = symbol.endsWith(".NS") ? symbol : `${symbol}.NS`;
    
    const result = await yf.chart(ticker, {
      period1: period1,
      interval: interval === "FIFTEEN_MINUTE" ? "15m" : "1d",
    });

    if (!result.quotes || result.quotes.length === 0) return [];

    // Map Yahoo Objects to AngelOne Array Format: [timestamp, O, H, L, C, V]
    return result.quotes
      .filter(q => q.close && q.volume) // Clean dirty data
      .map(q => [
        q.date.toISOString(), 
        q.open, 
        q.high, 
        q.low, 
        q.close, 
        q.volume
      ]);
  } catch (err) {
    console.error(`❌ Yahoo Fetch Error for ${symbol}: ${err.message}`);
    return [];
  }
}

// ---------------- TECHNICAL HELPERS (Logic remains same) ----------------
const average = (arr) => arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

function getHistoricalATR(allQuotes, currentIndex, period) {
  if (currentIndex < period) return 0;
  const trs = [];
  for (let i = currentIndex - period + 1; i <= currentIndex; i++) {
    const tr = Math.max(
      allQuotes[i][2] - allQuotes[i][3],               // H - L
      Math.abs(allQuotes[i][2] - allQuotes[i - 1][4]), // H - Prev C
      Math.abs(allQuotes[i][3] - allQuotes[i - 1][4]), // L - Prev C
    );
    trs.push(tr);
  }
  return average(trs);
}

// Stitched fetch remains for NIFTY (AngelOne)
async function fetchStitchedDataAngel(token, interval, days) {
  const data = [];
  const now = new Date();
  for (let i = 0; i < Math.ceil(days / 30); i++) {
    const toDate = new Date(now.getTime() - i * 30 * 24 * 60 * 60 * 1000);
    const fromDate = new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const payload = {
      exchange: "NSE", symboltoken: token, interval: interval,
      fromdate: fromDate.toISOString().replace("T", " ").slice(0, 16),
      todate: toDate.toISOString().replace("T", " ").slice(0, 16),
    };
    const res = await callAngelApi(payload);
    if (res.status && res.data) data.unshift(...res.data);
    await new Promise((r) => setTimeout(r, 400));
  }
  return data;
}

// ================================================================
//  MAIN BACKTEST ENGINE — HYBRID MODE
// ================================================================
async function runBacktest() {
  console.log("🚀 Starting Hybrid Bullish Backtest...");
  console.log("📡 Nifty: AngelOne API | Stocks: Yahoo Finance API");
  console.log("━".repeat(55));

  let totalWins = 0, totalLosses = 0, totalTrades = 0;

  // ── Step 1: Fetch Nifty (AngelOne) ──────────────────────────────
  const allNiftyIntraday = await fetchStitchedDataAngel("99926000", "FIFTEEN_MINUTE", 60);
  const allNiftyDaily    = await fetchStitchedDataAngel("99926000", "ONE_DAY", 60);

  for (const [symbolKey, stockData] of Object.entries(sYMBOL_MAP)) {
    // Skip Smallcap / Penny
    if (stockData.stockNameCategory === "Smallcap" || stockData.stockNameCategory === "Penny") {
      continue;
    }

    try {
      // ── Step 2: Fetch Stock Data (Yahoo Finance) ────────────────
      const allStockIntraday = await fetchStockDataYahoo(symbolKey, "FIFTEEN_MINUTE", 60);
      const allStockDaily    = await fetchStockDataYahoo(symbolKey, "ONE_DAY", 60);

      if (allStockIntraday.length === 0) continue;

      // Group intraday candles by date
      const daysMap = {};
      allStockIntraday.forEach((q) => {
        const dateStr = q[0].split("T")[0];
        if (!daysMap[dateStr]) daysMap[dateStr] = [];
        daysMap[dateStr].push(q);
      });

      const stats = { wins: 0, losses: 0 };

      for (const todayStr of Object.keys(daysMap).sort()) {
        const todayStockQuotes  = daysMap[todayStr];
        const todayNiftyQuotes  = allNiftyIntraday.filter((nq) => nq[0].startsWith(todayStr));

        if (todayStockQuotes.length < 3 || todayNiftyQuotes.length < 3) continue;

        const nDailyIdx = allNiftyDaily.findIndex((nd) => nd[0].startsWith(todayStr));
        if (nDailyIdx <= 0) continue;
        const yesterdayNiftyClose = allNiftyDaily[nDailyIdx - 1][4];

        const sDailyIdx = allStockDaily.findIndex((dq) => dq[0].startsWith(todayStr));
        if (sDailyIdx <= 0) continue;
        const yesterdayStockClose = allStockDaily[sDailyIdx - 1][4];

        const gapPercent = ((todayStockQuotes[0][1] - yesterdayStockClose) / yesterdayStockClose) * 100;
        if (gapPercent > 3.0) continue;

        const morningHigh   = Math.max(todayStockQuotes[0][2], todayStockQuotes[1][2]);
        const avgMorningVol = (todayStockQuotes[0][5] + todayStockQuotes[1][5]) / 2;

        let sVwapP = 0, sVwapV = 0;

        for (let i = 0; i < todayStockQuotes.length; i++) {
          const candle = todayStockQuotes[i];
          sVwapP += candle[4] * candle[5];
          sVwapV += candle[5];
          const stockVWAP = sVwapP / sVwapV;

          if (i < 2) continue;

          // Build cumulative Nifty VWAP
          let nVwapP = 0, nVwapV = 0;
          for (let ni = 0; ni <= Math.min(i, todayNiftyQuotes.length - 1); ni++) {
            nVwapP += todayNiftyQuotes[ni][4] * (todayNiftyQuotes[ni][5] || 1);
            nVwapV += todayNiftyQuotes[ni][5] || 1;
          }
          const niftyVWAP = nVwapP / nVwapV;
          const nCandle   = todayNiftyQuotes[Math.min(i, todayNiftyQuotes.length - 1)];
          
          const niftyIsBullish = (nCandle[4] > yesterdayNiftyClose) && 
                                 (nCandle[4] > niftyVWAP * 0.9998 || (Math.abs(nCandle[4] - nCandle[1]) / (nCandle[2] - nCandle[3]) > 0.3));

          if (!niftyIsBullish) continue;

          const isBreakout = candle[4] > morningHigh && candle[4] > stockVWAP;
          const isReclaimingValue = candle[4] > stockVWAP && todayStockQuotes[i - 1][4] < stockVWAP;
          const hasVolumeSurge = candle[5] > avgMorningVol * 1.1;
          const isStrongCandle = (candle[2] - candle[3]) > 0 ? (Math.abs(candle[4] - candle[1]) / (candle[2] - candle[3]) > 0.5) : false;

          if (hasVolumeSurge && isStrongCandle && (isBreakout || isReclaimingValue)) {
            const globalIdx = allStockIntraday.findIndex((q) => q[0] === candle[0]);
            const atr = getHistoricalATR(allStockIntraday, globalIdx, ATR_PERIOD);

            const entry = candle[4];
            const target = entry + atr * 5.0;
            const stopLoss = entry - atr * 2.5;

            let tradeResult = null;
            for (let j = i + 1; j < todayStockQuotes.length; j++) {
              if (todayStockQuotes[j][3] <= stopLoss) { tradeResult = "LOSS"; break; }
              if (todayStockQuotes[j][2] >= target) { tradeResult = "WIN"; break; }
            }

            if (!tradeResult) {
              tradeResult = todayStockQuotes[todayStockQuotes.length - 1][4] > entry ? "WIN" : "LOSS";
            }

            if (tradeResult === "WIN") stats.wins++; else stats.losses++;
            break; 
          }
        }
      }

      const tradeCount = stats.wins + stats.losses;
      totalWins += stats.wins; totalLosses += stats.losses; totalTrades += tradeCount;

      console.log(`📊 ${symbolKey.padEnd(14)} | Trades: ${String(tradeCount).padStart(3)} | WR: ${tradeCount > 0 ? ((stats.wins/tradeCount)*100).toFixed(1) : 0}%`);
    } catch (err) {
      console.error(`❌ Error on ${symbolKey}: ${err.message}`);
    }
  }

  console.log("\n" + "=".repeat(55));
  console.log(`🏆 OVERALL WIN RATE : ${((totalWins / totalTrades) * 100).toFixed(2)}%`);
  console.log(`📈 Total Trades     : ${totalTrades}`);
  console.log("=".repeat(55));
}

runBacktest();