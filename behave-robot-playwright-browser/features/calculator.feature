Feature: Calculator UI
  As a user of the calculator app
  I want to add and subtract two numbers
  So that I can verify the UI and backend work together

  Background:
    Given I open the calculator app

  Scenario: Add two positive numbers
    When I enter "5" in the first number field
    And I enter "3" in the second number field
    And I click the "Add" button
    Then the result should be "8"

  Scenario: Subtract two numbers
    When I enter "15" in the first number field
    And I enter "5" in the second number field
    And I click the "Subtract" button
    Then the result should be "10"

  Scenario: Add a negative number
    When I enter "10" in the first number field
    And I enter "-4" in the second number field
    And I click the "Add" button
    Then the result should be "6"

  Scenario: Invalid input shows an error
    When I enter "abc" in the first number field
    And I enter "3" in the second number field
    And I click the "Add" button
    Then I should see the error "Please enter two valid numbers."

  Scenario: Reset clears the form
    When I enter "7" in the first number field
    And I enter "2" in the second number field
    And I click the "Add" button
    And I click the "Reset" button
    Then the first number field should be empty
    And the second number field should be empty
    And the result should be empty
