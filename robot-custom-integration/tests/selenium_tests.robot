*** Settings ***
Library                 RequestsLibrary
Library                 SeleniumLibrary
Test Tags               Selenium-Tests

*** Variables ***
${LOGIN URL}      http://localhost:4200
${BROWSER}        Chrome

*** Test Cases ***
test-selenium1
    ${chrome_options}=    Evaluate    sys.modules['selenium.webdriver'].ChromeOptions()    sys, selenium.webdriver
    Call Method    ${chrome_options}    add_argument    --enable-logging
    Call Method    ${chrome_options}    add_argument    --log-file\=/tmp/test-selenium1.log
    Open Browser    ${LOGIN URL}    browser=chrome      options=${chrome_options}
    Click Element   xpath: /html/body/app-root/div[1]/nav/div/ul/li[3]/a
    Click Element   xpath: /html/body/app-root/div[1]/nav/div/ul/li[3]/ul/li[1]/a/span[2]
    Wait Until Page Contains Element    //*[@id="vets"]
    [Teardown]    Close Browser

test-selenium2
    ${chrome_options}=    Evaluate    sys.modules['selenium.webdriver'].ChromeOptions()    sys, selenium.webdriver
    Call Method    ${chrome_options}    add_argument    --enable-logging
    Call Method    ${chrome_options}    add_argument    --log-file\=/tmp/test-selenium2.log
    Open Browser    ${LOGIN URL}    browser=chrome      options=${chrome_options}
    Click Element   xpath: /html/body/app-root/div[1]/nav/div/ul/li[4]/a
    Wait Until Page Contains Element    //*[@id="pettypes"]
    [Teardown]    Close Browser
