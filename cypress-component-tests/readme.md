This project demonstrates usage of both e2e and component tests in Cypress.

# Runner
The easiest way to run Cypress E2E tests with SeaLights is to use the runner. This is
demonstrated with `sl:runner` command in package.json. Runner correctly handles `--spec`
CLI param passed to Cypress, no need to additionally set `CYPRESS_SL_SPEC` env var.

Currently the runner **does not** support running component tests.

# Note on `CYPRESS_SL_SPEC`
SL Cypress plugin introduces `CYPRESS_SL_SPEC` env var which in component tests **must** be set to the same value as
Cypress' `--spec` CLI param. If this var is not set, for component tests `cypress/component/**/*.cy.{js,jsx,ts,tsx}` is used as the default spec
pattern. **This is different pattern than Cypress uses** - in Cypress default `specPattern` for component tests is
`**/*.cy.{js,jsx,ts,tsx}`, which also catches E2E tests (which are later on excluded from the execution internally in
Cypress). If you do not use `--spec` CLI param, and your component tests directory is different from `cypress/component`,
**remember to set `CYPRESS_SL_SPEC` accordingly**.

E.g. if you keep your component tests together with components themselves, like in the structure below:

```
/
|-- cypress/
|  |-- e2e/
|  | |-- some-e2e-spec.cy.js
|-- src/
|  |-- my-component.jsx
|  |-- my-component.cy.jsx
|  |-- module/
|  |  |-- other-component.jsx
|  |  |-- other-component.cy.jsx
```

you should set `CYPRESS_SL_SPEC=src/**/*.cy.{js,jsx,ts,tsx}`. If you define `--spec "src/module/**.cy.jsx"`, then
you should set `CYPRESS_SL_SPEC=src/module/**.cy.jsx`

# Commands

## Setup
To get things up and running, paste SL agent token to `sltoken.txt` in the root directory
and run:
``` 
npm run sl:config
npm run sl:scan
```

## Component
Note that SL **does not** automatically upload coverage for component tests. The process for collecting coverage for 
component tests is described later in this file.

```
npm run cy:ct
```
Runs component tests without SeaLights.

------------------------

``` 
npm run cy:ct:sl
```
Runs component tests with SeaLights.

------------------------

``` 
npm run cy:ct:sl:spec
```
Runs component tests with SeaLights, narrowing down executed specs to `cypress/component/sub/*`.
Note that besides setting Cypress' `--spec` CLI param, it also sets `CYPRESS_SL_SPEC` env
var for SeaLights.

## E2E
``` 
npm run start
```
Runs the AUT. Then, in another terminal, you can run one of the following commands.

------------------------

``` 
npm run sl:runner
```
Runs E2E tests with the runner. For this command, SL does not have to be configured
in `cypress.config.js` and `cypress/support/e2e.js` - runner will patch those files.
For this example repo however those files are already initiated with SeaLights - runner
will leave them intact.

------------------------

``` 
npm run cy:e2e
```
Runs E2E tests without SeaLights.

------------------------

```
npm run cy:e2e:sl
```
Runs E2E tests with SeaLights.

------------------------

``` 
npm run cy:e2e:sl:spec
```
Runs E2E tests with SeaLights, narrowing down executed specs to `cypress/e2e/sub/*`.
Note that besides setting Cypress' `--spec` CLI param, it also sets `CYPRESS_SL_SPEC` env
var for SeaLights. This is not necessary when executing tests with the runner.

# Uploading coverage for component tests
https://sealights.atlassian.net/wiki/spaces/DEV/pages/5134483457/Coverage+of+Cypress+component+tests