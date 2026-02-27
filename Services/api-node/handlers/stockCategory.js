// Import your centralized DynamoDB client
const { client } = require("../db/dynamo.client");
const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { verify } = require("../Common/auth.middleware");

// Table name from environment variable
const TABLE = process.env.StockTermTable;

exports.get = async (event) => {
  try {
    await verify(event);
    const id =
      event.queryStringParameters?.id ||
      (event.body ? JSON.parse(event.body).id : null);

    console.log("Fetching stock terms with id:", id);
    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "id parameter is required" }),
      };
    }
    const result = await client.send(
      new ScanCommand({
        TableName: TABLE,
        Key: { countryId: id },
      }),
    );

    return {
      statusCode: 200,
      headers:{
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE"
      },
      body: JSON.stringify({
        stockTerms: result.Items.sort(
          (a, b) => a.stockCategoryId - b.stockCategoryId,
        ),
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
