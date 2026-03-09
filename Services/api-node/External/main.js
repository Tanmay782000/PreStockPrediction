const https = require("https");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { client } = require("../db/dynamo.client");
const lambdaClient = new LambdaClient({ region: "ap-south-1" });
const { ScanCommand } = require("@aws-sdk/lib-dynamodb");

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

async function ExecuteMarketInsights(countryId, articles) {
  //get country list
  var countryList = await client.send(
    new ScanCommand({ TableName: CountryTable }),
  ); //{id, countryName}
  countryList = (countryList.Items || [])
    .filter((c) => c.countryId == countryId)
    .map((c) => ({ countryId: c.countryId, countryName: c.countryName }));
  console.log("countryList", JSON.stringify(countryList));

  //get term list
  var termList = await client.send(new ScanCommand({ TableName: TermTable })); //{termId, termName}
  termList = (termList.Items || []).map((t) => ({
    termId: t.termId,
    termName: t.termName,
    researchInsight: t.researchInsight,
  }));
  console.log("termlist", JSON.stringify(termList));

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
  console.log("categorylist", JSON.stringify(categoryList));

  //get sector list
  var sectorList = await client.send(
    new ScanCommand({ TableName: SectorTable }),
  ); //{sectorId, sectorName}
  console.log("sector", JSON.stringify(sectorList));

  const finalArray = [countryList, termList, categoryList, sectorList];
  return finalArray;
}

exports.main = async () => {
  try {
    const getNews = await ExecuteLambda();
    console.log(getNews.body);
    var data = JSON.parse(getNews.body);
      for (const [countryId, articles] of Object.entries(data)) {
        console.log("cid", countryId);
        if (countryId == 1 || countryId == "1") {
          const data = await ExecuteMarketInsights(countryId, articles);
          return data;
        }
        return data;
    }
    console.log("data",JSON.stringify(data));
    return data;
  } catch (err) {
    console.log(err);
  }
};
