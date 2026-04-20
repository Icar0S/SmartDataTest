/**
 * Tests for App.js root component - routing and structure
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock all heavy page components to avoid deep dependencies
jest.mock('../../../frontend/src/components/HomePage', () =>
  function MockHomePage() { return <div data-testid="home-page">HomePage</div>; }
);
jest.mock('../../../frontend/src/pages/SupportPage', () =>
  function MockSupportPage() { return <div data-testid="support-page">SupportPage</div>; }
);
jest.mock('../../../frontend/src/pages/DataAccuracy', () =>
  function MockDataAccuracy() { return <div data-testid="data-accuracy">DataAccuracy</div>; }
);
jest.mock('../../../frontend/src/pages/TestDatasetGold', () =>
  function MockTestDatasetGold() { return <div data-testid="test-gold">TestDatasetGold</div>; }
);
jest.mock('../../../frontend/src/pages/DatasetMetrics', () =>
  function MockDatasetMetrics() { return <div data-testid="dataset-metrics">DatasetMetrics</div>; }
);
jest.mock('../../../frontend/src/pages/QaChecklist', () =>
  function MockQaChecklist() { return <div data-testid="qa-checklist">QaChecklist</div>; }
);
jest.mock('../../../frontend/src/pages/ChecklistPage', () =>
  function MockChecklistPage() { return <div data-testid="checklist-page">ChecklistPage</div>; }
);
jest.mock('../../../frontend/src/pages/GenerateDataset', () =>
  function MockGenerateDataset() { return <div data-testid="generate-dataset">GenerateDataset</div>; }
);
jest.mock('../../../frontend/src/pages/AdvancedPySparkGenerator', () =>
  function MockAdvancedPySpark() { return <div data-testid="advanced-pyspark">AdvancedPySpark</div>; }
);
jest.mock('../../../frontend/src/pages/MethodologyPage', () =>
  function MockMethodologyPage() { return <div data-testid="methodology">MethodologyPage</div>; }
);
jest.mock('../../../frontend/src/pages/LoginPage', () =>
  function MockLoginPage() { return <div data-testid="login-page">LoginPage</div>; }
);
jest.mock('../../../frontend/src/components/SupportButton', () =>
  function MockSupportButton() { return <button data-testid="support-button">Support</button>; }
);
jest.mock('../../../frontend/src/components/ProtectedRoute', () =>
  function MockProtectedRoute({ children }) { return <div data-testid="protected-route">{children}</div>; }
);
jest.mock('../../../frontend/src/context/AuthContext', () => ({
  AuthProvider: ({ children }) => <div>{children}</div>,
  useAuthContext: () => ({ isAuthenticated: true, hasProfile: true, isLoading: false }),
}));
jest.mock('../../../frontend/src/context/LanguageContext', () => ({
  LanguageProvider: ({ children }) => <div>{children}</div>,
  useLanguage: () => ({ language: 'pt-BR', changeLanguage: jest.fn() }),
}));

import App from '../../../frontend/src/App';

describe('App Component', () => {
  test('renders without crashing', () => {
    expect(() => render(<App />)).not.toThrow();
  });

  test('renders the App container div', () => {
    render(<App />);
    const appDiv = document.querySelector('.App');
    expect(appDiv).toBeInTheDocument();
  });

  test('renders SupportButton on default route', () => {
    // window.location.pathname is '/' in jsdom, not '/support-rag'
    render(<App />);
    expect(screen.getByTestId('support-button')).toBeInTheDocument();
  });

  test('renders routes wrapper (Routes structure present)', () => {
    render(<App />);
    // With the manual mock, Routes renders as div and Route as null
    // Just verify the App div contains content
    const appDiv = document.querySelector('.App');
    expect(appDiv).toBeInTheDocument();
    expect(appDiv.children.length).toBeGreaterThan(0);
  });

  test('exports a default function component', () => {
    expect(typeof App).toBe('function');
  });
});


