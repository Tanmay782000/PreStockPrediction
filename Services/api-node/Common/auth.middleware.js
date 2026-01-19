const jwt = require("jsonwebtoken");
const { GetCommand } = require("@aws-sdk/lib-dynamodb");
const { client } = require("../db/dynamo.client");

const TABLE = process.env.TokenHistoryTable;
const JWT_SECRET = process.env.JWT_SECRET;

module.exports.verify = async (event) => {
  const authHeader = event.headers.Authorization || event.headers.authorization;
  if (!authHeader) throw "Missing token";

  const token = authHeader.replace("Bearer ", "");

  // verify JWT signature
  const decoded = jwt.verify(token, JWT_SECRET);
 

  console.log("Decoded token:", decoded);
  console.log("TABLE:", TABLE);
  // check token exists in DB
  const res = await client.send(new GetCommand({
    TableName: TABLE,
    Key: { username: decoded.username }
  }));

  if (!res.Item || res.Item.token !== token) {
    throw "Invalid token";
  }

  return decoded; // return user info
};