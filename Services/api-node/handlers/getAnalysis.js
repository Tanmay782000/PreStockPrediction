const { client } = require("../db/dynamo.client");
const { ScanCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { verify } = require("../Common/auth.middleware");

// Table name from environment variable
const TABLE = process.env.FilteredNews;

exports.showTermAnalysis = async (event) => {
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

exports.showCategoryAnalysis = async (event) => {
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

exports.showSectorAnalysis = async (event) => {
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

exports.showStockAnalysis = async (event) => {
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
