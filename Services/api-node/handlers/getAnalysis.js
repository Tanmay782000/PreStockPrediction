import { client } from "../db/dynamo.client.js";
import { ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { verify } from "../Common/auth.middleware.js";

// Table name from environment variable
const TABLE = process.env.FilteredNews;

export const showTermAnalysis = async (event) => {
  try {
    await verify(event);
    const id =
      event.queryStringParameters?.countryId ||
      (event.body ? JSON.parse(event.body).countryId : null);

    const result = await client.send(
      new GetCommand({
        TableName: TABLE,
        Key: { countryId: Number(id) },
      }),
    );

    var item = result.Item.termSummery;

    return {
      statusCode: 200,
      headers:{
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE"
      },
      body: JSON.stringify({
        termAnalysis: item,
      }),
    };
  } catch (err) {
    console.log("Error fetching news:", err);
    return {
      statusCode: err.statusCode,
      headers:{
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE"
      },
      body: JSON.stringify({ error: err }),
    };
  }
};

export const showCategoryAnalysis = async (event) => {
  try {
    await verify(event);
    const id =
      event.queryStringParameters?.countryId ||
      (event.body ? JSON.parse(event.body).countryId : null);

    const result = await client.send(
      new GetCommand({
        TableName: TABLE,
        Key: { countryId: Number(id) },
      }),
    );

    var item = result.Item.categorySummery;

    return {
      statusCode: 200,
      headers:{
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE"
      },
      body: JSON.stringify({
        categoryAnalysis: item,
      }),
    };
  } catch (err) {
    console.log("Error fetching news:", err);
    return {
      statusCode: err.statusCode,
      headers:{
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE"
      },
      body: JSON.stringify({ error: err }),
    };
  }
};

export const showSectorAnalysis = async (event) => {
  try {
    await verify(event);
    const id =
      event.queryStringParameters?.countryId ||
      (event.body ? JSON.parse(event.body).countryId : null);

    const result = await client.send(
      new GetCommand({
        TableName: TABLE,
        Key: { countryId: Number(id) },
      }),
    );

    var item = result.Item.sectorSummery;

    return {
      statusCode: 200,
      headers:{
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE"
      },
      body: JSON.stringify({
        sectorAnalysis: item,
      }),
    };
  } catch (err) {
    console.log("Error fetching news:", err);
    return {
      statusCode: err.statusCode,
      headers:{
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE"
      },
      body: JSON.stringify({ error: err }),
    };
  }
};

export const showStockAnalysis = async (event) => {
  try {
    await verify(event);
    const id =
      event.queryStringParameters?.countryId ||
      (event.body ? JSON.parse(event.body).countryId : null);

    const result = await client.send(
      new GetCommand({
        TableName: TABLE,
        Key: { countryId: Number(id) },
      }),
    );

    var item = result.Item.stockName;

    return {
      statusCode: 200,
      headers:{
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE"
      },
      body: JSON.stringify({
        stockAnalysis: item,
      }),
    };
  } catch (err) {
    console.log("Error fetching news:", err);
    return {
      statusCode: err.statusCode,
      headers:{
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE"
      },
      body: JSON.stringify({ error: err }),
    };
  }
};
