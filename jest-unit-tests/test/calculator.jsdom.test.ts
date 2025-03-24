import { JSDOM } from "jsdom";
import {
  setupBrowserCalculator,
  add,
  subtract,
  multiply,
  divide,
  percentage,
} from "../src/index.jsdom";

// Extend the Window interface to include our calculator property
declare global {
  interface Window {
    calculator: {
      add: (a: number, b: number) => number;
      subtract: (a: number, b: number) => number;
      multiply: (a: number, b: number) => number;
      divide: (a: number, b: number) => number;
      percentage: (a: number, b: number) => number;
    };
  }
}

describe("Browser Calculator with JSDOM", () => {
  // Create a JSDOM instance
  const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
    url: "http://localhost/",
    runScripts: "dangerously", // Allows scripts to run in the JSDOM environment
  });

  // Get the window object from JSDOM and cast it to the right type
  const window = dom.window as unknown as Window & typeof globalThis;

  // Set up the calculator on the window object before all tests
  beforeAll(() => {
    setupBrowserCalculator(window);
  });

  describe("Individual calculator functions", () => {
    it("should add two numbers correctly", () => {
      expect(add(2, 3)).toBe(5);
      expect(add(-1, 1)).toBe(0);
      expect(add(0, 0)).toBe(0);
    });

    it("should subtract two numbers correctly", () => {
      expect(subtract(5, 3)).toBe(2);
      expect(subtract(1, 1)).toBe(0);
      expect(subtract(0, 5)).toBe(-5);
    });

    it("should multiply two numbers correctly", () => {
      expect(multiply(2, 3)).toBe(6);
      expect(multiply(-2, 3)).toBe(-6);
      expect(multiply(0, 5)).toBe(0);
    });

    it("should divide two numbers correctly", () => {
      expect(divide(6, 2)).toBe(3);
      expect(divide(5, 2)).toBe(2.5);
      expect(divide(0, 5)).toBe(0);
    });

    it("should throw error when dividing by zero", () => {
      expect(() => divide(5, 0)).toThrow("Division by zero is not allowed");
    });

    it("should calculate percentage correctly", () => {
      expect(percentage(50, 200)).toBe(25);
      expect(percentage(200, 100)).toBe(200);
      expect(percentage(0, 100)).toBe(0);
    });

    it("should throw error when calculating percentage with zero denominator", () => {
      expect(() => percentage(5, 0)).toThrow("Division by zero is not allowed");
    });
  });

  describe("Browser calculator via window object", () => {
    it("should attach calculator to the window object", () => {
      expect(window.calculator).toBeDefined();
    });

    it("should add two numbers using the window calculator", () => {
      expect(window.calculator.add(2, 3)).toBe(5);
      expect(window.calculator.add(-1, 1)).toBe(0);
    });

    it("should subtract two numbers using the window calculator", () => {
      expect(window.calculator.subtract(5, 3)).toBe(2);
      expect(window.calculator.subtract(0, 5)).toBe(-5);
    });

    it("should multiply two numbers using the window calculator", () => {
      expect(window.calculator.multiply(2, 3)).toBe(6);
      expect(window.calculator.multiply(-2, 3)).toBe(-6);
    });

    it("should divide two numbers using the window calculator", () => {
      expect(window.calculator.divide(6, 2)).toBe(3);
      expect(window.calculator.divide(5, 2)).toBe(2.5);
    });

    it("should calculate percentage using the window calculator", () => {
      expect(window.calculator.percentage(50, 200)).toBe(25);
      expect(window.calculator.percentage(200, 100)).toBe(200);
    });
  });
});
