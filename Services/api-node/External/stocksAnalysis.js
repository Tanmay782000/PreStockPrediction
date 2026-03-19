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
##Global News Array
${JSON.stringify(inputData)}

##Processing Instructions
Extract stock names explicitly mentioned in the news articles.
Ignore the IPO launch stocks.
Predict whether each stock has a higher probability of Profit or Loss based on the news sentiment and catalysts.
Probability must be an integer between 0 and 100.
Use the most recent and strongest news signals to determine the prediction.
Return the stocks which are mentioned in raw data.
Avoid quotation marks inside text values such as keyCatalysts to prevent JSON parsing issues.
Classify this news into event categories:
Earnings,
Government policy,
Analyst upgrade,
Partnership,
Expansion,
Management change,
Litigation,
Product launch

##Field Definitions
stockId
Numerical value from 1 to n.

displayName
Stock name mentioned in the news article.

Prediction
Expected direction based on the news sentiment.
Allowed values: Profit or Loss.

probability
Confidence level of the prediction from 0 to 100 based on the strength and recency of news.

category
Market category of the stock such as Nifty50, Nifty Midcap100, or Small Cap.

sector
Industry sector of the stock such as Information Technology, Healthcare, Utilities, Financial Services, etc.

keyCatalysts
One short sentence explaining the main reason why the stock is predicted to move in the given direction.

rawStockNews
information related to stock pick(e.g. target price, stop loss, expected growth, timeduration and technical analysis of stock);

yahooFinanceFormat
Ticker formatted for the Yahoo Finance library.Do proper research and fetch the latest ticker format, ensuring it reflects any recent changes made by the company instead of using outdated symbols.
Example: Reliance → RELIANCE.NS

stockNameCategory
Nifty 50 or Largecap or Midcap or Smallcap or Penny

eventCategory
event category based on news insights.

##Output JSON Schema
{
"StocksAnalysis":[
{
"stockId":"",
"displayName":"",
"Prediction":"",
"probability":0,
"category":"",
"sector":"",
"keyCatalysts":"",
"yahooFinanceFormat":"",
"stockNameCategory":"",
"eventCategory","",
"rawStockNews":""
}
]
}

##Output Rules
Return strictly valid JSON.
Do not include explanations, markdown, or text outside the JSON structure.
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
    stockName: finalArr?.StocksAnalysis || [],
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
