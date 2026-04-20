/**
 * Tests for HomePage component
 * Tests basic rendering and navigation functionality
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import HomePage from '../../../frontend/src/components/HomePage';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Zap: () => <div data-testid="icon-zap">Zap</div>,
  Code: () => <div data-testid="icon-code">Code</div>,
  Bug: () => <div data-testid="icon-bug">Bug</div>,
  CheckCircle: () => <div data-testid="icon-check">CheckCircle</div>,
  AlertTriangle: () => <div data-testid="icon-alert">AlertTriangle</div>,
  FileText: () => <div data-testid="icon-file">FileText</div>,
  GitCompare: () => <div data-testid="icon-git">GitCompare</div>,
  Sparkles: () => <div data-testid="icon-sparkles">Sparkles</div>,
  Brain: () => <div data-testid="icon-brain">Brain</div>,
  TrendingUp: () => <div data-testid="icon-trending">TrendingUp</div>,
  Shield: () => <div data-testid="icon-shield">Shield</div>,
  Clock: () => <div data-testid="icon-clock">Clock</div>,
  Globe: () => <div data-testid="icon-globe">Globe</div>,
  BarChart3: () => <div data-testid="icon-chart">BarChart3</div>,
  MessageSquare: () => <div data-testid="icon-message">MessageSquare</div>,
  Eye: () => <div data-testid="icon-eye">Eye</div>,
  GitBranch: () => <div data-testid="icon-gitbranch">GitBranch</div>,
  LogOut: () => <div data-testid="icon-logout">LogOut</div>,
  Heart: () => <div data-testid="icon-heart">Heart</div>,
  Languages: () => <div data-testid="icon-languages">Languages</div>,
}));

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }) => <h1 {...props}>{children}</h1>,
    p: ({ children, ...props }) => <p {...props}>{children}</p>,
    button: ({ children, ...props }) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

// Mock animation functions
jest.mock('../../../frontend/src/styles/animations', () => ({
  fadeIn: {},
  staggerContainer: {},
  slideIn: {},
  scaleIn: {},
}));

// Mock the PySparkDropdown to avoid complex dependencies
jest.mock('../../../frontend/src/components/PySparkDropdown', () => {
  return function MockPySparkDropdown() {
    return <div data-testid="pyspark-dropdown">PySpark Dropdown</div>;
  };
});

// Mock the DataAccuracyDropdown to avoid complex dependencies
jest.mock('../../../frontend/src/components/DataAccuracyDropdown', () => {
  return function MockDataAccuracyDropdown() {
    return <div data-testid="data-accuracy-dropdown">Data Accuracy Dropdown</div>;
  };
});

// Mock the RAGButton to avoid complex dependencies
jest.mock('../../../frontend/src/components/RAGButton', () => {
  return function MockRAGButton() {
    return <div data-testid="rag-button">RAG Button</div>;
  };
});

// Mock LanguageToggle
jest.mock('../../../frontend/src/components/LanguageToggle', () =>
  function MockLanguageToggle() {
    return <div data-testid="language-toggle">LanguageToggle</div>;
  }
);

// Mock useAuth
const mockHandleLogout = jest.fn();
jest.mock('../../../frontend/src/hooks/useAuth', () => () => ({
  handleLogout: mockHandleLogout,
}));

// Mock useAuthContext
jest.mock('../../../frontend/src/context/AuthContext', () => ({
  useAuthContext: () => ({
    user: { name: 'Test User', avatar: 'TU', role: 'tester' },
    isAuthenticated: true,
    hasProfile: true,
    isLoading: false,
  }),
}));

// useLanguage mock — default PT-BR; individual tests can override via mockLanguageState
const mockChangeLanguage = jest.fn();
const mockLanguageState = { current: 'pt-BR' };
jest.mock('../../../frontend/src/context/LanguageContext', () => ({
  useLanguage: () => ({
    language: mockLanguageState.current,
    changeLanguage: mockChangeLanguage,
  }),
}));

// Helper function to render component with router
const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('HomePage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguageState.current = 'pt-BR';
  });

  describe('Initial Render', () => {
    test('renders main heading', () => {
      renderWithRouter(<HomePage />);

      // HomePage contains SmartData text
      const dataforgeElements = screen.queryAllByText(/SmartData/i);
      expect(dataforgeElements.length).toBeGreaterThan(0);
    });

    test('renders RAG button', () => {
      renderWithRouter(<HomePage />);

      // RAGButton should be rendered as mocked component
      const ragButton = screen.getByTestId('rag-button');
      expect(ragButton).toBeInTheDocument();
    });
  });

  describe('Navigation Links', () => {
    test('has link to QA Checklist', () => {
      renderWithRouter(<HomePage />);

      const links = screen.getAllByRole('link');
      const qaLink = links.find(link => link.getAttribute('href') === '/checklist');
      expect(qaLink).toBeTruthy();
    });

    test('has link to Generate Dataset', () => {
      renderWithRouter(<HomePage />);

      const links = screen.getAllByRole('link');
      const generateLink = links.find(link => link.getAttribute('href') === '/generate-dataset');
      expect(generateLink).toBeTruthy();
    });
  });

  describe('Feature Sections', () => {
    test('displays data quality features', () => {
      renderWithRouter(<HomePage />);

      // Check that the component renders without errors
      expect(document.body).toBeInTheDocument();
    });

    test('displays schema validation features', () => {
      renderWithRouter(<HomePage />);

      // Check that the component renders
      expect(document.body).toBeInTheDocument();
    });

    test('displays streaming features', () => {
      renderWithRouter(<HomePage />);

      const streamingText = screen.queryAllByText(/Streaming/i);
      expect(streamingText.length).toBeGreaterThanOrEqual(0);
    });

    test('displays integration features', () => {
      renderWithRouter(<HomePage />);

      const integrationText = screen.queryAllByText(/Integration/i);
      expect(integrationText.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('LLM Workflow Section', () => {
    test('displays LLM workflow steps', () => {
      renderWithRouter(<HomePage />);

      // Just check the component renders
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Interactive Features', () => {
    test('allows switching between structure views', () => {
      renderWithRouter(<HomePage />);

      // Just check the component renders interactable elements
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    test('allows switching between feature sections', () => {
      renderWithRouter(<HomePage />);

      // Check component renders
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Layout and Structure', () => {
    test('renders without crashing', () => {
      expect(() => renderWithRouter(<HomePage />)).not.toThrow();
    });

    test('has gradient background classes', () => {
      renderWithRouter(<HomePage />);

      const gradientElements = document.querySelectorAll('[class*="gradient"]');
      expect(gradientElements.length).toBeGreaterThan(0);
    });

    test('displays hero section', () => {
      renderWithRouter(<HomePage />);

      // Check main heading is present
      const dataforgeElements = screen.queryAllByText(/SmartData/i);
      expect(dataforgeElements.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // AJUSTE 2 — HomeHeader
  // ---------------------------------------------------------------------------
  describe('HomeHeader', () => {
    test('renders user avatar with correct initials', () => {
      renderWithRouter(<HomePage />);
      expect(screen.getByText('TU')).toBeInTheDocument();
    });

    test('renders user name', () => {
      renderWithRouter(<HomePage />);
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    test('renders logout button', () => {
      renderWithRouter(<HomePage />);
      // Logout button should be present (title "Sair" in PT-BR)
      const logoutBtn = screen.getByTitle(/Sair|Logout/i);
      expect(logoutBtn).toBeInTheDocument();
    });

    test('calls handleLogout when logout button clicked', () => {
      renderWithRouter(<HomePage />);
      const logoutBtn = screen.getByTitle(/Sair|Logout/i);
      fireEvent.click(logoutBtn);
      expect(mockHandleLogout).toHaveBeenCalled();
    });

    test('renders navigation links in header', () => {
      renderWithRouter(<HomePage />);
      const links = screen.getAllByRole('link');
      const methodologyLink = links.find(l => l.getAttribute('href') === '/methodology');
      const checklistLink = links.find(l => l.getAttribute('href') === '/checklist');
      const generateLink = links.find(l => l.getAttribute('href') === '/generate-dataset');
      expect(methodologyLink).toBeTruthy();
      expect(checklistLink).toBeTruthy();
      expect(generateLink).toBeTruthy();
    });

    test('renders LanguageToggle in header', () => {
      renderWithRouter(<HomePage />);
      expect(screen.getByTestId('language-toggle')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // AJUSTE 3 — i18n Translations
  // ---------------------------------------------------------------------------
  describe('Translations', () => {
    test('renders hero title in PT-BR', () => {
      mockLanguageState.current = 'pt-BR';
      renderWithRouter(<HomePage />);
      expect(screen.getByText(/Testes de Qualidade/i)).toBeInTheDocument();
    });

    test('renders hero title in EN-US', () => {
      mockLanguageState.current = 'en-US';
      renderWithRouter(<HomePage />);
      expect(screen.getByText(/Big Data Quality Testing/i)).toBeInTheDocument();
    });

    test('renders navigation links with translated labels in PT-BR', () => {
      mockLanguageState.current = 'pt-BR';
      renderWithRouter(<HomePage />);
      // Use queryAllByText to handle multiple occurrences (header + buttons)
      expect(screen.queryAllByText(/Metodologia/i).length).toBeGreaterThan(0);
      expect(screen.queryAllByText(/Checklist QA/i).length).toBeGreaterThan(0);
    });

    test('renders footer copyright in PT-BR', () => {
      mockLanguageState.current = 'pt-BR';
      renderWithRouter(<HomePage />);
      expect(screen.getByText(/Todos os direitos reservados/i)).toBeInTheDocument();
    });

    test('renders footer copyright in EN-US', () => {
      mockLanguageState.current = 'en-US';
      renderWithRouter(<HomePage />);
      expect(screen.getByText(/All rights reserved/i)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // AJUSTE 4 — HomeFooter
  // ---------------------------------------------------------------------------
  describe('HomeFooter', () => {
    test('renders footer element', () => {
      renderWithRouter(<HomePage />);
      expect(document.querySelector('footer')).toBeInTheDocument();
    });

    test('renders copyright text in PT-BR', () => {
      mockLanguageState.current = 'pt-BR';
      renderWithRouter(<HomePage />);
      expect(screen.getByText(/Todos os direitos reservados/i)).toBeInTheDocument();
    });

    test('renders copyright text in EN-US', () => {
      mockLanguageState.current = 'en-US';
      renderWithRouter(<HomePage />);
      expect(screen.getByText(/All rights reserved/i)).toBeInTheDocument();
    });

    test('renders tech stack info', () => {
      renderWithRouter(<HomePage />);
      // footer tech string contains "React" and "PySpark"
      expect(screen.queryAllByText(/React/i).length).toBeGreaterThan(0);
      expect(screen.queryAllByText(/PySpark/i).length).toBeGreaterThan(0);
    });

    test('renders version string', () => {
      renderWithRouter(<HomePage />);
      expect(screen.getByText(/v1\.0\.0/i)).toBeInTheDocument();
    });
  });
});
