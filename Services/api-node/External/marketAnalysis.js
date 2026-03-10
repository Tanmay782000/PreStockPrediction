const {
  BedrockRuntimeClient,
  InvokeModelCommand,
} = require("@aws-sdk/client-bedrock-runtime");
const { PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { client } = require("../db/dynamo.client");
const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });

exports.get = async (event) => {
  const Filtered_News = process.env.FilteredNews;
  const countryId = event.countryId;
  const inputarray = event.inputData;
  const termList = event.termList;
  const categoryList = event.categoryList;
  const sectorList = event.sectorList;
  console.log("get the term list", termList);

  const prompt = `
##Global News_Array : ${JSON.stringify(inputarray, null, 2)}
##In Global News Array Convert seendate with UTC to IST

##GLOBAL OUTPUT FORMAT: results of all sections
[Section1:
{
  "probabilityArr": probabilityArr,
  "summary": SUMMARY,
},
Section2:
{
  "probabilityArr": probabilityArr,
  "summary": SUMMARY,
},
Section3:
{
  "probabilityArr": probabilityArr,
  "summary": SUMMARY,
}]

##GLOBAL OUTPUT RULES:
-> Return ONLY valid JSON.
-> No explanations outside JSON.

1. Section-1 [Term Analysis]
#INPUTS:-
Terms List: ${JSON.stringify(termList, null, 2)}

#INSTRUCTION:-
Analyze the input data and determine the best term from ${termList}.(focus more on recent news based on date and time)
and another important thing is we are predicting the future of terms so consider the news and data behaviour as per current time and give more weightage to recent news and date for prediction.

#probabilityArr(array variable):-
Contains probability of profit based on news sentiments and do the ranking based 
on sequence of terms id in above lise with asc. give each term out of 100.
FORMAT:[{TermName:Probability}]

#Summery(variable):-
Explain reasoning of Terms based on news insights in 30 - 40 lines.[IMPORTANT]

#OUTPUT FORMAT[Array Object]:-
{
  "probabilityArr": probabilityArr,
  "summary": SUMMARY,
}
#End section


2. Section-2 [Category Analysis]
#INPUTS:-
Category List:  ${JSON.stringify(categoryList, null, 2)}

#INSTRUCTION:- 
Analyze the input data and determine the BEST stock category from ${categoryList}.(focus more on recent news based on date and time)
and another important thing is we are predicting the future of category so consider the news and data behaviour as per current time and give more weightage to recent news and date for prediction.

#probabilityArr(array variable):-
Contains probability of profit based on news sentiments and do the ranking based 
on sequence of categoryId id in above lise with asc. give each term out of 100.
FORMAT:[{CategoryName:Probability}]

#Summery(variable):-
Explain reasoning of Categories based on news insights in 30 - 40 lines.[IMPORTANT]

#OUTPUT FORMAT[Array Object]:-
{
  "probabilityArr": probabilityArr,
  "summary": SUMMARY,
}
#End section

3. Section-3 [Sector Analysis]
#INPUTS:-
Sector List: ${JSON.stringify(sectorList, null, 2)}

#INSTRUCTION:- 
Analyze the input data and determine the BEST stock sector from ${sectorList}.(focus more on recent news based on date and time)
and another important thing is we are predicting the future of sector so consider the news and data behaviour as per current time and give more weightage to recent news and date for prediction.

#probabilityArr(array variable):-
Contains probability of profit based on news sentiments and do the ranking based 
on sequence of sectorId id in above lise with asc. give each term out of 100.
FORMAT:[{SectorName:Probability}]

#Summery(variable):-
Explain reasoning of Sectors based on news insights in 30 - 40 lines.[IMPORTANT]

#OUTPUT FORMAT[Array Object]:-
{
  "probabilityArr": probabilityArr,
  "summary": SUMMARY,
}
#End section
`;

  const command = new InvokeModelCommand({
    modelId: "anthropic.claude-3-sonnet-20240229-v1:0", // example
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 2500,
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: prompt }],
        },
      ],
    }),
  });
  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(Buffer.from(response.body).toString());
  var text = responseBody.content[0].text;
  console.log("kind of format", text);
  text = text.replace(/Section(\d+):/g, '"Section$1":');
  const finalArr = JSON.parse(text);

  var getnewsData = await client.send(
    new ScanCommand({
      TableName: Filtered_News,
      Key: { countryId: Number(countryId) },
    }),
  );

  console.log("Got the first response");

  const now = new Date().toISOString();
  let item = {
    countryId: Number(countryId),
    termSummery: finalArr[0],
    categorySummery: finalArr[1],
    sectorSummery: finalArr[2],
    stockName: getnewsData.Items[0].stockName,
    createdDate: now,
    modifiedDate: now,
  };

  console.log("logging item",item);

  await client.send(
    new PutCommand({
      TableName: Filtered_News,
      Item: item,
    }),
  );
  console.log("put completed",finalArr[0])
  return finalArr;
};
