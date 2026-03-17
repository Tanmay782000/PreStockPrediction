import https from "https";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { client } from "../db/dynamo.client.js";
import { getAnalysis } from "./marketAnalysis.js";

const lambdaClient = new LambdaClient({ region: "ap-south-1" });

const CountryTable = process.env.CountryTable;
const TermTable = process.env.StockTermTable;
const CategoryTable = process.env.CategoryTable;
const SectorTable = process.env.SectorDetailsTable;

async function ExecuteLambda() {
  const command = new InvokeCommand({
    FunctionName: "SP-Node-Lambda-Functions-dev-getNews",
    InvocationType: "RequestResponse",
  });
  const response = await lambdaClient.send(command);
  const result = JSON.parse(Buffer.from(response.Payload).toString());
  console.log("Response from second lambda:", result);
  return result;
}

async function ExecuteMarketInsights(countryId, inputData) {
  //get country list
  var countryList = await client.send(
    new ScanCommand({ TableName: CountryTable }),
  ); //{id, countryName}
  countryList = (countryList.Items || [])
    .filter((c) => c.countryId == countryId)
    .map((c) => ({ countryId: c.countryId, countryName: c.countryName }));
  // console.log("countryList", JSON.stringify(countryList));

  //get term list
  var termList = await client.send(new ScanCommand({ TableName: TermTable })); //{termId, termName}
  termList = (termList.Items || []).map((t) => ({
    termId: t.termId,
    termName: t.termName,
    researchInsight: t.researchInsight,
  }));
  // console.log("termlist", JSON.stringify(termList));

  //get category list
  var categoryList = await client.send(
    new ScanCommand({ TableName: CategoryTable }),
  ); //{categoryId, categoryName}
  categoryList = (categoryList.Items || [])
    .filter((x) => x.countryId == countryId)
    .map((c) => ({
      categoryId: c.stockCategoryId,
      countryId: c.countryId,
      categoryName: c.stockCategory,
    }));
  // console.log("categorylist", JSON.stringify(categoryList));

  //get sector list
  var sectorList = await client.send(
    new ScanCommand({ TableName: SectorTable }),
  ); //{sectorId, sectorName}
  // console.log("sector", JSON.stringify(sectorList));

  if ([inputData, termList, categoryList, sectorList].every((v) => v != null)) {
    const result = await getAnalysis({
      countryId,
      inputData,
      termList,
      categoryList,
      sectorList,
    });
    console.log("good it's not null");
    // const payload = {
    //   countryId,
    //   inputData,
    //   termList,
    //   categoryList,
    //   sectorList,
    // };
    // const command = new InvokeCommand({
    //   FunctionName: "SP-Node-Lambda-Functions-dev-getmarketAnalysis",
    //   InvocationType: "RequestResponse",
    //   Payload: Buffer.from(JSON.stringify(payload)),
    // });
    // const response = await lambdaClient.send(command);
    // const result = JSON.parse(Buffer.from(response.Payload).toString());
    // console.log("Response from analysis lambda:");
    if (result != null) {
      return { statusCode: 200, body: "Successfully get the response." };
    }
    return { statusCode: 500, body: "Something went wrong" };
  }

  return finalArray;
}

export const main = async () => {
  try {
    const getNews = await ExecuteLambda();
    console.log("body here", getNews.body);
    var data = JSON.parse(getNews.body);
    console.log("data.countrynews", data.countrynews);
    for (const [countryId, articles] of Object.entries(data.countrynews)) {
      console.log("cid", countryId);
      if (countryId == 1 || countryId == "1") {
        const data = await ExecuteMarketInsights(countryId, articles);
        if (data != null) {
          return {
            statusCode: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Headers": "Content-Type,Authorization",
              "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
            },
            body: "Getting data successfully!",
          };
        }
      }
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type,Authorization",
          "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
        },
        body: "Something Went Wrong!",
      };
    }
    console.log("data", JSON.stringify(data));
    return data;
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
      },
      body: `Catch!!, Something Went Wrong! ${err}`,
    };
  }
};
