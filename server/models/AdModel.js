// models/AdModel.js
const {
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  BatchGetCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");

const { dynamoDb } = require("../middleware/awsClients");
const tableName = process.env.DYNAMODB_TABLE_ADS;

const AdModel = {
  // Function to retrieve an ad by adId
  getAdById: async (adId) => {
    try {
      console.log(
        `Fetching Ad with adId: ${adId}, type of adId: ${typeof adId}`,
      );
      // Define the key for the GetCommand
      const key = {
        adId: adId, // Ensure this matches your DynamoDB key schema exactly
      };

      console.log(
        `Using key for GetCommand in Ads table: ${JSON.stringify(key)}`,
      );
      // Use the GetCommand to fetch the Ad from DynamoDB
      const adResult = await dynamoDb.send(
        new GetCommand({
          TableName: process.env.DYNAMODB_TABLE_ADS,
          Key: key,
        }),
      );
      // Check if the Ad was found
      if (!adResult.Item) {
        console.error(`No Ad found with adId: ${adId}`);
        return null; // Ad not found
      }

      console.log(`Fetched Ad details: ${JSON.stringify(adResult.Item)}`);
      return adResult.Item;
    } catch (error) {
      console.error(`Error fetching Ad with adId: ${adId}`, error);
      throw error; // Rethrow the error to be handled by the caller
    }
  },

  // Function to retrieve all ads
  getAdsByIds: async (adIds) => {
    if (!adIds || adIds.length === 0) {
      return [];
    }

    try {
      const keys = adIds.map((adId) => ({ adId }));

      const params = {
        RequestItems: {
          [process.env.DYNAMODB_TABLE_ADS]: {
            Keys: keys,
          },
        },
      };

      const command = new BatchGetCommand(params);
      const response = await dynamoDb.send(command);

      const ads = response.Responses[process.env.DYNAMODB_TABLE_ADS];
      return ads || [];
    } catch (error) {
      console.error(`Error fetching ads by adIds: ${adIds}`, error);
      throw error;
    }
  },

  // Function to save or update an ad using adId
  saveAd: async (ad) => {
    console.log(`Saving/Updating Ad with adId: ${ad.adId}`);
    // Define the parameters for the UpdateCommand
    const params = {
      TableName: process.env.DYNAMODB_TABLE_ADS,
      Key: { adId: ad.adId }, // Use 'adId' instead of 'id'
      UpdateExpression: `
      SET 
        #type = :type, 
        #content = :content, 
        #styles = :styles, 
        #updatedAt = :updatedAt, 
        #createdAt = if_not_exists(#createdAt, :createdAt)
    `,
      ExpressionAttributeNames: {
        "#type": "type",
        "#content": "content",
        "#styles": "styles",
        "#updatedAt": "updatedAt",
        "#createdAt": "createdAt",
      },
      ExpressionAttributeValues: {
        ":type": ad.type,
        ":content": ad.content,
        ":styles": ad.styles || {}, // Default to an empty object if styles are not provided
        ":updatedAt": new Date().toISOString(),
        ":createdAt": ad.createdAt || new Date().toISOString(),
      },
    };

    try {
      // Use the UpdateCommand to save or update the Ad in DynamoDB
      const command = new UpdateCommand(params);
      const result = await dynamoDb.send(command);
      console.log(`Ad ${ad.adId} saved/updated successfully.`);
      return result;
    } catch (error) {
      console.error(`Error saving/updating Ad with adId: ${ad.adId}`, error);
      throw error;
    }
  },

  // Function to update an ad explicitly
  updateAd: async (ad) => {
    console.log(`Explicitly updating Ad with adId: ${ad.adId}`);
    // Define the parameters for the UpdateCommand
    const params = {
      TableName: process.env.DYNAMODB_TABLE_ADS,
      Key: { adId: ad.adId }, // Use 'adId' instead of 'id'
      UpdateExpression: `
        SET 
          #type = :type, 
          #content = :content, 
          #styles = :styles, 
          #updatedAt = :updatedAt
      `,
      ExpressionAttributeNames: {
        "#type": "type",
        "#content": "content",
        "#styles": "styles",
        "#updatedAt": "updatedAt",
      },
      ExpressionAttributeValues: {
        ":type": ad.type,
        ":content": ad.content,
        ":styles": ad.styles,
        ":updatedAt": new Date().toISOString(),
      },
    };
    // Use the UpdateCommand to explicitly update the Ad in DynamoDB
    const command = new UpdateCommand(params);
    const result = await dynamoDb.send(command);
    console.log(`Ad ${ad.adId} explicitly updated successfully.`);
    return result;
  },

  // Function to delete ad by adId
  deleteAdById: async (adId) => {
    // Define the parameters for the DeleteCommand
    const params = {
      TableName: process.env.DYNAMODB_TABLE_ADS,
      Key: { adId },
    };
    // Use the DeleteCommand to delete the Ad from DynamoDB
    const command = new DeleteCommand(params);
    try {
      await dynamoDb.send(command);
      console.log(`Ad with adId ${adId} deleted successfully.`);
    } catch (error) {
      console.error(`Error deleting ad with adId ${adId}:`, error);
      throw error;
    }
  },

  // Function to fetch all ads
  getAllAds: async () => {
    try {
      console.log("Fetching all ads from the DynamoDB table.");
      const tableName = process.env.DYNAMODB_TABLE_ADS;

      if (!tableName) {
        throw new Error("DYNAMODB_TABLE_ADS environment variable is not set.");
      }

      console.log("Using DynamoDB Table Name:", tableName);

      // Perform the scan
      const command = new ScanCommand({
        TableName: tableName,
      });

      const response = await dynamoDb.send(command);
      console.log("ScanCommand Response:", JSON.stringify(response, null, 2));

      // Return items directly since they are plain JavaScript objects
      const ads = response.Items || [];
      console.log(`Successfully fetched ${ads.length} ads.`);
      return ads;
    } catch (error) {
      console.error("Error fetching all ads:", error.message);
      throw error; // Propagate the error
    }
  },
};

module.exports = AdModel;
