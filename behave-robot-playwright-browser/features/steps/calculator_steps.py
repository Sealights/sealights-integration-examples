"""Step definitions for the calculator feature.

All UI interactions go through ``context.page`` (a Playwright sync Page),
which is created in ``features/environment.py``. The SeaLights agent looks
at the same attribute to drive browser-side coverage coloring per scenario.
"""
from behave import given, when, then
from playwright.sync_api import expect


@given("I open the calculator app")
def step_open_app(context):
    context.page.wait_for_selector("#calc-form")


@when('I enter "{value}" in the first number field')
def step_enter_first(context, value):
    context.page.locator("#number1").fill(value)


@when('I enter "{value}" in the second number field')
def step_enter_second(context, value):
    context.page.locator("#number2").fill(value)


@when('I click the "{label}" button')
def step_click_button(context, label):
    button_id = {
        "Add": "#addBtn",
        "Subtract": "#subtractBtn",
        "Reset": "#resetBtn",
    }[label]
    context.page.locator(button_id).click()


@then('the result should be "{expected}"')
def step_result_text(context, expected):
    expect(context.page.locator("#result")).to_have_text(expected)


@then("the result should be empty")
def step_result_empty(context):
    expect(context.page.locator("#result")).to_have_text("")


@then('I should see the error "{message}"')
def step_error_message(context, message):
    expect(context.page.locator("#error")).to_have_text(message)


@then("the first number field should be empty")
def step_first_empty(context):
    expect(context.page.locator("#number1")).to_have_value("")


@then("the second number field should be empty")
def step_second_empty(context):
    expect(context.page.locator("#number2")).to_have_value("")
