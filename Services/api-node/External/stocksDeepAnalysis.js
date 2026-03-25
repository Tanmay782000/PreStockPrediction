import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { client } from "../db/dynamo.client.js";
import yahooFinance from "yahoo-finance2";
import vader from "vader-sentiment";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });
const yf = new yahooFinance();
const Filtered_News = process.env.FilteredNews;
const Deepanalysis_Stocks = process.env.DeepStockAnalysis;
var countryId = null;  

export const get = async (event) => {
  try {

    countryId = event.countryId;
    const getnewsData = await client.send(
      new ScanCommand({
        TableName: Filtered_News,
      })
    );

    const stockData = getnewsData.Items[0].stockName.StocksAnalysis;
    const finalArr = [];

    // ✅ Fetch NIFTY ONCE
    const niftyData = await safeFetch(() =>
      yf.chart("^NSEI", { period1: "2024-01-01", interval: "1d" })
    );

    for (const element of stockData) {
      const stockname = element.displayName.toString();
      const stocksymbol = element.yahooFinanceFormat.toString();

      const response = await generateFeatures(
        stockname,
        stocksymbol,
        niftyData
      );
      console.log("FOR RSI",response);
      if (response != null) {
        const mergedText = `${element.rawStockNews} ${element.keyCatalysts}`;

        const score =
          vader.SentimentIntensityAnalyzer.polarity_scores(mergedText)
            .compound;

        finalArr.push({
          ...response,
          keyCatalysts: element.keyCatalysts,
          rawStockNews: element.rawStockNews,
          newsDate: element.newsDate,
          sentimentscore: score,
        });
      }

      // ✅ Increased delay
      await delay(800);
    }

    const res = await callBedrock(JSON.stringify(finalArr));
    
    return finalArr;
  } catch (err) {
    console.log("ERROR:", err);
  }
};

// ------------------ HELPERS ------------------

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ✅ RETRY LOGIC
async function safeFetch(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fn();

      if (!res || !res.quotes || res.quotes.length === 0) {
        throw new Error("Empty data");
      }

      return res;
    } catch (err) {
      if (i === retries - 1) {
        console.log("Final failure:", err.message);
        return null;
      }

      await delay(500 * (i + 1));
    }
  }
}

// ------------------ CORE LOGIC ------------------

