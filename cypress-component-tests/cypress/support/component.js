import './commands';
import '@cypress/code-coverage/support';
import { mount } from 'cypress/react';

Cypress.Commands.add('mount', mount);

import 'sealights-cypress-plugin/support';
