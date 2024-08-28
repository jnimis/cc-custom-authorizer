
var AWS = require('aws-sdk');
const lib = require('./lib');
let data;

const get_admin_api_token = async () => {
  var ssm = new AWS.SSM({region: 'us-east-1'});
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

  await fetch("https://onemanband.auth0.com/api/v2/users?q=user_id%3A" + encoded_user_id, requestOptions)
    .then(response => response.text())
    .then(result => {
      console.log("fetch user result: " + result);
      if (result.statusCode == 200) {
        // get gym_id and check against actual id
      } else {
        return false;
      }
    })
    .catch(error => console.log("fetch user error", error));
}

module.exports.handler = async (event, context, callback) => {
  try {
    console.log("start of function");

    data = await lib.authenticate(event);
    console.log("authenticate complete");
    
    // get metadata from auth0
    let user_id = data.principalId;
    console.log("user id is " + user_id);
    if (await is_authorized(user_id, 1)) {
      return data;
    } else {
      return context.fail("User not authorized for this gym");
    }
  }
  catch (err) {
      console.log(err);
      return context.fail("Unauthorized");
  }
};
