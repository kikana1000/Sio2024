require("dotenv").config();
const moment = require("moment");

// dependencies
const fetch = require("isomorphic-fetch");
const qs = require("qs");
const fs = require("fs");

const URL = `${process.env.base_url_oauth}/auth?client_id=${process.env.client_id}&redirect_uri=${process.env.redirect_uri_oauth}&response_type=code&scope=commercial`;

async function collectToken() {
  //#region 1. GET autorization_code
  const intial_request = await fetch(URL, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    redirect: "manual",
  });

  console.log(
    `[${moment(Date.now()).format("DD/MM/YYYY HH:mm:SS")}]` +
    " GET autorization_code"
  );
  console.log(intial_request.status, intial_request.statusText);

  const location = intial_request.headers.get("location");
  const regex = /(?<=code=)\w+[^&]/;
  const authorization_code = location.match(regex)[0];

  process.env.authorization_code = authorization_code;
  console.log({ authorization_code: authorization_code });

  let authorization_code_str = String(authorization_code);
  await storeData("authorization_code", authorization_code_str);
  //#endregion

  //#region 2. POST access_token
  encoded_basic = Buffer.from(
    `${process.env.client_id}:${process.env.client_secret}`
  ).toString("base64");

  params = {
    grant_type: "authorization_code",
    code: authorization_code,
    scope: "commercial",
  };

  const access_token_request = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${encoded_basic}`,
    },
    body: qs.stringify(params),
  });

  const access_token = await access_token_request.json();

  console.log(
    `[${moment(Date.now()).format("DD/MM/YYYY HH:mm:SS")}]` +
    " POST access_token"
  );
  console.log(intial_request.status, intial_request.statusText);

  console.log({
    access_token: access_token.access_token,
    refresh_token: access_token.refresh_token,
  });

  let token = String(access_token.access_token);
  await storeData("access_token", token);
  let refresh_token = String(access_token.refresh_token);
  await storeData("refresh_token", refresh_token);

  //#endregion
}

async function updateToken() {
  params = {
    grant_type: "refresh_token",
    refresh_token: process.env.refresh_token,
    scope: "commercial",
  };

  encoded_basic = Buffer.from(
    `${process.env.client_id}:${process.env.client_secret}`
  ).toString("base64");

  const refresh_token_request = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      Authorization: `Basic ${encoded_basic}`,
    },
    body: qs.stringify(params),
  });

  const access_token = await refresh_token_request.json();

  console.log(
    `[${moment(Date.now()).format("DD/MM/YYYY HH:mm:SS")}]` +
    " POST refresh_token"
  );
  console.log({
    access_token: access_token.access_token,
    refresh_token: access_token.refresh_token,
  });

  let token = String(access_token.access_token);
  await storeData("access_token", token);
  let refresh_token = String(access_token.refresh_token);
  await storeData("refresh_token", refresh_token);
}

async function storeData(type, data) {
  try {
    const envData = await fs.promises.readFile(".env", "utf8");
    const lines = envData.split("\n");

    let updatedLines = [];

    let typeExists = false;
    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine && !trimmedLine.startsWith("#")) {
        const [key, value] = trimmedLine.split("=");

        if (key.trim() === type) {
          updatedLines.push(`${type}="${data.trim()}"`);
          typeExists = true;
        } else {
          updatedLines.push(line);
        }
      } else {
        updatedLines.push(line);
      }
    }

    if (!typeExists) {
      updatedLines.push(`${type}="${data.trim()}"`);
    }

    const updatedEnvData = updatedLines.join("\n");
    await fs.promises.writeFile(".env", updatedEnvData, "utf8");
    console.log(`A variável ${type} foi atualizada com sucesso`);
  } catch (error) {
    console.error(
      "Ocorreu um erro ao atualizar as variáveis do arquivo .env:",
      error
    );
  }
}

module.exports = {
  collect: collectToken,
  update: updateToken,
};
