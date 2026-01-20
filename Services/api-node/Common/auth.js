const jwt = require("jsonwebtoken");
const { PutCommand } = require("@aws-sdk/lib-dynamodb");
const { client } = require("../db/dynamo.client");
const { v4: uuid4 } = require('uuid');
const TABLE = process.env.TokenHistoryTable;
const JWT_SECRET = process.env.JWT_SECRET;

module.exports.tokengeneration = async (event) => {
  const body = event.body ? JSON.parse(event.body) : {};
  const username = body.username;
  console.log(body);
  if (!username) {
    return { statusCode: 400, body: "username required" };
  }
  console.log(username);
  // create token
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1h" });
  const tokenId = uuid4(); 

  // store token
  await client.send(new PutCommand({
    TableName: TABLE,
    Item: {
      tokenId,
      username,
      token,
      createdDate: Date.now().toString()
    }
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({ token })
  };
};
