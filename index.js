
var AWS = require('aws-sdk');
const lib = require('./lib');
const winston = require('winston');

let data;
var dynamo = new AWS.DynamoDB({apiVersion: "2012-08-10", region: 'us-east-1'})

let TABLE_NAME = "CCUserService";
  
const AccessCodes = Object.freeze({
  UNKNOWN_USER:  0,
  ALLOW:         1,
  UNAUTHORIZED:  2,
  SYSTEM_ERROR:  11
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

function isEmpty(val) {
  return val == undefined || val == null;
}

const gym_auth_is_valid = async (gym_auth) => {
  
  if (isEmpty(gym_auth)) {
    logger.info("no user info");
    return AccessCodes.UNKNOWN_USER
  }
  
  accessExpiration = gym_auth.access_expires.S;
  if (isEmpty(accessExpiration)) {
    logger.info("no expiration: " + accessExpiration);
    return AccessCodes.UNAUTHORIZED;
  }
  
  let today = new Date().toISOString().substring(0, 10);

  if (accessExpiration >= today) {
    return AccessCodes.ALLOW;
  } else {
    logger.info("owes money: " + accessExpiration + " is before " + today);
    return AccessCodes.UNAUTHORIZED; // owes money
  }
}

const is_authorized = async (user_id, gym_id) => {

  // let encoded_user_id = encodeURIComponent(user_id);
  let PK = "USER#" + user_id;
  let SK = "GYM#" + gym_id;
  req_params = {
    TableName: TABLE_NAME,
    Key: {
      PK: {"S": PK},
      SK: {"S": SK}
    }
  }
  return await dynamo.getItem(req_params, function(e, data) {
    if (e) {
      logger.error("dynamo get_item error: " + e);
      return AccessCodes.SYSTEM_ERROR;
    } else {
      logger.debug("dynamo get_item success: " + data.Item);
      // logic for testing 
      return gym_auth_is_valid(data.Item);
    }
  }).promise();
}

module.exports.handler = async (event, context, callback) => {
  try {
    logger.debug("start of function");

    var user_id;
    try {
      data = await lib.authenticate(event);
      user_id = data.email;
    } catch (e) {
      logger.error("error inside authentication flow", e);
      return context.fail("Authentication failure: invalid auth token");
    }
    logger.info("authentication complete for " + user_id);
    
    // query dynamo userService
    access_level = await is_authorized(user_id, 1); // TODO: dynamic gym_id
    
    if (access_level == AccessCodes.ALLOW) {
      logger.info("user authorized");
      return data;
    } else if (access_level == AccessCodes.SYSTEM_ERROR) {
      return context.fail("There was a system error: 105");
    } else {
      return context.fail("User not authorized for this gym");
    }
  }
  catch (err) {
      logger.error(err);
      return context.fail("There was a system error: 112");
  }
};
