import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { client } from "../db/dynamo.client.js";
import { sectorStockSelector } from "./sectorStockSelector.js";

const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });

export const getStockAnalysis = async (event) => {
  const countryId = event.countryId;
  const inputData = event.inputarray;
  console.log("got input data", inputData);
  const Filtered_News = process.env.FilteredNews;
  const prompt = ` 
News: ${JSON.stringify(inputData)}

GOAL:
Extract stocks from news and predict short-term direction (Profit or Loss) with probability based on sentiment and catalysts.

Time Horizon Priority:
1. Primary: Swing trades (2-5 trading days)
2. Secondary: Intraday (same day) ONLY if swing signals are weak or unavailable

RULES:
- Only include stocks explicitly mentioned.
- Ignore IPO-related stocks, Indexes, return pure stocks only.
- Use most recent and strongest news signals.
- Give higher priority to news titles that contain strong probability or directional cues (e.g., prediction, support/resistance, target, breakout) when generating NiftyPrediction.
- Probability must be integer (0-100).
- No quotes or special characters inside text fields.
- Keep text fields short and clean.

SIGNAL PRIORITY (highest → lowest):
1. Swing signals:
   breakout, trend continuation, support bounce, resistance breakout, pattern formation, multi-day targets
2. Catalyst-based:
   earnings, upgrades, partnerships, expansion, policy impact
3. Intraday signals:
   buy today, intraday levels, opening trade setup

EVENT TYPES:
Earnings, Government policy, Analyst upgrade, Partnership, Expansion, Management change, Litigation, Product launch, UnderPerformer, MarketAligned

STOCK ANALYSIS LOGIC:
For each stock:
- stockId: incremental number(1 to n) in string ""
- displayName: stock name
- Prediction: Profit or Loss
- probability: 0-100 based on sentiment strength and recency
- category: Nifty50, Midcap, Smallcap, etc.
- sector: industry sector
- keyCatalysts: one short reason for movement
- yahooFinanceFormat: latest valid ticker (e.g., RELIANCE.NS)
- stockNameCategory: Largecap / Midcap / Smallcap / Penny
- eventCategory: choose from defined event types
- rawStockNews: short summary of trade-related info
- expectedProfit: expected profit in percentage based on news.
- timehorizon: Swing / Intraday
- suggestedBy: Based on news & technicals //default text, no need of AI to generate

NIFTY ANALYSIS LOGIC:
- Give priority to titles containing directional cues (support, resistance, breakout, target, prediction)
- Focus on short-term outlook (Intraday to Few Sessions)
- NiftyOutlook: Intraday or Few Sessions
- NiftyPrediction: Bullish / Bearish / Sideways
- Confidence: percentage (string format)
- KeySignals: short technical signals (support, resistance, RSI, MACD, structure)
- Description: short market view
- Trade View: breakout / range / breakdown levels

OUTPUT FORMAT:
{
  "StocksAnalysis": [],
  "NiftyPrediction": {}
}

FINAL RULE:
Return ONLY valid JSON. No extra text.
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

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(Buffer.from(response.body).toString());
  var text = responseBody.content[0].text;
  const finalArr = JSON.parse(text);
  console.log("final array", finalArr);

  var getnewsData = await client.send(
    new ScanCommand({
      TableName: Filtered_News,
      Key: { countryId: Number(countryId) },
    }),
  );

  const now = new Date().toISOString();

  //#region Get Sector Stocks based on Nifty Prediction
  let niftySentiment = ["Bearish", "Bullish"];
  let index = 0;
  while (index < 2) {
    let sentiment = niftySentiment[index];
    let data = await sectorStockSelector({
      niftySentiment: sentiment, //Bullish or Sideways
    });

    if (data != null) {
      let sectorStocks = [];
      var result = data.body;
      for (const stock of result) {
        var format = {
          stockId: "0",
          category: stock.category,
          displayName: stock.displayName,
          eventCategory: stock.eventCategory,
          expectedProfit: "0",
          keyCatalysts: stock.keyCatalysts,
          Prediction: stock.Prediction,
          probability: "0",
          rawStockNews: "",
          sector: stock.sector,
          stockNameCategory: stock.stockNameCategory,
          suggestedBy: stock.suggestedBy,
          yahooFinanceFormat: stock.symbol,
          timehorizon: stock.timehorizon,
        };
        sectorStocks.push(format);
      }

      finalArr.StocksAnalysis = [...finalArr.StocksAnalysis, ...sectorStocks];
      const stocks = finalArr.StocksAnalysis;

      // 1️⃣ Get max stockId
      let maxId = Math.max(...stocks.map((s) => Number(s.stockId) || 0));

      // 2️⃣ Assign new IDs where stockId = 0
      for (let item of stocks) {
        if (!Number(item.stockId) || Number(item.stockId) === 0) {
          maxId++;
          item.stockId = maxId;
        }
      }
    }
    index++;
  }
  //#endregion

  let item = {
    countryId: Number(countryId),
    termSummery: getnewsData.Items[0].termSummery,
    categorySummery: getnewsData.Items[0].categorySummery,
    sectorSummery: getnewsData.Items[0].sectorSummery,
    stockName: finalArr || [],
    createdDate: now,
    modifiedDate: now,
  };
  await client.send(
    new PutCommand({
      TableName: Filtered_News,
      Item: item,
    }),
  );

  return {
    statusCode: 200,
    body: "good to go",
  };
};