async function generateFeatures(
  stockname,
  stocksymbol,
  niftyData
) {
  try {
    let appendNS = stockname + "" + ".NS"
    const res = await yf.search(appendNS);
    const stock = res.quotes.find((q) => q.exchange === "NSI");
    const finalStockSymbol = stock?.symbol ?? stocksymbol;

    const now = Math.floor(Date.now() / 1000);
    const twoDaysAgo = now - 60 * 60 * 48;

    // ✅ Sequential calls
    const stockData = await fetchStockWithFallback(finalStockSymbol);

    await delay(200);

    const intradayData = await safeFetch(() =>
      yf.chart(finalStockSymbol, {
        period1: twoDaysAgo,
        period2: now,
        interval: "5m",
      })
    );

    // ✅ Validate
    if (!stockData || !niftyData) {
      console.log("Skipping:", stockname);
      return null;
    }

    const quotes = stockData.quotes.filter((q) => q.close != null);
    const niftyQuotes = niftyData.quotes.filter((q) => q.close != null);

    const closes = quotes.map((q) => q.close);
    const volumes = quotes.map((q) => q.volume);
    const highs = quotes.map((q) => q.high);
    const lows = quotes.map((q) => q.low);
 
    const RSI = await calculateRSI(closes);
    const final_RSI = RSI[RSI.length - 1]
    const last = closes.length - 1;
    const nLast = niftyQuotes.length - 1;

    if (last < 120) throw new Error("Not enough data");

    let currentPrice = closes[last];

    if (intradayData && intradayData.quotes.length > 0) {
      const intradayQuotes = intradayData.quotes.filter(
        (q) => q.close != null
      );
      if (intradayQuotes.length > 0) {
        currentPrice =
          intradayQuotes[intradayQuotes.length - 1].close;
      }
    }

    closes[last] = currentPrice;

    const pctChange = (a, b) => (a - b) / b;

    const std = (arr) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      return Math.sqrt(
        arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length
      );
    };

    // -------- RETURNS --------
    const return_1d = pctChange(currentPrice, closes[last - 1]);
    const return_5d = pctChange(currentPrice, closes[last - 5]);
    const return_20d = pctChange(currentPrice, closes[last - 20]);

    const momentum_60 = pctChange(currentPrice, closes[last - 60]);
    const momentum_120 = pctChange(currentPrice, closes[last - 120]);

    // -------- SUPPORT / RESISTANCE --------
    const support_20 = Math.min(...lows.slice(-20));
    const resistance_20 = Math.max(...highs.slice(-20));

    const support_50 = Math.min(...lows.slice(-50));
    const resistance_50 = Math.max(...highs.slice(-50));

    const support_80 = Math.min(...lows.slice(-80));
    const resistance_80 = Math.max(...highs.slice(-80));

    const distance_support_20 =
      (currentPrice - support_20) / support_20;

    const distance_resistance_20 =
      (resistance_20 - currentPrice) / resistance_20;

    const breakout_20 = currentPrice > resistance_20 ? 1 : 0;

    // -------- VOLUME --------
    const avgVolume20 =
      volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;

    const volume_today = volumes[last];
    const volume_ratio = volume_today / avgVolume20;

    const avgVolume5 =
      volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;

    const volume_trend_5d = avgVolume5 / avgVolume20;

    const volume_spike_flag = volume_ratio > 1.5 ? 1 : 0;

    // -------- MARKET --------
    const nifty_return_1d = pctChange(
      niftyQuotes[nLast].close,
      niftyQuotes[nLast - 1].close
    );

    const nifty_20d = pctChange(
      niftyQuotes[nLast].close,
      niftyQuotes[nLast - 20].close
    );

    const relative_strength = return_20d - nifty_20d;

    const market_volatility = std(
      niftyQuotes.slice(-20).map((q, i, arr) =>
        i > 0 ? pctChange(q.close, arr[i - 1].close) : 0
      )
    );

    return {
      stockname,
      price: currentPrice,
      return_1d,
      return_5d,
      return_20d,
      momentum_20: return_20d,
      momentum_60,
      momentum_120,
      volatility_20: std(closes.slice(-20)),
      volatility_60: std(closes.slice(-60)),
      volume_today,
      avg_volume_20d: avgVolume20,
      volume_ratio,
      volume_trend_5d,
      volume_spike_flag,
      support_20,
      resistance_20,
      support_50,
      resistance_50,
      support_80,
      resistance_80,
      distance_support_20,
      distance_resistance_20,
      breakout_20,
      nifty_return_1d,
      RSI:final_RSI,
      relative_strength,
      market_volatility,
    };
  } catch (err) {
    console.log(`Error in ${stockname}:`, err.message);
    return null;
  }
}

async function fetchStockWithFallback(symbol) {
  const now = Math.floor(Date.now() / 1000);

  // primary: ~6 months
  const sixMonthsAgo = now - (60 * 60 * 24 * 180);

  console.log("going...",symbol)
  let data = await safeFetch(() =>
    yf.chart(symbol, {
      period1: sixMonthsAgo,
      period2: now,
      interval: "1d",
    })
  );
    console.log("finish...",symbol)

  // ✅ if insufficient → retry with 100 days
  if (!data || !data.quotes || data.quotes.length < 40) {
    console.log("Retrying with 100 days:", symbol);

    const hundredDaysAgo = now - (60 * 60 * 24 * 100);

    await delay(800);

    data = await safeFetch(() =>
      yf.chart(symbol, {
        period1: hundredDaysAgo,
        period2: now,
        interval: "1d",
      })
    );
  }

  return data;
}

