import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

import { getStockAnalysis } from "../External/stocksAnalysis.js";
import { get } from "../External/stocksDeepAnalysis.js";
import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { client } from "../db/dynamo.client.js";
import axios from "axios";
import * as cheerio from "cheerio";

const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });
const Url_Extraction = process.env.UrlExtractionTable;
export const urlExtraction = async (event) => {
  const countryId = event.countryId;
  const inputData = event.inputarray;

  const now_d = new Date();
  const dateTime = now_d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  });

  const prompt = `
INPUT:
News: ${JSON.stringify(inputData)}
CurrentTime: ${dateTime}

GOAL:
Return top 3 URLs with actionable stock trade signals.

STEP 1: CLASSIFY
Assign each article to one:
- Intraday (same-day trades, levels, opening strategy)
- Swing (2-5 day trades, short-term targets, breakout continuation)

STEP 2: FILTER (must pass all)
- Contains specific stock names
- Contains trade intent: buy, sell, hold, breakout, top picks, trading plan
- Source is credible OR includes named analyst

STEP 3: PRIORITY
- Prefer latest articles (based on publish time)
- Stronger signals rank higher:
  BUY/SELL > recommendation > watch/opinion

STEP 4: SELECTION
- Pick best articles per category first
- Then select total 3 URLs using mix:
  - Prefer both categories
  - If one category lacks entries, fill from the other
- Avoid duplicates or same-content sources

STEP 5: REJECT
- No stock names
- Only general market news
- Duplicate/similar articles

OUTPUT:
{
  "top_urls": ["", "", ""]
}

RULES:
- Return exactly 3 URLs
- Use null if insufficient valid entries
- Return only valid JSON
- No extra text
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
  const result = JSON.parse(text);

  // Save in the database

  const cId = Number(countryId);
  let item = {
    countryId: cId,
    urls: result.top_urls,
    extractedData: null,
  };

  await client.send(
    new PutCommand({
      TableName: Url_Extraction,
      Item: item,
    }),
  );

  //Get the result from database
  var responseData = await client.send(
    new ScanCommand({
      TableName: Url_Extraction,
      Key: { countryId: cId },
    }),
  );

  var data = responseData.Items[0];
  const urls = data.urls;
  var urls_explaination = [];

  //iterate it with scrapeClean push it into array

  for (const url of urls) {
    const res = await scrapeClean(url);
    if (res != null) {
      urls_explaination.push(res);
    }
  }

  if (urls_explaination.length > 0) {
    console.log("data", JSON.stringify(urls_explaination));
  } else {
    console.log("You are having an empty data!!!");
  }

  //save into the URLExtraction table
  const now = new Date().toISOString();
  item = {
    countryId: cId,
    urls: result.top_urls,
    extractedData: urls_explaination,
    createdDate: now,
    modifiedDate: now
  };

  await client.send(
    new PutCommand({
      TableName: Url_Extraction,
      Item: item,
    }),
  );
  console.log("saved in database");

  //get from the database
  responseData = await client.send(
    new ScanCommand({
      TableName: Url_Extraction,
      Key: { countryId: cId },
    }),
  );
  data = responseData.Items[0];

  //call the stocks analysis lambda
  item = {
    countryId: cId,
    inputarray: data.extractedData,
  };
  var getdata = await getStockAnalysis(item);
  if (getdata != null) {
    item = {
      countryId: cId,
    };
    getdata = await get(item);
    if (getdata != null) {
      return {
        statusCode: 200,
        body: "good to go",
      };
    }
    return {
      statusCode: 200,
      body: "good to go",
    };
  }
  return {
    StatusCode: 500,
    body: "Something Went Wrong!!",
  };
};

async function scrapeClean(url) {
  try {
    const { data } = await axios.get(url, {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    });

    const $ = cheerio.load(data);

    const title = $("title").text();
    const content = $("p")
      .map((i, el) => $(el).text())
      .get()
      .join(" ");

    return { title, content };
  } catch (err) {
    console.error("Error:", err.message);
    return null;
  }
}
