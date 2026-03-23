import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { client } from "../db/dynamo.client.js";
import { getStockAnalysis } from "./stocksAnalysis.js";
import { urlExtraction } from "../External/urlExtraction.js";

const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });

export const getAnalysis = async (event) => {
  const Filtered_News = process.env.FilteredNews;
  const countryId = event.countryId;
  const inputarray = event.inputData;
  const termList = event.termList;
  const categoryList = event.categoryList;
  const sectorList = event.sectorList;
  const now_d = new Date();
  const todaydate = now_d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });
  const beforedate = new Date(Date.now() + 5.5 * 3600000 - 12 * 3600000);
  const prompt = `
INPUT:
News: ${JSON.stringify(inputarray)}
Terms: ${JSON.stringify(termList)}
Categories: ${JSON.stringify(categoryList)}
Sectors: ${JSON.stringify(sectorList)}
CurrentDate: ${todaydate}
FallbackDate: ${beforedate}

GOAL:
Predict probability of profit (0-100) for Terms, Categories, and Sectors based on news sentiment and recency.

RULES:
- Prioritize news from CurrentDate; use older data only if needed.
- Give higher weight to recent timestamps.
- Focus on forward-looking signals, not past performance.
- Output must be valid JSON only.
- Do NOT include quotes, backticks, or escaped characters inside text values.
- Keep summaries short and clean.

OUTPUT FORMAT:
{
  "Section1": { "probabilityArr": [], "summary": "" },
  "Section2": { "probabilityArr": [], "summary": "" },
  "Section3": { "probabilityArr": [], "summary": "" }
}

SECTION LOGIC:

1. Section1 - Term Analysis
- Evaluate each term using news sentiment and recency.
- Assign probability (0-100).
- Maintain same order as input list.
- Output format:
  [{TermName:Probability}]

2. Section2 - Category Analysis
- Evaluate each category similarly.
- Maintain input order.
- Output format:
  [{CategoryName:Probability}]

3. Section3 - Sector Analysis
- Evaluate each sector similarly.
- Maintain input order.
- Output format:
  [{SectorName:Probability}]

SUMMARY RULE:
- One short paragraph per section.
- No special characters or quotes inside text.

FINAL RULE:
Return ONLY the JSON object. No extra text.
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

  var getnewsData = await client.send(
    new ScanCommand({
      TableName: Filtered_News,
      Key: { countryId: Number(countryId) },
    }),
  );

  console.log("Got the first response");

  const now = new Date().toISOString();
  let item = {
    countryId: Number(countryId),
    termSummery: finalArr.Section1,
    categorySummery: finalArr.Section2,
    sectorSummery: finalArr.Section3,
    stockName: getnewsData.Items[0].stockName,
    createdDate: now,
    modifiedDate: now,
  };

  await client.send(
    new PutCommand({
      TableName: Filtered_News,
      Item: item,
    }),
  );
  console.log("put completed");

  console.log("going to do sector analysis");

  const input = { countryId, inputarray };
  const result = await urlExtraction(input);
  // const result = await ExecuteStocksInsights(input);
  if (result != null) {
    console.log("good it's not null", result);
    console.log("market done");
  }

  return {
    statusCode: 200,
    body: "good to go",
  };
};

///UPDATE TO URLEXTRACTION
async function ExecuteStocksInsights(input) {
  const payload = input;
  const command = new InvokeCommand({
    FunctionName: "SP-Node-Lambda-Functions-dev-getstocksAnalysis",
    InvocationType: "RequestResponse",
    Payload: Buffer.from(JSON.stringify(payload)),
  });
  const response = await lambdaClient.send(command);
  // const result = JSON.parse(Buffer.from(response.Payload).toString());
}
