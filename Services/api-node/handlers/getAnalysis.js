import { client } from "../db/dynamo.client.js";
import { ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { verify } from "../Common/auth.middleware.js";

// Table name from environment variable
const TABLE = process.env.FilteredNews;
const TABLE2 = process.env.DeepStockAnalysis;

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
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
      },
      body: JSON.stringify({
        termAnalysis: item,
      }),
    };
  } catch (err) {
    console.log("Error fetching news:", err);
    return {
      statusCode: err.statusCode,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
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
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
      },
      body: JSON.stringify({
        categoryAnalysis: item,
      }),
    };
  } catch (err) {
    console.log("Error fetching news:", err);
    return {
      statusCode: err.statusCode,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
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
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
      },
      body: JSON.stringify({
        sectorAnalysis: item,
      }),
    };
  } catch (err) {
    console.log("Error fetching news:", err);
    return {
      statusCode: err.statusCode,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
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

    const result2 = await client.send(
      new GetCommand({
        TableName: TABLE2,
        Key: { countryId: Number(id) },
      }),
    );

    var item1 = result.Item.stockName.StocksAnalysis;
    var item2 = result2.Item.DeepAnalysis;

    const res = [];

    // create map from item2
    const map = {};
    for (const itm2 of item2) {
      map[itm2.StockId] = itm2;
    }
    console.log("map item",map);
    // merge
    for (const itm1 of item1) {
      const key = itm1.stockId;
      console.log("item1",itm1.stockId);
      console.log("item2 match",itm1);
      console.log("Matched");
      if (map[key]) {
        console.log("Not matched");
        const itm2 = map[key];

        const data = {
          ...itm1,
          Sentiment_Score: itm2.Sentiment_Score,
          Probability_of_Profit: itm2.Probability_of_Profit,
          RSI: itm2.RSI,
          Volume_Ratio: itm2.Volume_Ratio,
          Volatility_20D: itm2["Volatility_(20D)"],
          Return_5D: itm2["5-Day_Return"],
          Preffered_Days: itm2.Preffered_Days,
          Expected_Growth: itm2.Expected_Growth,
        };

        res.push(data);
      }
    }
    console.log(JSON.stringify(res));
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
      },
      body: JSON.stringify({
        stockAnalysis: res,
      }),
    };
  } catch (err) {
    console.log("Error fetching news:", err);
    return {
      statusCode: err.statusCode,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
      },
      body: JSON.stringify({ error: err }),
    };
  }
};

export const showNiftyAnalysis = async (event) => {
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

    var item = result.Item.stockName.NiftyPrediction;

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
      },
      body: JSON.stringify({
        niftyPrediction: item,
      }),
    };
  } catch (err) {
    console.log("Error fetching news:", err);
    return {
      statusCode: err.statusCode,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
      },
      body: JSON.stringify({ error: err }),
    };
  }
};
