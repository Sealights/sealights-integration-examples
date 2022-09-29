#Sample Powershell script for TIA API: NUnit XML conversion - Sealights (c) 2022

#  =================  Prerequisistes ================= 
# 1. You have a valid and active SL Account
# 2. You have downloaded a valid Agent Token file (sltoken.txt) from the SL Dashboard and placed it in the same directory of this script
# 3. You have reviewed our Documentation page https://sealights.atlassian.net/wiki/spaces/SUP/pages/2690220039/Test+Sessions+API+a.k.a+TIA+API
# 3. You have updated parameters listed in lines 12-18 and command runnig tests in line 68
#  =================================================== 

Clear-Host

$SL_DOMAIN="MYCOMPANY.sealights.co"
$SEALIGHTS_AGENT_TOKEN=Get-Content (Resolve-Path "sltoken.txt") -Raw
$SL_TESTSTAGE_NAME="Automation Tests"

# Use BSID or LabID according to Architecture
$SL_BSID=$(Get-Content (Resolve-Path "buildSessionId.txt") -Raw | Out-String).Trim()
$SL_LABID= ""

$XmlTestsResultsFile = ".\acceptance-test-results.xml"

# ================= FUNCTIONS DEFINITIONS ================= 
function Log-ScriptStep($StepName) { Write-Host "`n*******************************`n*** $StepName ***`n*******************************`n" }

# ================= BEGIN MAIN SCRIPT ================= 

#Set-PSDebug -Trace 1
#$PSDefaultParameterValues['*:Verbose'] = $true

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$header = @{
 "Authorization"="Bearer $SEALIGHTS_AGENT_TOKEN"
 "Content-Type"="application/json"
}

# ################# Starting a test stage execution (Session) ################# 
Log-ScriptStep("Starting Test stage $SL_TESTSTAGE_NAME")

if([string]::IsNullOrWhiteSpace($SL_LABID))
{
	Write-Host("LabId is not defined")
	$SL_LABID=$SL_BSID
}

$body = @{
  "testStage"=$SL_TESTSTAGE_NAME
  "bsid"=$SL_BSID
  "labId"=$SL_LABID
} | ConvertTo-Json

$body

$Response = irm -verbose -Uri https://$SL_DOMAIN/sl-api/v1/test-sessions -Method 'Post' -Body $body -Headers $header 
$SL_TEST_SESSION_ID=$([String]$Response.data.testSessionId) 

if([string]::IsNullOrWhiteSpace($SL_TEST_SESSION_ID))
{
	Write-Host "BSID  = $SL_BSID"	
	Write-Host("[ERROR] Failed to open Session. Ending Script")
	exit 1
}

Write-Host "Test Session ID = $SL_TEST_SESSION_ID"

################## Executing Tests ################# 
Log-ScriptStep("Executing Tests")

#Execute the tests with your framework and output the results in a compatible format
#### HERE ####

################## Uploading Test Results ################# 
Log-ScriptStep("Uploading Tests Results")

#START LOOP over NUnit.xml files if there are multiple

#(Sample) Converting Tests Results from XML file (NUnit format)
# Reference Doc page: https://sealights.atlassian.net/wiki/spaces/SUP/pages/1725267986#Converting-Results-Report-from-XML
$SealightsJson = ConvertTo-Json -InputObject @( [xml]$(Get-Content -Path $XmlTestsResultsFile) | Select-Xml -XPath "//test-case" | foreach {
     [PSCustomObject]@{
         name  = $_.node.fullname
		 start = ([DateTimeOffset](Get-Date $($_.node.'start-time'))).ToUnixTimeMilliseconds()
		 end   = ([DateTimeOffset](Get-Date $($_.node.'end-time'))).ToUnixTimeMilliseconds()
		 status = $(if ($_.node.result -eq 'Passed') { 'passed' } else { $(if ($_.node.result -eq 'Skipped') { 'skipped' } else { 'failed' }) })
     }
 } )

#$SealightsJson

Start-Sleep -s 1

iwr -verbose -Uri "https://$SL_DOMAIN/sl-api/v1/test-sessions/$SL_TEST_SESSION_ID" -Method 'Post' -Body $SealightsJson -Headers $header 

Start-Sleep -s 2

#END LOOP

################# Ending a test stage execution (Session) ################# 
Log-ScriptStep("Ending Test stage $SL_TESTSTAGE_NAME")

iwr -verbose -Uri "https://$SL_DOMAIN/sl-api/v1/test-sessions/$SL_TEST_SESSION_ID" -Method 'Delete' -Headers $header  

Start-Sleep -s 2

Log-ScriptStep("Script completed.")
