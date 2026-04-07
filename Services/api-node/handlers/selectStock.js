import { client } from "../db/dynamo.client.js";
import { ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { verify } from "../Common/auth.middleware.js";

//SELECTING STOCKS USING DATABASE BEFORE MARKET OPENS