async function calculateRSI(closes, period = 14) {
  let gains = [];
  let losses = [];
  
  // Step 1: price changes
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? Math.abs(diff) : 0);
  }

  // Step 2: first average
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  let rsi = [];

  // Step 3: Wilder smoothing
  for (let i = period; i < gains.length; i++) {
    avgGain = ((avgGain * (period - 1)) + gains[i]) / period;
    avgLoss = ((avgLoss * (period - 1)) + losses[i]) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const currentRSI = 100 - (100 / (1 + rs));

    rsi.push(currentRSI);
  }

  return rsi;
}

async function callBedrock(inputData) {
  const now_d = new Date();
  const todaydate = now_d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });
  console.log("IN PROMPT");

  const prompt = `
INPUT:
Stocks: ${JSON.stringify(inputData)}
CurrentTime: ${todaydate}

GOAL:
Estimate probability of profitable swing trade over next 5 trading days.

CORE RULE:
Adjust news impact using time difference between CurrentTime and newsDate:
- Very recent → strong impact
- Few hours old → partially priced in
- Old + momentum conflict → trust price over sentiment

PRIMARY FACTORS (priority order):
1. Momentum:
- Compare momentum_20, momentum_60, momentum_120
- Acceleration = bullish, weakening = bearish

2. Market Alignment:
- Use sector_return, nifty_return_1d, relative_strength
- Favor stocks outperforming sector and market

3. Volume Strength:
- volume_ratio > 1.5 = strong participation
- volume_trend_5d > 1 = accumulation
- Low volume = weak signal

4. Event Impact:
- Evaluate keyCatalysts strength

5. Sentiment:
- Use as secondary confirmation only

PRICE LEVEL LOGIC:

Support:
- Near support + positive momentum → bullish
- Break below support → bearish

Resistance:
- Near resistance + weak volume → rejection risk
- Near resistance + strong volume → breakout chance
- breakout_20 = 1 → strong continuation

Distance:
- Near resistance + weak momentum → reduce probability
- Breakout + strong volume → increase probability

VOLUME SIGNALS:
- volume_ratio > 1.5 → strong
- volume_spike_flag = 1 + positive momentum → strong continuation
- momentum without volume → weak

PREFFERED DAYS TO HOLD THE POSITOIN:
- Number of preffered days to hold the position.
(e.g. 1 day or 2-4 days or >1 week or >1 month etc...)

RISK REDUCTION:
Reduce probability if:
- volatility_20 or volatility_60 > market_volatility
- underperforming sector
- sentiment contradicts price
- weak volume confirmation
- near resistance without breakout

inputData.stockId:
Get the input stockId from given data(inputData array)

inputData.final_RSI:
Get the input final_RSI from given data(inputData array)

OUTPUT FORMAT:
[
{
"StockId": inputData.stockId,
"Stock": "",
"Sentiment_Score": 0,
"Key_Catalyst": "",
"Probability_of_Profit": 0%,
"Expected_Growth": "",
"5-Day_Return": 0,
"Volume_Ratio": 0,
"Volatility_(20D)": 0,
"Preffered_Days":"",
"RSI": inputData.final_RSI
}
]

OUTPUT RULES:
- Return only valid JSON array
- No explanations or extra text
- Keep text fields short and clean
`;

  const command = new InvokeModelCommand({
    modelId: "anthropic.claude-3-sonnet-20240229-v1:0", // example
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 2500,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: prompt }],
        },
      ],
    }),
  });
  console.log("Completed");
  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(Buffer.from(response.body).toString());
  var text = responseBody.content[0].text;
  console.log("kind of format", text);
  const finalArr = JSON.parse(text);

  //ADD LOGIC OF SAVING DATA INTO DATABASE(In new table called stock deep analysis)
  const now = new Date().toISOString();
  let item = {
    countryId: Number(countryId),
    DeepAnalysis: finalArr || [],
    createdDate: now,
    modifiedDate: now,
  };
    
  await client.send(
    new PutCommand({
      TableName: Deepanalysis_Stocks,
      Item: item,
    }),
  );

  return {
    statusCode: "200",
    body: "Good to go",
  };
}
