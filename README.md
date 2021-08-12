# SeaLights Integration Examples

## SeaLights back-end API

Running tests with SeaLights custom integration requires several steps:
- initialization of a test session
- reporting executed tests to SeaLights
- closing the test session

Each of these steps is done by calling an appropriate SeaLights endpoint. See the
[full API documentation](https://sealights.atlassian.net/wiki/spaces/DEV/pages/2272493579/Test+Session+API) for details. 

Below is an overview of these steps, refer specific examples for solution details (list of the examples is at the bottom).

### Test session
All the tests are reported within the context of a given test session. To create a test sessions send a `POST` request to the endpoint:
```
/sl-api/v1/test-sessions
```

The request body:
```
{
    "labId": "lab id",
    "testStage": "test stage",
    "buildSessionId": "build session id"
}
```
It is up to you to provide a `labId` and `testStage`, the names should reflect the actual environment and the type of tests,
e.g. `Unit Tests`, `Integrations Tests` etc. The `buildSessionId` has to be obtained separately.

The response contains the `testSessionId` field. Use this id to report tests for the given test session.

For proper integration the test session has to be closed after all tests have been executed. To close a test session
send a `DELETE` request to endpoint:
```
/sl-api/v1/test-sessions/{test-session-id}
```

### Reporting test results
After a test (or possibly multiple tests) execution reporting the results is done via the test session endpoint by 
posting an array of result elements.

The endpoints URL is:
```
/sl-api/v1/test-sessions/{test-session-id}
```

The payload is an array of results:
```
[
  {
    "name": "the test's name, by which it'll be identified in SeaLights",
    "status": "the test result status which is one of the following strings: 'passed', 'failed', 'skipped'",
    "start": "the Unix Epoch timestamp (current millis) of the test's start",
    "end": "the Unix Epoch timestamp (current millis) of the test's end",
  },
  ...
]
```

### Test Optimization

In addition to reporting tests, the SeaLights back-end API allows also to use the powerful Test Optimization feature.
To obtain a list of excluded tests send a `GET` request to
```
/sl-api/v1/test-sessions/{test-session-id}/exclude-tests
```


## Examples

This repository contains the following SeaLights integration code examples:

- Robot custom integration with Test Optimization (in dir `robot-custom-integration`)
