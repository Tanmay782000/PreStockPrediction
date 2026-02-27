// Import your centralized DynamoDB client
const { client } = require("../db/dynamo.client");
const { ScanCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { verify } = require("../Common/auth.middleware");

// Table name from environment variable
const TABLE = process.env.CountryTable;

exports.get = async (event) => {
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
        countries: result.Items.sort((a, b) => a.countryId - b.countryId),
      }),
    };
  } catch (err) {
    console.log("Error fetching countries:", err);
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

exports.getCountry = async (event) => {
  try {
    await verify(event);
    const id =
      event.queryStringParameters?.countryId ||
      (event.body ? JSON.parse(event.body).countryId : null);

    console.log("Fetching country with id:", id);

    const result = await client.send(
      new GetCommand({
        TableName: TABLE,
        Key: { countryId: Number(id) },
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
        country: result.Item,
      }),
    };
  } catch (err) {
    console.log("Error fetching country:", err);
    return { statusCode: err.statusCode, headers:{
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE"
      }, body: JSON.stringify({ error: err }) };
  }
};
