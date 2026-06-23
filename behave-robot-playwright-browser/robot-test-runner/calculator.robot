*** Settings ***
Documentation       Robot Framework UI tests for the calculator demo app, driven
...                 by Playwright's native Python sync API (via CalculatorLibrary).
...                 No SeaLights wiring yet -- this just exercises the app.

Library             CalculatorLibrary.py    ${URL}    ${HEADLESS}

Test Setup          Open Calculator
Test Teardown       Close Calculator
Suite Teardown      Shutdown


*** Variables ***
${URL}          %{APP_URL=http://localhost:3333}
${HEADLESS}     %{HEADLESS=true}


*** Test Cases ***
Add Two Positive Numbers
    Enter Number    number1    5
    Enter Number    number2    3
    Click Operation    addBtn
    Result Should Be    8

Subtract Two Numbers
    Enter Number    number1    15
    Enter Number    number2    5
    Click Operation    subtractBtn
    Result Should Be    10

Add A Negative Number
    Enter Number    number1    10
    Enter Number    number2    -4
    Click Operation    addBtn
    Result Should Be    6

Invalid Input Shows An Error
    Enter Number    number1    abc
    Enter Number    number2    3
    Click Operation    addBtn
    Error Should Be    Please enter two valid numbers.

Reset Clears The Form
    Enter Number    number1    7
    Enter Number    number2    2
    Click Operation    addBtn
    Result Should Be    9
    Click Operation    resetBtn
    Field Should Be Empty    number1
    Field Should Be Empty    number2
    Result Should Be Empty
