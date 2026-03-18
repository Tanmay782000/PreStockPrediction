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
Task:
From the input news dataset, return the top 3 URLs.

Input Dataset: ${inputData}
Current DateTime: ${dateTime}

Step 1: Classify Each Article (mandatory)

Classify every article into ONE category:

1. Trading (Intraday)

* Same-day trades
* Intraday levels, opening strategy, day trading

2. Short-Term Swing (2-5 Days)

* Short-term / near-term / positional trades
* Expected movement over multiple days
* Breakout with follow-through or targets beyond same day

Step 2: Base Filters (must pass all)

* Must explicitly mention specific stock/company names
* Must contain trade intent, such as:
  buy / sell / hold
  breakout
  top picks
  trading plan
  stock to buy today
* Must be from:
  a credible financial publisher
  OR
  include a named market analyst

Step 3: Priority Rules

* Always prefer most recent published articles
* Prefer stronger signals:
  BUY/SELL > recommendation > watch/opinion

Step 4: Composition Logic (strict)

Select exactly 3 URLs using this combination:

* Either:
  2 Trading (Intraday) + 2 Short-Term Swing
  OR
  1 Trading (Intraday) + 3 Short-Term Swing
  OR
  3 Trading (Intraday) + 1 Short-Term Swing

Selection approach:

* First, pick best articles within each category
* Then form a valid mix using:
  latest publish time
  strongest trade signals
* If one category has insufficient articles:
  fill remaining slots from the other category

Step 5: Reject Conditions

* No stock names mentioned
* Only general market news (index movement, opening/closing updates)
* Duplicate or same content from multiple domains

Step 6: Output Rules

* Return exactly 3 URLs
* Maintain required mix (Trading + Swing)
* If fewer than 3 valid URLs exist:
  fill remaining with null
* If no valid URLs exist:
  return all values as null

Output Format (strict JSON only):

{
"top_urls": ["url1", "url2", "url3"]
}
---`;

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(Buffer.from(response.body).toString());
  var text = responseBody.content[0].text;
  console.log("kind of format", text);
  const result = JSON.parse(text);

  // Save in the database

  const cId = countryId;
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
  const responseData = await client.send(
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

  item = {
    countryId: cId,
    urls: result.top_urls,
    extractedData: urls_explaination,
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
