# Using SeaLights Test Optimization with Robot framework

This is a demonstration of applying SeaLights with Test Optimization to tests in the Robot framework (Python).

>For more information about Robot Framework Interfaces, please refer to the official documentation: [Robot Framework User Guide](https://robotframework.org/robotframework/latest/RobotFrameworkUserGuide.html#listener-interface)

## SeaLights integration

The SeaLights integration is implemented in the file `SLListener.py`. It provides an implementation of Robot's
Listener interface to facilitate calls to SeaLights API at appropriate phases of the test suite's lifecycle:
- `start_suite` -- here we do two things:
  - initialize the test session so that all the tests can be identified by SeaLights as being part of the same session 
  - request the list of tests to be executed from SeaLights and narrow the test suite to only them
- `end_suite` -- here we do two things: 
  - we collect and report test results including start and end time to SeaLights
  - close the test session

## Using the SeaLights Listener 

The listener is taken into use from the command line with the `--listener` option so that the name of the listener is given to it as an argument. Additional command arguments are specified after the listener name (or path) using a colon (`:`) as a separator like `--listener “SLListener.py:<CustomerDomain>:<Token>:<buildSessionId>:<Test Stage Name>:<LabId>"`
* Customer Domain URL
* Token
* buildSessionId
* Test Stage name
* (Optional) LabId

## Running the example with SeaLights

To apply the listener to tests use the following command:
```
robot --listener "SLListener.py:your-domain.sealights.co:${SL_TOKEN}:${SL_BUILD_SESSION_ID}:Robot Tests:${SL_LAB_ID}" some_tests.robot
```
or 
```
robot --listener "SLListener.py:your-domain.sealights.co:`cat sltoken.txt`:`cat buildSessionId.txt`:Robot Tests" some_tests.robot
```

The `SLListener`'s constructor requires the SeaLights token and build session id, in the above command it is assumed
that these values can be found in files `sltoken.txt` and `buildSessionId.txt`.
