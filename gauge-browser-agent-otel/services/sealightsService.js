const axios = require("axios");
const jwtDecode = require("jwt-decode");
const fs = require("fs");

const apiToken = fs.readFileSync(`${__dirname}/../sltoken.txt`, "utf-8");
const bsid = fs.readFileSync(`${__dirname}/../buildSessionId`, "utf-8");

const decoded = jwtDecode(apiToken); // Agent Token
const baseUrl = decoded["x-sl-server"]; // Base url of the backend

const http = axios.create({
  baseURL: baseUrl.replace("/api", "/sl-api/v1/test-sessions"),
  headers: {
    Authorization: `Bearer ${apiToken}`,
  },
});

const httpv2 = axios.create({
  baseURL: baseUrl.replace("/api", "/sl-api/v2/test-sessions"),
  headers: {
    Authorization: `Bearer ${apiToken}`,
  },
});

module.exports = {
  createTestSession: () => {
    return http.post("/", {
      testStage: "Gauge Tests",
      bsid,
    });
  },
  endTestSession: (testSessionId) => {
    return http.delete(`/${testSessionId}`);
  },
  sendTestEvent: (testSessionId, name, start, end, status) => {
    return httpv2.post(`/${testSessionId}`, [
      {
        name,
        start,
        end,
        status,
      },
    ]);
  },
};
