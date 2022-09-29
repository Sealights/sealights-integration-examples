# Sample powershell commands converting XML to JSON 

## nUnit XML conversion to Sealights JSON format for TIA API
```
$SealightsJson = ConvertTo-Json -InputObject @( [xml]$(Get-Content -Path $XmlTestsResultsFile) | Select-Xml -XPath "//test-case" | foreach {
     [PSCustomObject]@{
         name  = $_.node.fullname
		 start = ([DateTimeOffset](Get-Date $($_.node.'start-time'))).ToUnixTimeMilliseconds()
		 end   = ([DateTimeOffset](Get-Date $($_.node.'end-time'))).ToUnixTimeMilliseconds()
		 status = $(if ($_.node.result -eq 'Passed') { 'passed' } else { $(if ($_.node.result -eq 'Skipped') { 'skipped' } else { 'failed' }) })
     }
 } )
 ```
 
## xUnit XML conversion to Sealights JSON format for TIA API
```
$SealightsJson = ConvertTo-Json -InputObject @( [xml]$(Get-Content -Path $XmlTestsResultsFile) | Select-Xml -XPath "//test-case" | foreach {
     [PSCustomObject]@{
         name  = $_.node.fullname
		 start = ([DateTimeOffset](Get-Date $($_.node.'start-time'))).ToUnixTimeMilliseconds()
		 end   = ([DateTimeOffset](Get-Date $($_.node.'end-time'))).ToUnixTimeMilliseconds()
		 status = $(if ($_.node.result -eq 'Passed') { 'passed' } else { $(if ($_.node.result -eq 'Skipped') { 'skipped' } else { 'failed' }) })
     }
 } )
 ```
