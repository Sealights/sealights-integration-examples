# Sealights Express Example

This is a very minimal example on running an Express server in Docker with Sealights. <br>
Follow the steps bellow as they are and at the end of this example you should have collected coverage for the application in your Sealights Dashboard.

### 1. Running slnodejs configure step

First and foremost let's install the `npm` dependencies:

```
npm install
```

Now we can continue with the configuration step, for this you will need to paste your Sealights agent token into a file at the root of this project called `sltoken.txt`. After that you can continue with the bellow step:

```
npx slnodejs config --tokenfile sltoken.txt --appName "Express Sample App" --branch "master" --build 1
```

### 2. Scanning the application with Sealights

```
npx slnodejs scan --workspacepath . --tokenfile sltoken.txt --buildsessionidfile buildSessionId --scm none
```

### 3. Starting a Sealights Test Session

If we want to capture coverage we need an active test session, so let's open one:

```
npx slnodejs start --tokenfile sltoken.txt --buildsessionidfile buildSessionId --teststage "Manual Tests"
```

### 4. Running the application with the Sealights Node agent

With Docker:

```
docker build --no-cache --progress=plain -t sealights-express-app .
docker run sealights-express-app
```

Without Docker:

```
export NODE_DEBUG=sl
npx slnodejs run --tokenfile sltoken.txt --buildsessionidfile buildSessionId -- index.js
```

After this step, give the application approximately 20 seconds to generate coverage data and upload it to Sealights. Than you can exit the process (don't forget to stop the Docker container too if using Docker).

### 5. Ending the test session

After the application was running for a while and some methods were hit (for example in this application 2 methods are hit during initialization of the app itself), we need to close the test session in order to calculate the coverage:

```
npx slnodejs end --tokenfile sltoken.txt --buildsessionidfile buildSessionId
```

### 6. Verify coverage in the Sealights Dashboard

The expected outcome after this short test is having coverage percentage > 0.

## Last Notes

This is meant to be a simple test application that should be used to debug coverage issues. For example if you have your own Sealights application and you encounter an issue, you can always try to run this example in order to understand if there are onboarding/configuration issues with your own application. <br>
Keep in mind that this application out of the box does not always reproduce 100% your Sealights setup, for that we kindly ask you to replace the `slnodejs` version you are using in this `package.json` and as well modify the `scan` or `run` command (in Docker if used) to be exactly as in your project. <br>
Also feel free to edit the Dockerfile to bring it closer to your own setup.
