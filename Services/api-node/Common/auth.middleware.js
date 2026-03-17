import jwt from "jsonwebtoken";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { client } from "../db/dynamo.client.js";

const TABLE = process.env.TokenHistoryTable;
const JWT_SECRET = process.env.JWT_SECRET;

export const verify = async (event) => {
  // console.log("Verifying token...", event.headers.Authorization);
  const authHeader = event.headers.Authorization || event.headers.authorization;
  // console.log("Auth Header:", authHeader);
  if (!authHeader) throw "Missing token";

  const token = authHeader.replace("Bearer ", "");

  const decoded = jwt.verify(token, JWT_SECRET);

  // console.log("Decoded token:", decoded);
  // console.log("TABLE:", TABLE);

  const res = await client.send(
    new GetCommand({
      TableName: TABLE,
      Key: { username: decoded.username },
    }),
  );

  // console.log("Token record from DB:", res.Item);
  if (!res.Item || res.Item.token !== token) {
    throw "Invalid token";
  }

  return decoded;
};
