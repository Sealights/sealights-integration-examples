/**
 * Little reporter that starts/ends Test Stage Execution (from a collection) to Sealights Servers.
 *
 * @param {Object} emitter - A run object with event handler specification methods.
 * @param {Function} emitter.on - An event setter method that provides hooks for reporting collection run progress.
 * @param {Object} reporterOptions - A set of reporter specific run options.
 * @param {Object} collectionRunOptions - A set of generic collection run options.
 * @returns {*}
 */

//https://www.npmjs.com/package/axios
const axios = require('axios');

var slBsid = "";
var slDomain = ""
var slToken = ""
var slLabid = ""
var slStageName = "Postman Tests" 
 
SealightsReporter = function (emitter, reporterOptions, collectionRunOptions) {
  // emitter is an event emitter that triggers the following events: https://github.com/postmanlabs/newman#newmanrunevents
  // reporterOptions is an object of the reporter specific options. See usage examples below for more details.
  // collectionRunOptions is an object of all the collection run options: https://github.com/postmanlabs/newman#newmanrunoptions-object--callback-function--run-eventemitter

    if (collectionRunOptions.silent || reporterOptions.silent) {
        return;
    }

    if (reporterOptions.domain) {
        console.log("### [SL] API Domain="+reporterOptions.domain);
    } else {
        console.log("### [SL] Error: Domain is mandatory. Exiting.");
        slDomain=reporterOptions.domain;
        return;
    }

    if (reporterOptions.token) {
        console.log("### [SL] Token="+reporterOptions.token.slice(-10));
        slToken=reporterOptions.token;
    } else {
        console.log("### [SL] Error: Token is mandatory. Exiting.");
        return;
    }

    if (reporterOptions.bsid) {
        console.log("### [SL] BSID="+reporterOptions.bsid);
        slBsid=reporterOptions.bsid;
    } else {
        console.log("### [SL] Error: BSID is mandatory. Exiting.");
        return;
    }

    emitter.on('start', function (err, data) {
        if (err) { return; }
        
        console.log("### [SL] Open Test Stage execution = \"Postman\"");
        //console.log(JSON.stringify(data));
        //console.log(JSON.stringify(collectionRunOptions));
        
        const AuthStr = 'Bearer '.concat(slToken); 
        const URL = 'https://'.concat(slDomain).concat('/sl-api/v1');
        
        axios.get(URL.concat('/executions'), 
            { 
                params : { 'bsid': slBsid, 'labId': slBsid}, 
                headers: { 'Authorization': AuthStr , 'Content-Type': 'application/json'} })
         .then(response => {
             // If request is good...
             console.log(response.data);
          })
         .catch((error) => {
             console.log('error ' + error);
          });
        
        
        var jsonBody = JSON.stringify({
            testStage: "Postman", 
            bsid: ${slBdid}
        })
        
        console.log("### [SL] Body: "+jsonBody);
        
    });

    emitter.on('assertion', function (err, data) {
        if (err) { return; }
        console.log("### [SL] Assertion - Item name: " + data.skipped);
    });

    emitter.on('beforeItem', function (err, data) {
        if (err) { return; }
        console.log("### [SL] BeforeItem - Item name: " + data.item.name);
    });

    emitter.on('item', function (err, data) {
        if (err) { return; }

        console.log("### [SL] Item Completed - Item name: " + data.item.name);
        // duration
        // result - see emitter-reporterjunit or junitfull
    });

    emitter.on('done', function (err, data) {
        console.log('### [SL] Closing Test Stage execution');
    });
};

module.exports = SealightsReporter;