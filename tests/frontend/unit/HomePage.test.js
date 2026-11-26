/**
 * Tests for HomePage component
 * Tests rendering, navigation, the interactive sections and translations.
 */

import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import HomePage from '../../../frontend/src/components/HomePage';

// Any icon renders as an empty span.
jest.mock('lucide-react', () => new Proxy({}, { get: () => () => <span /> }));

// Mock LanguageToggle
jest.mock('../../../frontend/src/components/LanguageToggle', () =>
  function MockLanguageToggle() {
    return <div data-testid="language-toggle">LanguageToggle</div>;
  }
);

// The live numbers, without a network
jest.mock('../../../frontend/src/hooks/useStats', () => () => ({
  tests: '1012+',
  datasets: '1180+',
  coverage: '86%',
  responseSla: '<2s',
}));

// Mock useAuth
const mockHandleLogout = jest.fn();
jest.mock('../../../frontend/src/hooks/useAuth', () => () => ({
  handleLogout: mockHandleLogout,
}));

// Mock useAuthContext
const mockUser = { current: { name: 'Test User', avatar: 'TU', isAdmin: false } };
jest.mock('../../../frontend/src/context/AuthContext', () => ({
  useAuthContext: () => ({
    user: mockUser.current,
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

const hrefs = () => screen.getAllByRole('link').map((link) => link.getAttribute('href'));

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

    test('names the page with one top-level heading', () => {
      renderWithRouter(<HomePage />);
      const headings = screen.getAllByRole('heading', { level: 1 });
      expect(headings).toHaveLength(1);
      expect(headings[0]).toHaveAccessibleName(/SmartDataTest.*Testes de Qualidade para Big Data/);
    });

    test('links to the RAG assistant', () => {
      renderWithRouter(<HomePage />);
      expect(hrefs()).toContain('/support-rag');
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

    test('the header link to Generate Dataset has a label', () => {
      renderWithRouter(<HomePage />);
      const nav = screen.getAllByRole('navigation', { name: 'Navegação principal' })[0];
      expect(within(nav).getByRole('link', { name: 'Gerar Dataset' })).toHaveAttribute(
        'href',
        '/generate-dataset'
      );
    });

    test('every module can be opened from its card', () => {
      renderWithRouter(<HomePage />);
      const routes = [
        '/qa-checklist',
        '/pyspark/advanced',
        '/data-accuracy',
        '/data-accuracy/test-gold',
        '/data-accuracy/metrics',
        '/checklist',
        '/generate-dataset',
        '/support-rag',
        '/methodology',
      ];
      const modules = document.getElementById('modulos');
      const inModules = within(modules)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href'));
      routes.forEach((route) => expect(inModules).toContain(route));
    });

    test('"explore modules" scrolls to the modules', () => {
      renderWithRouter(<HomePage />);
      const scroll = Element.prototype.scrollIntoView;
      scroll.mockClear();
      fireEvent.click(screen.getByRole('link', { name: /Explorar módulos/ }));
      expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
      expect(scroll.mock.instances[0]).toBe(document.getElementById('modulos'));
    });
  });

  describe('Feature Sections', () => {
    test('displays data quality features', () => {
      renderWithRouter(<HomePage />);

      expect(screen.getByText('NULL_VALUE')).toBeInTheDocument();
      expect(screen.getByText('MISSING_FK')).toBeInTheDocument();
    });

    test('displays the live platform numbers', () => {
      renderWithRouter(<HomePage />);
      const stats = screen.getByRole('region', { name: 'A plataforma em números' });
      expect(within(stats).getByText('1.012+')).toBeInTheDocument();
      expect(within(stats).getByText('86%')).toBeInTheDocument();
      expect(within(stats).getByText('<2s')).toBeInTheDocument();
    });

    test('displays streaming features', () => {
      renderWithRouter(<HomePage />);

      const streamingText = screen.queryAllByText(/Streaming/i);
      expect(streamingText.length).toBeGreaterThan(0);
    });

    test('displays integration features', () => {
      renderWithRouter(<HomePage />);

      const integrationText = screen.queryAllByText(/Integração/i);
      expect(integrationText.length).toBeGreaterThan(0);
    });
  });

  describe('LLM Workflow Section', () => {
    test('displays LLM workflow steps', () => {
      renderWithRouter(<HomePage />);

      expect(screen.getByText('LLM 1 · Geração do dataset')).toBeInTheDocument();
      expect(screen.getByText('Avaliação e métricas')).toBeInTheDocument();
      // The class names it mentions are set as code.
      expect(screen.getAllByText('ComparisonResult').some((node) => node.tagName === 'CODE')).toBe(true);
    });
  });

  describe('Interactive Features', () => {
    const structureTabs = () => within(screen.getByRole('tablist', { name: 'Estruturas de dados' })).getAllByRole('tab');
    const structurePanel = () => document.getElementById('structure-panel');

    test('allows switching between structure views', () => {
      renderWithRouter(<HomePage />);
      expect(structureTabs()).toHaveLength(8);
      expect(within(structurePanel()).getByText('generation_prompt')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('tab', { name: /ComparisonResult/ }));

      expect(screen.getByRole('tab', { name: /ComparisonResult/ })).toHaveAttribute('aria-selected', 'true');
      expect(within(structurePanel()).getByText('f1_score')).toBeInTheDocument();
      expect(within(structurePanel()).queryByText('generation_prompt')).not.toBeInTheDocument();
    });

    test('structure tabs follow the keyboard', () => {
      renderWithRouter(<HomePage />);
      const [first] = structureTabs();

      fireEvent.keyDown(first, { key: 'ArrowDown' });
      expect(structureTabs()[1]).toHaveAttribute('aria-selected', 'true');
      expect(structureTabs()[1]).toHaveFocus();

      fireEvent.keyDown(structureTabs()[1], { key: 'End' });
      expect(structureTabs()[7]).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(structureTabs()[7], { key: 'ArrowRight' });
      expect(structureTabs()[0]).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(structureTabs()[0], { key: 'ArrowUp' });
      expect(structureTabs()[7]).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(structureTabs()[7], { key: 'Home' });
      expect(structureTabs()[0]).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(structureTabs()[0], { key: 'a' });
      expect(structureTabs()[0]).toHaveAttribute('aria-selected', 'true');
    });

    test('only the selected tab is in the tab order', () => {
      renderWithRouter(<HomePage />);
      const tabIndexes = structureTabs().map((tab) => tab.getAttribute('tabindex'));
      expect(tabIndexes.filter((value) => value === '0')).toHaveLength(1);
    });

    test('allows switching between feature sections', () => {
      renderWithRouter(<HomePage />);
      const panel = document.getElementById('roadmap-panel');
      expect(within(panel).getByText('Detecção inteligente de evolução de schema')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('tab', { name: /Streaming e tempo real/ }));

      expect(within(panel).getByText('Engenharia do caos')).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Streaming e tempo real/ })).toHaveAttribute('aria-selected', 'true');

      fireEvent.keyDown(screen.getByRole('tab', { name: /Streaming e tempo real/ }), { key: 'ArrowLeft' });
      expect(screen.getByRole('tab', { name: /Testes de ML e analytics/ })).toHaveAttribute('aria-selected', 'true');
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
      expect(document.getElementById('inicio')).toBeInTheDocument();
    });

    test('shows reading progress', () => {
      renderWithRouter(<HomePage />);
      expect(screen.getByTestId('scroll-progress')).toBeInTheDocument();
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

    test('turns solid once the page scrolls', () => {
      renderWithRouter(<HomePage />);
      const header = document.querySelector('header');
      expect(header.className).not.toContain('glass-strong');
      const scrollTo = (y) =>
        act(() => {
          Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true });
          window.dispatchEvent(new Event('scroll'));
        });
      scrollTo(200);
      expect(header.className).toContain('glass-strong');
      scrollTo(0);
      expect(header.className).not.toContain('glass-strong');
    });
  });

  describe('mobile menu', () => {
    const toggle = () => screen.getByRole('button', { name: /Abrir menu|Fechar menu/ });

    test('opens and closes', () => {
      renderWithRouter(<HomePage />);
      expect(toggle()).toHaveAttribute('aria-expanded', 'false');
      expect(document.getElementById('home-mobile-nav')).toBeNull();

      fireEvent.click(toggle());

      expect(toggle()).toHaveAttribute('aria-expanded', 'true');
      expect(toggle()).toHaveAccessibleName('Fechar menu');
      const menu = document.getElementById('home-mobile-nav');
      expect(within(menu).getByRole('link', { name: 'Metodologia' })).toHaveAttribute('href', '/methodology');

      fireEvent.click(toggle());
      expect(document.getElementById('home-mobile-nav')).toBeNull();
    });

    test('closes with Escape', () => {
      renderWithRouter(<HomePage />);
      fireEvent.click(toggle());
      fireEvent.keyDown(window, { key: 'Enter' });
      expect(document.getElementById('home-mobile-nav')).not.toBeNull();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(document.getElementById('home-mobile-nav')).toBeNull();
    });

    test('closes when a link is followed', () => {
      renderWithRouter(<HomePage />);
      fireEvent.click(toggle());
      fireEvent.click(within(document.getElementById('home-mobile-nav')).getByRole('link', { name: 'Checklist QA' }));
      expect(document.getElementById('home-mobile-nav')).toBeNull();
    });

    test('jumps to the modules', () => {
      renderWithRouter(<HomePage />);
      fireEvent.click(toggle());
      fireEvent.click(within(document.getElementById('home-mobile-nav')).getByRole('link', { name: 'Módulos' }));
      expect(document.getElementById('home-mobile-nav')).toBeNull();
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
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

    test('renders the sections in English too', () => {
      mockLanguageState.current = 'en-US';
      renderWithRouter(<HomePage />);
      expect(screen.getByRole('heading', { name: 'Everything to test your data, in one place' })).toBeInTheDocument();
      expect(screen.getByText('Missing values in required fields')).toBeInTheDocument();
      // Once under the name for phones, once in its own column from md up.
      expect(
        within(document.getElementById('structure-panel')).getAllByText('Unique dataset identifier')
      ).toHaveLength(2);
    });

    test('falls back to English for an unknown language', () => {
      mockLanguageState.current = 'fr-FR';
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

    test('renders the version this build was stamped with', () => {
      renderWithRouter(<HomePage />);
      // "dev" outside the deploy pipeline. It used to be a hard-coded v1.0.0,
      // whatever the release.
      expect(screen.getByText('dev · 2026')).toBeInTheDocument();
    });
  });

  describe('operator panel link', () => {
    afterEach(() => {
      mockUser.current = { name: 'Test User', avatar: 'TU', isAdmin: false };
    });

    test('is shown to administrators', () => {
      mockUser.current = { ...mockUser.current, isAdmin: true };
      renderWithRouter(<HomePage />);
      expect(screen.getByTitle('Usuários e acessos')).toHaveAttribute('href', '/admin');
    });

    test('is not shown to anyone else', () => {
      renderWithRouter(<HomePage />);
      expect(screen.queryByTitle('Usuários e acessos')).not.toBeInTheDocument();
    });

    test('shows a placeholder before the profile has loaded', () => {
      mockUser.current = null;
      renderWithRouter(<HomePage />);
      expect(screen.getByText('?')).toBeInTheDocument();
    });
  });

describe('hero parallax', () => {
  const originalFrame = window.requestAnimationFrame;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.requestAnimationFrame = (callback) => {
      callback(0);
      return 1;
    };
  });

  afterEach(() => {
    window.requestAnimationFrame = originalFrame;
    window.matchMedia = originalMatchMedia;
    if (!originalMatchMedia) delete window.matchMedia;
  });

  const move = (node) => {
    node.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 500 });
    act(() => {
      node.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 750, clientY: 125 }));
    });
  };

  test('follows the mouse', () => {
    renderWithRouter(<HomePage />);
    const hero = document.getElementById('inicio');
    move(hero);
    expect(hero.style.getPropertyValue('--mx')).toBe('0.250');
    expect(hero.style.getPropertyValue('--my')).toBe('-0.250');
  });

  test('holds still for people who prefer reduced motion', () => {
    window.matchMedia = (query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    renderWithRouter(<HomePage />);
    const hero = document.getElementById('inicio');
    move(hero);
    expect(hero.style.getPropertyValue('--mx')).toBe('');
  });
});
});
