var slConfig = {
  "customerId": "SeaLights",
  "appName": "Cypress Testing App",
  "buildName": "1.0.0",
  "branchName": "master",
  "server": "https://dev-integration.dev.sealights.co/api",
  "token": "eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL0RFVi1pbnRlZ3JhdGlvbi5hdXRoLnNlYWxpZ2h0cy5pby8iLCJqd3RpZCI6IkRFVi1pbnRlZ3JhdGlvbixuZWVkVG9SZW1vdmUsQVBJR1ctMjI3MTAzMjgtMDQ0MC00ZDUwLWE3N2ItODRhYWNiMGU0MzAyLDE3MjAwOTEwNDkwMjMiLCJzdWJqZWN0IjoiU2VhTGlnaHRzQGFnZW50IiwiYXVkaWVuY2UiOlsiYWdlbnRzIl0sIngtc2wtcm9sZSI6ImFnZW50IiwieC1zbC1zZXJ2ZXIiOiJodHRwczovL2Rldi1pbnRlZ3JhdGlvbi5kZXYuc2VhbGlnaHRzLmNvL2FwaSIsInNsX2ltcGVyX3N1YmplY3QiOiIiLCJpYXQiOjE3MjAwOTEwNDl9.FOx0_DCNmfl4-FWDx_tpo4PsY4-z0GQQFMJMuaC3OP0wciJaHcGeygb1oiQNPmkAGSI4NdwGuLTpFzaItpY5IZ6cxHeVcSvlAXbA57xWRBie8gEoD11V5_MJw_UPe-BvssdI6qWWp9A55OAkUIp_L62Y103hn_duZVdnpScScmX2uG9Fr7owzM6JkELlKMd7uIyy5CB1ldBI5cYjjfZ-rKLSdGY1E4GY0hVImePOBTpN1p_7H8AlPoct1bqDiYGWOuT2Dx70Ge2txZnlj_GU3XuzadBOsq80aJv7qj4qwLkQjP3A98wjoCyrmjdOsqMYaEbkjbrVr35EvXIVbAZ1SEcm3dDRIsb0-senzvq9te7yLVoZcQ6dZz3SzywA0MYYIQVADAaN74oawlluQMrfXA1PcbKbP0O-ykW9LabSq-OVqMpWyxCM5ZjXB787sZeRb7uDNwE40M-XpWQqTaU8_EBizCuU2R1n_fGbJyiOKu5xnd3q6gkJGTEX3M5jSCM-qI4Ot4n4oHFS9kaE_Aoi9rgcXtYjJLMiGRhP7lrS_Y8r10t1ODW2Ck_XOsNBpnN78eyeC2tve-9MvuhNndS2l7CFcmnXKKFpySoJq9IpK9lAdKhypuegnHdgkTjuU91rFjaQG2F6wAJt1thCIhDkJnL5DLAftVkSqZ25_CejOpg",
  "buildSessionId": "87a61a01-59cc-4897-ad8b-44167bd7a1cc",
  "enabled": true,
  "workspacepath": "/home/kristijan/Desktop/workspace/sealights-integration-examples/cypress-angular-ng-e2e/dist/cypress-ng-schematic/",
  "maxItemsInQueue": 500,
  "registerShutdownHook": true,
  "interval": 10,
  "resolveWithoutHash": true,
  "delayShutdownInSeconds": 30,
  "isUseNewUniqueId": false,
  "footprintsEnableV6": true,
  "footprintsBufferThresholdMb": 10,
  "footprintsCollectIntervalSecs": 10,
  "footprintsSendIntervalSecs": 10,
  "executionQueryIntervalSecs": 10,
  "footprintsQueueSize": 2,
  "blockBrowserHttpTraffic": false,
  "enableOpenTelemetry": true,
  "footprintsMapping": "agent",
  "removeSensitiveData": false,
  "experimentalSizeReduction": false
};
window.$Sealights = window.$Sealights || {};
if(window && window.$SealightsAgent){
   window.$SealightsAgent.createInstance(slConfig)
} else {
   window.$Sealights.components = window.$Sealights.components || {};
   window.$Sealights.components["87a61a01-59cc-4897-ad8b-44167bd7a1cc"] = slConfig;   document.addEventListener("DOMContentLoaded", function(event) {
       document.body.dataset.components = JSON.stringify(window.$Sealights.components || {});
   });}
