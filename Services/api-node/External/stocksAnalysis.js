const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const { PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { client } = require("../db/dynamo.client");
const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });

exports.get = async (event) => {
  const inputData = event.inputData;
  console.log("got input data",inputData);
  const now_d = new Date();
  const Time = now_d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });
  const beforeTime = new Date(Date.now() + 5.5 * 3600000 - 12 * 3600000);
  const Filtered_News = process.env.FilteredNews;
  const prompt = ` 
##Global News Array
${JSON.stringify(inputData)}

##Time Focus
Prioritize news published between ${Time} and ${beforeTime}.
Give higher weight to more recent news when determining predictions.

##Processing Instructions
Extract stock names explicitly mentioned in the news articles.
Ignore general market news that does not reference specific companies.
Convert any news timestamps from UTC to IST (UTC+05:30).
Predict whether each stock has a higher probability of Profit or Loss based on the news sentiment and catalysts.
Probability must be an integer between 0 and 100.
Use the most recent and strongest news signals to determine the prediction.
Return a maximum of 10 stocks with the strongest predictions.
Avoid quotation marks inside text values such as keyCatalysts to prevent JSON parsing issues.

##Field Definitions

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

newsDate
Original news timestamp taken from the input news data and converted from UTC to IST.

yahooFinanceFormat
Ticker formatted for the Yahoo Finance library.
Example: Reliance → RELIANCE.NS

##Output JSON Schema
{
"StocksAnalysis":[
{
"displayName":"",
"Prediction":"",
"probability":0,
"category":"",
"sector":"",
"keyCatalysts":"",
"newsDate":"",
"yahooFinanceFormat":""
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
  console.log("final array",finalArr);
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
    stockName: finalArr[0].StocksAnalysis,
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
    body: "good to go"
  }
};
