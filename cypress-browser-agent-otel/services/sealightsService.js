const axios = require("axios").default;

const service = {
  apiToken: null,
  baseUrl: null,
  buildSessionId: null,
  testSessionsV1Instance: null,
  testSessionsV2Instance: null,
};

module.exports = {
  setConfig: (baseUrl, apiToken, buildSessionId) => {
    service.baseUrl = baseUrl;
    service.apiToken = apiToken;
    service.buildSessionId = buildSessionId;
    module.exports.createInstanceV1();
    module.exports.createInstanceV2();
  },
  createInstanceV1: () => {
    service.testSessionsV1Instance = axios.create({
      baseURL: service.baseUrl.replace("/api", "/sl-api/v1/test-sessions"),
      headers: {
        Authorization: `Bearer ${service.apiToken}`,
      },
    });
  },
  createInstanceV2: () => {
    service.testSessionsV2Instance = axios.create({
      baseURL: service.baseUrl.replace("/api", "/sl-api/v2/test-sessions"),
      headers: {
        Authorization: `Bearer ${service.apiToken}`,
      },
    });
  },
  createTestSession: async () => {
    const { data } = await service.testSessionsV1Instance.post("/", {
      testStage: "Cypress Tests",
      bsid: service.buildSessionId,
    });
    return data;
  },
  endTestSession: (testSessionId) => {
    return service.testSessionsV1Instance.delete(`/${testSessionId}`);
  },
  sendTestEvent: (testSessionId, name, start, end, status) => {
    return service.testSessionsV2Instance.post(`/${testSessionId}`, [
      {
        name,
        start,
        end,
        status,
      },
    ]);
  },
};
