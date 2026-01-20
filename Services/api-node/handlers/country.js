// Import your centralized DynamoDB client
const { client } = require("../db/dynamo.client");
const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { verify } = require("../Common/auth.middleware");

// Table name from environment variable
const TABLE = process.env.CountryTable;

exports.get = async (event) => {
  try {
    await verify(event);
    const result = await client.send(new ScanCommand({ TableName: TABLE }));
    return {
      statusCode: 200,
      body: JSON.stringify({
        countries: result.Items.sort((a, b) => a.countryId - b.countryId),
      }),
    };
  } catch (err) {
    console.log("Error fetching countries:", err);
    return {
      statusCode: err.statusCode,
      body: JSON.stringify({ error: err }),
    };
  }
};
