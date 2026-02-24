import React, { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);
  const [step, setStep] = useState(1);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 480, margin: '0 auto' }}>
      <h1>Interactive Counter</h1>
      <p>
        Current count: <strong data-cy="count">{count}</strong>
      </p>

      <label style={{ display: 'block', marginBottom: '1rem' }}>
        Step:
        <input
          data-cy="step-input"
          type="number"
          value={step}
          min="1"
          max="10"
          onChange={(e) => setStep(Number(e.target.value) || 1)}
          style={{ marginLeft: '0.5rem', width: '4rem' }}
        />
      </label>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button data-cy="decrement" onClick={() => setCount((c) => c - step)}>
          -{step}
        </button>
        <button data-cy="increment" onClick={() => setCount((c) => c + step)}>
          +{step}
        </button>
        <button data-cy="reset" onClick={() => setCount(0)}>
          Reset
        </button>
      </div>

      <p style={{ fontSize: '0.9rem', color: '#555' }}>
        Try changing the step value and using the buttons. This app is wired up with Cypress E2E and component tests.
      </p>
    </main>
  );
}

export default App;

