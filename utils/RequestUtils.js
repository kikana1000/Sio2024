require("dotenv").config();
const moment = require("moment");
const fetch = require("isomorphic-fetch");

const URL = `${process.env.base_url}/api`;

const headers = {
    "Content-Type": "application/vnd.api+json",
    "Accept": "application/json",
    "Authorization": `Bearer ${process.env.access_token}`
}

/**
 * Function to make requests to the TOCOline API
 * 
 * @param {String} endpoint route to be requested (format: '/<route>')
 * @param {String} method method to be used (format: 'GET', 'POST', 'PATCH', 'DELETE')
 * @param {Object} body data to be sent (format: {<key>: <value>})
 * 
 * @returns data from the request JSON format
 */
async function TOC_request(endpoint, method, body={}) {

    console.log(
        `[${moment(Date.now()).format("DD/MM/YYYY HH:mm:SS")}] ${method} ${endpoint}`
      );

    let response;

    if (method === "GET") {
        response = await fetch(`${URL}${endpoint}`, {
            method: method,
            headers: headers
        })
    }

    if (method === "POST") {
        response = await fetch(`${URL}${endpoint}`, {
            method: method,
            headers: headers,
            body: body
        })
    }

    if (method === "PATCH") {
        response = await fetch(`${URL}${endpoint}`, {
            method: method,
            headers: headers,
            body: body
        })
    }

    if (method === "DELETE") {
        response = await fetch(`${URL}${endpoint}`, {
            method: method,
            headers: headers
        })
    }
    
    console.log(response.status, response.statusText)
   
    response_json = await response.json();
    //console.log(response_json)

    return response_json;

}

module.exports = {
    TOC_request
}