if(!window.$Sealights.scriptAdded && !window.$Sealights.skipSlAgent) {
   var script   = document.createElement("script");
   script.type  = "text/javascript";
   script.src   = "https://dev-integration.dev.sealights.co/api/v1/agents/browser/recommended?redirect=1&customerId=SeaLights";
   var head     = document.head || document.getElementsByTagName && document.getElementsByTagName('head')[0]
   if (head) { head.appendChild(script); window.$Sealights.scriptAdded = true; } else { /* Unsupported/restricted browser */ }
}
var cov_190rc8d0mo=function(){var path="/home/kristijan/Desktop/workspace/sealights-integration-examples/cypress-angular-ng-e2e/dist/cypress-ng-schematic/runtime-es2017.6b066d5bdd0438340c0c.js",hash="867e59158372ab39e770bc4965fe74b4f7739b42",Function=function(){}.constructor,global=new Function('return this')(),gcv="$SealightsCoverage_87a61a01-59cc-4897-ad8b-44167bd7a1cc",coverageData={path:"/home/kristijan/Desktop/workspace/sealights-integration-examples/cypress-angular-ng-e2e/dist/cypress-ng-schematic/runtime-es2017.6b066d5bdd0438340c0c.js",statementMap:{"0":{start:{line:1,column:0},end:{line:1,column:1214}},"1":{start:{line:1,column:33},end:{line:1,column:35}},"2":{start:{line:1,column:38},end:{line:1,column:40}},"3":{start:{line:1,column:61},end:{line:1,column:65}},"4":{start:{line:1,column:66},end:{line:1,column:97}},"5":{start:{line:1,column:80},end:{line:1,column:97}},"6":{start:{line:1,column:103},end:{line:1,column:120}},"7":{start:{line:1,column:121},end:{line:1,column:157}},"8":{start:{line:1,column:158},end:{line:1,column:1210}},"9":{start:{line:1,column:191},end:{line:1,column:459}},"10":{start:{line:1,column:204},end:{line:1,column:207}},"11":{start:{line:1,column:208},end:{line:1,column:450}},"12":{start:{line:1,column:232},end:{line:1,column:262}},"13":{start:{line:1,column:262},end:{line:1,column:399}},"14":{start:{line:1,column:294},end:{line:1,column:399}},"15":{start:{line:1,column:343},end:{line:1,column:362}},"16":{start:{line:1,column:399},end:{line:1,column:449}},"17":{start:{line:1,column:405},end:{line:1,column:421}},"18":{start:{line:1,column:427},end:{line:1,column:430}},"19":{start:{line:1,column:431},end:{line:1,column:448}},"20":{start:{line:1,column:450},end:{line:1,column:458}},"21":{start:{line:1,column:459},end:{line:1,column:466}},"22":{start:{line:1,column:466},end:{line:1,column:518}},"23":{start:{line:1,column:506},end:{line:1,column:518}},"24":{start:{line:1,column:518},end:{line:1,column:530}},"25":{start:{line:1,column:554},end:{line:1,column:619}},"26":{start:{line:1,column:581},end:{line:1,column:597}},"27":{start:{line:1,column:610},end:{line:1,column:618}},"28":{start:{line:1,column:620},end:{line:1,column:641}},"29":{start:{line:1,column:661},end:{line:1,column:748}},"30":{start:{line:1,column:676},end:{line:1,column:748}},"31":{start:{line:1,column:768},end:{line:1,column:816}},"32":{start:{line:1,column:835},end:{line:1,column:842}},"33":{start:{line:1,column:843},end:{line:1,column:878}},"34":{start:{line:1,column:861},end:{line:1,column:876}},"35":{start:{line:1,column:884},end:{line:1,column:1064}},"36":{start:{line:1,column:908},end:{line:1,column:912}},"37":{start:{line:1,column:915},end:{line:1,column:919}},"38":{start:{line:1,column:922},end:{line:1,column:926}},"39":{start:{line:1,column:929},end:{line:1,column:930}},"40":{start:{line:1,column:931},end:{line:1,column:966}},"41":{start:{line:1,column:942},end:{line:1,column:966}},"42":{start:{line:1,column:966},end:{line:1,column:982}},"43":{start:{line:1,column:977},end:{line:1,column:981}},"44":{start:{line:1,column:982},end:{line:1,column:1050}},"45":{start:{line:1,column:1009},end:{line:1,column:1050}},"46":{start:{line:1,column:1050},end:{line:1,column:1063}},"47":{start:{line:1,column:1067},end:{line:1,column:1146}},"48":{start:{line:1,column:1147},end:{line:1,column:1207}}},fnMap:{"0":{name:"(anonymous_0)",decl:{start:{line:1,column:1},end:{line:1,column:2}},loc:{start:{line:1,column:11},end:{line:1,column:1211}},line:1},"1":{name:"t",decl:{start:{line:1,column:50},end:{line:1,column:51}},loc:{start:{line:1,column:54},end:{line:1,column:158}},line:1},"2":{name:"(anonymous_2)",decl:{start:{line:1,column:173},end:{line:1,column:174}},loc:{start:{line:1,column:190},end:{line:1,column:531}},line:1},"3":{name:"(anonymous_3)",decl:{start:{line:1,column:331},end:{line:1,column:332}},loc:{start:{line:1,column:342},end:{line:1,column:363}},line:1},"4":{name:"(anonymous_4)",decl:{start:{line:1,column:536},end:{line:1,column:537}},loc:{start:{line:1,column:547},end:{line:1,column:642}},line:1},"5":{name:"(anonymous_5)",decl:{start:{line:1,column:570},end:{line:1,column:571}},loc:{start:{line:1,column:580},end:{line:1,column:598}},line:1},"6":{name:"(anonymous_6)",decl:{start:{line:1,column:599},end:{line:1,column:600}},loc:{start:{line:1,column:609},end:{line:1,column:619}},line:1},"7":{name:"(anonymous_7)",decl:{start:{line:1,column:647},end:{line:1,column:648}},loc:{start:{line:1,column:660},end:{line:1,column:749}},line:1},"8":{name:"(anonymous_8)",decl:{start:{line:1,column:754},end:{line:1,column:755}},loc:{start:{line:1,column:767},end:{line:1,column:817}},line:1},"9":{name:"(anonymous_9)",decl:{start:{line:1,column:818},end:{line:1,column:819}},loc:{start:{line:1,column:828},end:{line:1,column:1208}},line:1},"10":{name:"(anonymous_10)",decl:{start:{line:1,column:849},end:{line:1,column:850}},loc:{start:{line:1,column:860},end:{line:1,column:877}},line:1},"11":{name:"(anonymous_11)",decl:{start:{line:1,column:884},end:{line:1,column:885}},loc:{start:{line:1,column:897},end:{line:1,column:1064}},line:1}},branchMap:{"0":{loc:{start:{line:1,column:66},end:{line:1,column:97}},type:"if",locations:[{start:{line:1,column:66},end:{line:1,column:97}},{start:{line:1,column:66},end:{line:1,column:97}}],line:1},"1":{loc:{start:{line:1,column:191},end:{line:1,column:459}},type:"if",locations:[{start:{line:1,column:191},end:{line:1,column:459}},{start:{line:1,column:191},end:{line:1,column:459}}],line:1},"2":{loc:{start:{line:1,column:294},end:{line:1,column:398}},type:"cond-expr",locations:[{start:{line:1,column:365},end:{line:1,column:380}},{start:{line:1,column:382},end:{line:1,column:397}}],line:1},"3":{loc:{start:{line:1,column:294},end:{line:1,column:364}},type:"binary-expr",locations:[{start:{line:1,column:295},end:{line:1,column:299}},{start:{line:1,column:301},end:{line:1,column:305}},{start:{line:1,column:308},end:{line:1,column:364}}],line:1},"4":{loc:{start:{line:1,column:387},end:{line:1,column:397}},type:"binary-expr",locations:[{start:{line:1,column:387},end:{line:1,column:390}},{start:{line:1,column:393},end:{line:1,column:396}}],line:1},"5":{loc:{start:{line:1,column:399},end:{line:1,column:449}},type:"if",locations:[{start:{line:1,column:399},end:{line:1,column:449}},{start:{line:1,column:399},end:{line:1,column:449}}],line:1},"6":{loc:{start:{line:1,column:431},end:{line:1,column:448}},type:"binary-expr",locations:[{start:{line:1,column:431},end:{line:1,column:441}},{start:{line:1,column:444},end:{line:1,column:447}}],line:1},"7":{loc:{start:{line:1,column:461},end:{line:1,column:465}},type:"binary-expr",locations:[{start:{line:1,column:461},end:{line:1,column:462}},{start:{line:1,column:464},end:{line:1,column:465}}],line:1},"8":{loc:{start:{line:1,column:485},end:{line:1,column:501}},type:"binary-expr",locations:[{start:{line:1,column:485},end:{line:1,column:488}},{start:{line:1,column:490},end:{line:1,column:501}}],line:1},"9":{loc:{start:{line:1,column:554},end:{line:1,column:619}},type:"cond-expr",locations:[{start:{line:1,column:570},end:{line:1,column:598}},{start:{line:1,column:599},end:{line:1,column:619}}],line:1},"10":{loc:{start:{line:1,column:554},end:{line:1,column:569}},type:"binary-expr",locations:[{start:{line:1,column:554},end:{line:1,column:555}},{start:{line:1,column:557},end:{line:1,column:569}}],line:1},"11":{loc:{start:{line:1,column:676},end:{line:1,column:748}},type:"binary-expr",locations:[{start:{line:1,column:676},end:{line:1,column:684}},{start:{line:1,column:686},end:{line:1,column:695}},{start:{line:1,column:697},end:{line:1,column:748}}],line:1},"12":{loc:{start:{line:1,column:942},end:{line:1,column:965}},type:"binary-expr",locations:[{start:{line:1,column:942},end:{line:1,column:950}},{start:{line:1,column:953},end:{line:1,column:964}}],line:1},"13":{loc:{start:{line:1,column:966},end:{line:1,column:982}},type:"if",locations:[{start:{line:1,column:966},end:{line:1,column:982}},{start:{line:1,column:966},end:{line:1,column:982}}],line:1},"14":{loc:{start:{line:1,column:1009},end:{line:1,column:1039}},type:"binary-expr",locations:[{start:{line:1,column:1009},end:{line:1,column:1022}},{start:{line:1,column:1024},end:{line:1,column:1028}},{start:{line:1,column:1030},end:{line:1,column:1039}}],line:1},"15":{loc:{start:{line:1,column:1105},end:{line:1,column:1146}},type:"binary-expr",locations:[{start:{line:1,column:1105},end:{line:1,column:1142}},{start:{line:1,column:1144},end:{line:1,column:1146}}],line:1}},s:{"0":0,"1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,"9":0,"10":0,"11":0,"12":0,"13":0,"14":0,"15":0,"16":0,"17":0,"18":0,"19":0,"20":0,"21":0,"22":0,"23":0,"24":0,"25":0,"26":0,"27":0,"28":0,"29":0,"30":0,"31":0,"32":0,"33":0,"34":0,"35":0,"36":0,"37":0,"38":0,"39":0,"40":0,"41":0,"42":0,"43":0,"44":0,"45":0,"46":0,"47":0,"48":0},f:{"0":0,"1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,"9":0,"10":0,"11":0},b:{"0":[0,0],"1":[0,0],"2":[0,0],"3":[0,0,0],"4":[0,0],"5":[0,0],"6":[0,0],"7":[0,0],"8":[0,0],"9":[0,0],"10":[0,0],"11":[0,0,0],"12":[0,0],"13":[0,0],"14":[0,0,0],"15":[0,0]},_coverageSchema:"43e27e138ebf9cfc5966b082cf9a028302ed4184"},coverage=global[gcv]||(global[gcv]={});if(coverage[path]&&coverage[path].hash===hash){return coverage[path];}coverageData.hash=hash;return coverage[path]=coverageData;}();cov_190rc8d0mo.s[0]++;!function(){"use strict";cov_190rc8d0mo.f[0]++;var r,n=(cov_190rc8d0mo.s[1]++,{}),e=(cov_190rc8d0mo.s[2]++,{});function t(r){cov_190rc8d0mo.f[1]++;var o=(cov_190rc8d0mo.s[3]++,e[r]);cov_190rc8d0mo.s[4]++;if(void 0!==o){cov_190rc8d0mo.b[0][0]++;cov_190rc8d0mo.s[5]++;return o.exports;}else{cov_190rc8d0mo.b[0][1]++;}var u=(cov_190rc8d0mo.s[6]++,e[r]={exports:{}});cov_190rc8d0mo.s[7]++;return n[r](u,u.exports,t),u.exports;}cov_190rc8d0mo.s[8]++;t.m=n,r=[],t.O=function(n,e,o,u){cov_190rc8d0mo.f[2]++;cov_190rc8d0mo.s[9]++;if(!e){cov_190rc8d0mo.b[1][0]++;var i=(cov_190rc8d0mo.s[10]++,1/0);cov_190rc8d0mo.s[11]++;for(s=0;s<r.length;s++){cov_190rc8d0mo.s[12]++;e=r[s][0],o=r[s][1],u=r[s][2];cov_190rc8d0mo.s[13]++;for(var c=!0,f=0;f<e.length;f++){cov_190rc8d0mo.s[14]++;((cov_190rc8d0mo.b[3][0]++,!1&u)||(cov_190rc8d0mo.b[3][1]++,i>=u))&&(cov_190rc8d0mo.b[3][2]++,Object.keys(t.O).every(function(r){cov_190rc8d0mo.f[3]++;cov_190rc8d0mo.s[15]++;return t.O[r](e[f]);}))?(cov_190rc8d0mo.b[2][0]++,e.splice(f--,1)):(cov_190rc8d0mo.b[2][1]++,(c=!1,(cov_190rc8d0mo.b[4][0]++,u<i)&&(cov_190rc8d0mo.b[4][1]++,i=u)));}cov_190rc8d0mo.s[16]++;if(c){cov_190rc8d0mo.b[5][0]++;cov_190rc8d0mo.s[17]++;r.splice(s--,1);var a=(cov_190rc8d0mo.s[18]++,o());cov_190rc8d0mo.s[19]++;(cov_190rc8d0mo.b[6][0]++,void 0!==a)&&(cov_190rc8d0mo.b[6][1]++,n=a);}else{cov_190rc8d0mo.b[5][1]++;}}cov_190rc8d0mo.s[20]++;return n;}else{cov_190rc8d0mo.b[1][1]++;}cov_190rc8d0mo.s[21]++;u=(cov_190rc8d0mo.b[7][0]++,u)||(cov_190rc8d0mo.b[7][1]++,0);cov_190rc8d0mo.s[22]++;for(var s=r.length;(cov_190rc8d0mo.b[8][0]++,s>0)&&(cov_190rc8d0mo.b[8][1]++,r[s-1][2]>u);s--){cov_190rc8d0mo.s[23]++;r[s]=r[s-1];}cov_190rc8d0mo.s[24]++;r[s]=[e,o,u];},t.n=function(r){cov_190rc8d0mo.f[4]++;var n=(cov_190rc8d0mo.s[25]++,(cov_190rc8d0mo.b[10][0]++,r)&&(cov_190rc8d0mo.b[10][1]++,r.__esModule)?(cov_190rc8d0mo.b[9][0]++,function(){cov_190rc8d0mo.f[5]++;cov_190rc8d0mo.s[26]++;return r.default;}):(cov_190rc8d0mo.b[9][1]++,function(){cov_190rc8d0mo.f[6]++;cov_190rc8d0mo.s[27]++;return r;}));cov_190rc8d0mo.s[28]++;return t.d(n,{a:n}),n;},t.d=function(r,n){cov_190rc8d0mo.f[7]++;cov_190rc8d0mo.s[29]++;for(var e in n){cov_190rc8d0mo.s[30]++;(cov_190rc8d0mo.b[11][0]++,t.o(n,e))&&(cov_190rc8d0mo.b[11][1]++,!t.o(r,e))&&(cov_190rc8d0mo.b[11][2]++,Object.defineProperty(r,e,{enumerable:!0,get:n[e]}));}},t.o=function(r,n){cov_190rc8d0mo.f[8]++;cov_190rc8d0mo.s[31]++;return Object.prototype.hasOwnProperty.call(r,n);},function(){cov_190rc8d0mo.f[9]++;var r=(cov_190rc8d0mo.s[32]++,{666:0});cov_190rc8d0mo.s[33]++;t.O.j=function(n){cov_190rc8d0mo.f[10]++;cov_190rc8d0mo.s[34]++;return 0===r[n];};cov_190rc8d0mo.s[35]++;var n=function(n,e){cov_190rc8d0mo.f[11]++;var o,u,i=(cov_190rc8d0mo.s[36]++,e[0]),c=(cov_190rc8d0mo.s[37]++,e[1]),f=(cov_190rc8d0mo.s[38]++,e[2]),a=(cov_190rc8d0mo.s[39]++,0);cov_190rc8d0mo.s[40]++;for(o in c){cov_190rc8d0mo.s[41]++;(cov_190rc8d0mo.b[12][0]++,t.o(c,o))&&(cov_190rc8d0mo.b[12][1]++,t.m[o]=c[o]);}cov_190rc8d0mo.s[42]++;if(f){cov_190rc8d0mo.b[13][0]++;var s=(cov_190rc8d0mo.s[43]++,f(t));}else{cov_190rc8d0mo.b[13][1]++;}cov_190rc8d0mo.s[44]++;for(n&&n(e);a<i.length;a++){cov_190rc8d0mo.s[45]++;(cov_190rc8d0mo.b[14][0]++,t.o(r,u=i[a]))&&(cov_190rc8d0mo.b[14][1]++,r[u])&&(cov_190rc8d0mo.b[14][2]++,r[u][0]()),r[i[a]]=0;}cov_190rc8d0mo.s[46]++;return t.O(s);},e=(cov_190rc8d0mo.s[47]++,self.webpackChunkcypress_ng_schematic=(cov_190rc8d0mo.b[15][0]++,self.webpackChunkcypress_ng_schematic)||(cov_190rc8d0mo.b[15][1]++,[]));cov_190rc8d0mo.s[48]++;e.forEach(n.bind(null,0)),e.push=n.bind(null,e.push.bind(e));}();}();