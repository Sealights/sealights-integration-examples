*** Settings ***
Library               RequestsLibrary

*** Test Cases ***
Test-Owners
    ${response}=        GET	http://localhost:9966/petclinic/api/owners
    ${status_code}=     Convert To Integer 	200
    Should Be Equal     ${response.status_code}    ${status_code}

Test-get-owner
    ${response}=		GET	http://localhost:9966/petclinic/api/owners/1
    ${expected_body}=	Set Variable    {"firstName":"George","lastName":"Franklin","address":"110 W. Liberty St.","city":"Madison","telephone":"6085551023","id":1,"pets":[{"name":"Leo","birthDate":"2010-09-07","type":{"name":"cat","id":1},"id":1,"ownerId":1,"visits":[]}]}
    Should Be Equal    	${response.text}    ${expected_body}

Test-get-vets
    ${response}=		GET	http://localhost:9966/petclinic/api/vets
    ${expected_body}=	Set Variable    [{"firstName":"James","lastName":"Carter","specialties":[],"id":1},{"firstName":"Helen","lastName":"Leary","specialties":[{"id":1,"name":"radiology"}],"id":2},{"firstName":"Linda","lastName":"Douglas","specialties":[{"id":3,"name":"dentistry"},{"id":2,"name":"surgery"}],"id":3},{"firstName":"Rafael","lastName":"Ortega","specialties":[{"id":2,"name":"surgery"}],"id":4},{"firstName":"Henry","lastName":"Stevens","specialties":[{"id":1,"name":"radiology"}],"id":5},{"firstName":"Sharon","lastName":"Jenkins","specialties":[],"id":6}]
    Should Be Equal    	${response.text}    ${expected_body}
