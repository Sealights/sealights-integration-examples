# Sample powershell commands converting XML to JSON 

---
**NOTE**

For better accuracy of Sealights Test Optimization, please make sure to set your XML report timestamps in milliseconds. 
For example, you can change the parameter timestampFormat in your XML Reporter settings from yyyy-MM-dd'T'HH:mm:ss'Z' to yyyy-MM-dd'T'HH:mm:ss.SSS'Z', for that purpose.

---

## nUnit XML conversion to Sealights JSON format for TIA API
```powershell
$SealightsJson = ConvertTo-Json -InputObject @( [xml]$(Get-Content -Path $XmlTestsResultsFile) | Select-Xml -XPath "//test-case" | foreach {
     [PSCustomObject]@{
         name  = $_.node.fullname
		 start = ([DateTimeOffset](Get-Date $($_.node.'start-time'))).ToUnixTimeMilliseconds()
		 end   = ([DateTimeOffset](Get-Date $($_.node.'end-time'))).ToUnixTimeMilliseconds()
		 status = $(if ($_.node.result -eq 'Passed') { 'passed' } else { $(if ($_.node.result -eq 'Skipped') { 'skipped' } else { 'failed' }) })
     }
 } )
 ```
 
## TestNG XML conversion to Sealights JSON format for TIA API
```powershell
$SealightsJson = ConvertTo-Json -InputObject @( [xml]$(Get-Content -Path $XmlTestsResultsFile) | Select-Xml -XPath "//test-method" |foreach {
    [PSCustomObject]@{
        name = $_.node.signature
		start = ([DateTimeOffset](Get-Date $($_.node.'started-at'))).ToUnixTimeMilliseconds()
		end = ([DateTimeOffset](Get-Date $($_.node.'finished-at'))).ToUnixTimeMilliseconds()
		status = $(if ($_.node.status -eq 'PASS') { 'passed' } else { $(if ($_.node.status -eq 'FAIL') { 'failed' } else { 'skipped' }) })
    }
} ) )
 ```
