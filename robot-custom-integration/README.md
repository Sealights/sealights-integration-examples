# Using SeaLights Test Optimization with Robot framework

This is a demonstration of applying SeaLights with Test Optimization to tests in the Robot framework (Python).

## SeaLights integration

The SeaLights integration is implemented in the file `SLListener.py`. It provides an implementation of Robot's
Listener interface to facilitate calls to SeaLights API at appropriate phases of the test suite's lifecycle:
- `start_suite` -- here we do two things:
  - initialize the test session so that all the tests can be identified by SeaLights as being part of the same session 
  - request the list of tests to be executed from SeaLights and narrow the test suite to only them 
- `end_test` -- at this point we report the executed test's result, start and end time to SeaLights 
- `end_suite` -- closing the test session

## Running the example with SeaLights

To apply the listener to tests use the following command:
```
robot --listener "SLListener.py:your-domain.sealights.co:`cat sltoken.txt`:`cat buildSessionId.txt`:Robot Tests" some_tests.robot
```

The `SLListener`'s constructor requires the SeaLights token and build session id, in the above command it is assumed
that these values can be found in files `sltoken.txt` and `buildSessionId.txt`.
