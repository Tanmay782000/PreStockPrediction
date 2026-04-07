import { client } from "../db/dynamo.client.js";
import { ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { verify } from "../Common/auth.middleware.js";



//PLACING STOCKS USING DATABASE BEFORE MARKET OPENS
