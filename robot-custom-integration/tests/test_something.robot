*** Settings ***
Library               RequestsLibrary

*** Test Cases ***
Test-Owners
    ${response}=        GET	http://localhost:8080/api/customer/owners
    ${status_code}=     Convert To Integer 	200
    Should Be Equal     ${response.status_code}    ${status_code}

Test-get-owner
    ${response}=		GET	http://localhost:8080/api/gateway/owners/1
    ${expected_body}=	Set Variable    {"id":1,"firstName":"George","lastName":"Franklin","address":"110 W. Liberty St.","city":"Madison","telephone":"6085551023","pets":[{"id":1,"name":"Leo","birthDate":"2010-09-07","type":{"name":"cat"},"visits":[]}]}
    Should Be Equal    	${response.text}    ${expected_body}

Test-get-vets
    ${response}=		GET	http://localhost:8080/api/vet/vets
    ${expected_body}=	Set Variable    [{"id":1,"firstName":"James","lastName":"Carter","specialties":[],"nrOfSpecialties":0},{"id":2,"firstName":"Helen","lastName":"Leary","specialties":[{"id":1,"name":"radiology"}],"nrOfSpecialties":1},{"id":3,"firstName":"Linda","lastName":"Douglas","specialties":[{"id":3,"name":"dentistry"},{"id":2,"name":"surgery"}],"nrOfSpecialties":2},{"id":4,"firstName":"Rafael","lastName":"Ortega","specialties":[{"id":2,"name":"surgery"}],"nrOfSpecialties":1},{"id":5,"firstName":"Henry","lastName":"Stevens","specialties":[{"id":1,"name":"radiology"}],"nrOfSpecialties":1},{"id":6,"firstName":"Sharon","lastName":"Jenkins","specialties":[],"nrOfSpecialties":0}]
    Should Be Equal    	${response.text}    ${expected_body}
