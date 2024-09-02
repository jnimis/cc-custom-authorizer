
var AWS = require('aws-sdk');
const lib = require('./lib');
let data;
var ssm = new AWS.SSM({region: 'us-east-1'});
  
const AccessCodes = Object.freeze({
  UNKNOWN_USER:  0,
  ALLOW:         1,
  UNAUTHORIZED:  2,
  SYSTEM_ERROR:  11
});

const get_admin_api_token = async () => {
  console.log("initialized ssm");
  var params = {
    Name: "/cornercam/auth0-admin-api-key",
    WithDecryption: true
  }
  try {
    const ssmResponse = await ssm.getParameter(params).promise()
    return ssmResponse.Parameter.Value;
  } catch(error) {
    console.log(error);
    return undefined;
  }
}

const is_authorized = async (user_id, gym_id) => {

  let admin_api_token = await get_admin_api_token();
  if (!admin_api_token) {
    console.log("is_authorized function detected undefined token");
    return false;
  }
  console.log("got admin api token");
  
  let encoded_user_id = encodeURIComponent(user_id);
  var myHeaders = new Headers();
  myHeaders.append("Accept", "application/json");
  myHeaders.append("Authorization", "Bearer " + admin_api_token);

  var requestOptions = {
    method: 'GET',
    headers: myHeaders,
    redirect: 'follow'
  };

  let err = await fetch("https://onemanband.auth0.com/api/v2/users?q=user_id%3A" + encoded_user_id, requestOptions)
    .then(response => response.text())
    .then(result => {
      console.log(result);
      let resultObj = JSON.parse(result);
      if (resultObj.statusCode == 401) {
        return "exception: invalid auth0 api key";
      }
      let metadataObj = JSON.parse(result)[0].app_metadata;
      if (!metadataObj) {
        return "no metadata for user " + user_id;
      }
      let access_level = metadataObj["gym_" + gym_id];
      if (!access_level) {
        return "user has not tried to register at this gym";
      }
      if (access_level < 1) {
        return "user has gym record but is not authorized";
      } else {
        return "";
      }
    })
    .catch(error => {
      return "exception: " + error;
    });
    console.log(err);
    if (err == "") {
      return ["authorized", AccessCodes.ALLOW];
    } else if (err.startsWith("exception")) {
      return ["system error", AccessCodes.SYSTEM_ERROR];
    } else {
      return [err, AccessCodes.UNAUTHORIZED];
    }
}

module.exports.handler = async (event, context, callback) => {
  try {
    console.log("start of function");

    var user_id;
    try { 
      data = await lib.authenticate(event);
      user_id = data.principalId;
      console.log("user id is " + user_id);
    } catch (e) {
      console.log("error inside authentication flow", e);
      return context.fail("Authentication failure: invalid auth token");
    }
    console.log("authentication complete");
    
    // get metadata from auth0
    const [message, access_level] = await is_authorized(user_id, 1); // "google-oauth2|106647354996701306231"
    console.log(message);
    if (access_level == AccessCodes.ALLOW) {
      return data;
    } else if (access_level == AccessCodes.SYSTEM_ERROR) {
      return context.fail("There was a system error: 105");
    } else {
      return context.fail("User not authorized for this gym");
    }
  }
  catch (err) {
      console.log(err);
      return context.fail("There was a system error: 112");
  }
};
