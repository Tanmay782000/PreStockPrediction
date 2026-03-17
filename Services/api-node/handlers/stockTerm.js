// Import your centralized DynamoDB client
import { client } from "../db/dynamo.client.js";
import { ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { verify } from "../Common/auth.middleware.js";

// Table name from environment variable
const TABLE = process.env.StockTermTable;

export const get = async (event) => {
  try {
    await verify(event);
    const result = await client.send(new ScanCommand({ TableName: TABLE }));
    return {
      statusCode: 200,
      headers:{
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE"
      },
      body: JSON.stringify({
        stockTerms: result.Items.sort((a, b) => a.termId - b.termId),
      }),
    };
  } catch (err) {
    console.log("Error fetching stock terms:", err);
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
