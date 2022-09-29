1. create a collection of 2 APIs

curl https://agents.sealights.co/sealights-java/sealights-java-version.txt

curl https://checkip.amazonaws.com/

2. execute tests collection via newman

newman run PostmanSampleIntegration.postman_collection.json

3. create a sealights custom reporter

https://github.com/postmanlabs/newman/tree/2a57036bc96c6e06289238cb4ef3fe70c1f9f338#creating-your-own-reporter

npm pack
sudo npm i -g newman-reporter-sealights-0.1.0.tgz

4. use Reporter (output string) with Newman

newman run PostmanSampleIntegration.postman_collection.json -r cli,sealights
newman run PostmanSampleCollection.json -r cli,sealights

newman run PostmanSampleCollection.json -r cli,sealights --reporter-sealights-token `cat sltoken.txt` --reporter-sealights-bsid `cat buildSessionId.txt` --reporter-sealights-domain dev-cs-gw.dev.sealights.co 

5. Capture all relevant events

https://github.com/postmanlabs/newman/tree/2a57036bc96c6e06289238cb4ef3fe70c1f9f338#newmanrunevents

4. call slnodejs agent via CLI from the Reporter

====================================

A. Retrieve execution details
	a. Collection: Name
	b. Item (API): ID, name, duration, Test result/status

B. Pass Sealights parameters to reporter
	a. Token or token file
	b. BSID an/or LabID
	c. Stage Name
	d. Proxy
