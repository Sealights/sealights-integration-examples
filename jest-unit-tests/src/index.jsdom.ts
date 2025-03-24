/**
 * Calculator functions for browser usage with JSDOM
 * These functions will be attached to the window object
 */

/**
 * Add two numbers
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Subtract b from a
 */
export function subtract(a: number, b: number): number {
  return a - b;
}

/**
 * Multiply two numbers
 */
export function multiply(a: number, b: number): number {
  return a * b;
}

/**
 * Divide a by b
 */
export function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error("Division by zero is not allowed");
  }
  return a / b;
}

/**
 * Calculate the percentage: (a / b) * 100
 */
export function percentage(a: number, b: number): number {
  if (b === 0) {
    throw new Error("Division by zero is not allowed");
  }
  return (a / b) * 100;
}

/**
 * Attach all calculator functions to the window object
 */
export function setupBrowserCalculator(
  windowObj: Window & typeof globalThis
): void {
  // Create a calculator namespace on the window object
  const calculator = {
    add,
    subtract,
    multiply,
    divide,
    percentage,
  };

  // Attach the calculator to window
  (windowObj as any).calculator = calculator;
}
