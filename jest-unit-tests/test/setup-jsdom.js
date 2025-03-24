// This file sets up the necessary globals for JSDOM tests
const { TextEncoder, TextDecoder } = require("util");

// Add TextEncoder and TextDecoder to the global scope
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
