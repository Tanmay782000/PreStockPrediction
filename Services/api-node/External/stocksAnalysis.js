import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { client } from "../db/dynamo.client.js";

const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });

export const getStockAnalysis = async (event) => {
  const countryId = event.countryId;
  const inputData = event.inputarray;
  console.log("got input data", inputData);
  const Filtered_News = process.env.FilteredNews;
  const prompt = ` 
INPUT:
News: ${JSON.stringify(inputData)}

GOAL:
Extract stocks from news and predict short-term direction (Profit or Loss) with probability based on sentiment and catalysts.

RULES:
- Only include stocks explicitly mentioned.
- Ignore IPO-related stocks.
- Use most recent and strongest news signals.
- Probability must be integer (0-100).
- No quotes or special characters inside text fields.
- Keep text fields short and clean.

EVENT TYPES:
Earnings, Government policy, Analyst upgrade, Partnership, Expansion, Management change, Litigation, Product launch

OUTPUT FORMAT:
{
  "StocksAnalysis": [],
  "NiftyPrediction": {}
}

STOCK ANALYSIS LOGIC:
For each stock:
- stockId: incremental number
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

NIFTY ANALYSIS LOGIC:
- NiftyOutlook: Intraday or Few Sessions
- NiftyPrediction: Bullish / Bearish / Sideways
- Confidence: percentage (string format)
- KeySignals: short technical signals (support, resistance, RSI, MACD, structure)
- Description: short market view
- Trade View: breakout / range / breakdown levels

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
  console.log("kind of format", text);
  const finalArr = JSON.parse(text);
  console.log("final array", finalArr);
  var getnewsData = await client.send(
    new ScanCommand({
      TableName: Filtered_News,
      Key: { countryId: Number(countryId) },
    }),
  );

  const now = new Date().toISOString();
  let item = {
    countryId: Number(countryId),
    termSummery: getnewsData.Items[0].termSummery,
    categorySummery: getnewsData.Items[0].categorySummery,
    sectorSummery: getnewsData.Items[0].sectorSummery,
    // stockName: finalArr?.StocksAnalysis || [],
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
  console.log("stocks done");
  return {
    statusCode: 200,
    body: "good to go",
  };
};
