/**
 * Tests for MethodologyPage component
 * Tests rendering of methodology framework content
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import MethodologyPage from '../../../frontend/src/pages/MethodologyPage';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  ArrowLeft: () => <div data-testid="icon-arrow-left">ArrowLeft</div>,
  Lightbulb: () => <div data-testid="icon-lightbulb">Lightbulb</div>,
  FileText: () => <div data-testid="icon-file">FileText</div>,
  Database: () => <div data-testid="icon-database">Database</div>,
  Target: () => <div data-testid="icon-target">Target</div>,
  BarChart3: () => <div data-testid="icon-chart">BarChart3</div>,
  Brain: () => <div data-testid="icon-brain">Brain</div>,
  BookOpen: () => <div data-testid="icon-book">BookOpen</div>,
  ArrowRight: () => <div data-testid="icon-arrow-right">ArrowRight</div>,
  CheckCircle: () => <div data-testid="icon-check">CheckCircle</div>,
  Languages: () => <div data-testid="icon-languages">Languages</div>,
  ArrowDown: () => <div data-testid="icon-arrow-down">ArrowDown</div>,
}));

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }) => <h1 {...props}>{children}</h1>,
    p: ({ children, ...props }) => <p {...props}>{children}</p>,
  },
}));

// Mock animation functions
jest.mock('../../../frontend/src/styles/animations', () => ({
  fadeIn: {},
  slideIn: {},
  staggerContainer: {},
}));

// Mock LanguageContext — MethodologyPage now uses useLanguage() globally
jest.mock('../../../frontend/src/context/LanguageContext', () => ({
  useLanguage: () => ({ language: 'pt-BR', changeLanguage: jest.fn() }),
}));

describe('MethodologyPage', () => {
  const renderWithRouter = (component) => {
    return render(
      <BrowserRouter>
        {component}
      </BrowserRouter>
    );
  };

  test('renders main title correctly', () => {
    renderWithRouter(<MethodologyPage />);
    expect(screen.getByText(/Framework Metodológico para QA em Big Data com Suporte de IA/i)).toBeInTheDocument();
  });

  test('renders subtitle correctly', () => {
    renderWithRouter(<MethodologyPage />);
    expect(screen.getByText(/Modelo de Processo com Camada de Suporte Inteligente Transversal/i)).toBeInTheDocument();
  });

  test('renders AI support layer section', () => {
    renderWithRouter(<MethodologyPage />);
    expect(screen.getByText(/Inteligência e Suporte à Decisão/i)).toBeInTheDocument();
    expect(screen.getByText(/Base de Conhecimento Aprimorada/i)).toBeInTheDocument();
    expect(screen.getByText(/Sistema de Suporte Baseado em LLMs/i)).toBeInTheDocument();
  });

  test('renders all 4 phases', () => {
    renderWithRouter(<MethodologyPage />);
    expect(screen.getByText(/Planejamento e Definição Estratégica/i)).toBeInTheDocument();
    expect(screen.getByText(/Mapeamento e Preparação de Fontes/i)).toBeInTheDocument();
    expect(screen.getByText(/Geração e Execução de Cenários/i)).toBeInTheDocument();
    expect(screen.getByText(/Análise de Resultados e Monitoramento/i)).toBeInTheDocument();
  });

  test('renders quality dimensions section', () => {
    renderWithRouter(<MethodologyPage />);
    expect(screen.getByText(/Dimensões de Qualidade de Dados/i)).toBeInTheDocument();
    expect(screen.getByText(/Completude/i)).toBeInTheDocument();
    expect(screen.getByText(/Unicidade/i)).toBeInTheDocument();
    expect(screen.getByText(/Consistência/i)).toBeInTheDocument();
    expect(screen.getByText(/Validade/i)).toBeInTheDocument();
    expect(screen.getByText(/Integridade/i)).toBeInTheDocument();
    expect(screen.getByText(/Acurácia/i)).toBeInTheDocument();
  });

  test('renders footer with dissertation reference', () => {
    renderWithRouter(<MethodologyPage />);
    expect(screen.getByText(/Framework de Pesquisa Acadêmica/i)).toBeInTheDocument();
  });

  test('renders back to home link', () => {
    renderWithRouter(<MethodologyPage />);
    const backLink = screen.getByText(/Voltar para Home/i);
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest('a')).toHaveAttribute('href', '/');
  });

  test('renders AI support for all phases', () => {
    renderWithRouter(<MethodologyPage />);
    expect(screen.getByText(/Sugestão de regras de validação baseadas em histórico ou padrões da indústria/i)).toBeInTheDocument();
    expect(screen.getByText(/Identificação automática de padrões e anomalias nos metadados/i)).toBeInTheDocument();
    expect(screen.getByText(/Auxílio na criação de prompts para gerar dados sintéticos complexos/i)).toBeInTheDocument();
    expect(screen.getByText(/Interpretação de relatórios e sugestão de correções para falhas detectadas/i)).toBeInTheDocument();
  });

  test('renders framework applicability note', () => {
    renderWithRouter(<MethodologyPage />);
    expect(screen.getByText(/Framework aplicável a dados estruturados e semi-estruturados em ambientes de processamento distribuído/i)).toBeInTheDocument();
  });
});
