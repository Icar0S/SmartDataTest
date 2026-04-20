import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import QaChecklist from '../../../frontend/src/pages/QaChecklist';

// Use manual mock for react-router-dom
jest.mock('react-router-dom');

// Mock fetch
global.fetch = jest.fn();

// Mock react-syntax-highlighter
jest.mock('react-syntax-highlighter', () => ({
  Prism: function SyntaxHighlighter({ children }) {
    return <pre data-testid="syntax-highlighter">{children}</pre>;
  }
}));

jest.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  materialDark: {}
}));

// Helper to render component
const renderComponent = (component) => {
  return render(component);
};

describe('QaChecklist Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockClear();
  });

  test('renders QaChecklist page with all elements', () => {
    renderComponent(<QaChecklist />);
    
    expect(screen.getByText('Checklist de Testes QA')).toBeInTheDocument();
    expect(screen.getByText('Back to Home')).toBeInTheDocument();
    expect(screen.getByText('Limpar')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Digite sua resposta/)).toBeInTheDocument();
  });

  test('auto-focuses on input field when page loads', () => {
    renderComponent(<QaChecklist />);
    
    const textarea = screen.getByPlaceholderText(/Digite sua resposta/);
    expect(textarea).toHaveFocus();
  });

  test('displays first question from General section', () => {
    renderComponent(<QaChecklist />);
    
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText(/What is the name of the dataset you want to validate/)).toBeInTheDocument();
  });

  test('shows progress bar', () => {
    renderComponent(<QaChecklist />);
    
    expect(screen.getByText(/Questão 1 de/)).toBeInTheDocument();
    expect(screen.getByText(/concluído/)).toBeInTheDocument();
  });

  test('navigates to next question when Próxima is clicked', () => {
    renderComponent(<QaChecklist />);
    
    const textarea = screen.getByPlaceholderText(/Digite sua resposta/);
    const nextButton = screen.getByRole('button', { name: /Próxima/i });
    
    // Answer first question
    fireEvent.change(textarea, { target: { value: 'my_dataset' } });
    fireEvent.click(nextButton);
    
    // Should show second question
    expect(screen.getByText(/What is the source of the data/)).toBeInTheDocument();
  });

  test('moves to next question when Enter is pressed', () => {
    renderComponent(<QaChecklist />);
    
    const textarea = screen.getByPlaceholderText(/Digite sua resposta/);
    
    // Type answer
    fireEvent.change(textarea, { target: { value: 'my_dataset' } });
    
    // Press Enter key
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    
    // Should show second question
    expect(screen.getByText(/What is the source of the data/)).toBeInTheDocument();
  });

  test('creates new line when Shift+Enter is pressed', () => {
    renderComponent(<QaChecklist />);
    
    const textarea = screen.getByPlaceholderText(/Digite sua resposta/);
    const initialQuestion = screen.getByText(/What is the name of the dataset you want to validate/);
    
    // Type initial text
    fireEvent.change(textarea, { target: { value: 'Line 1' } });
    
    // Press Shift+Enter - should NOT move to next question
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    
    // Should still be on same question
    expect(initialQuestion).toBeInTheDocument();
  });

  test('back button navigates to home page', () => {
    renderComponent(<QaChecklist />);
    
    const backButton = screen.getByRole('link', { name: /Back to Home/i });
    expect(backButton).toHaveAttribute('href', '/');
  });

  test('Previous button is disabled on first question', () => {
    renderComponent(<QaChecklist />);
    
    const prevButton = screen.getByRole('button', { name: /Anterior/i });
    expect(prevButton).toBeDisabled();
  });

  test('Previous button works after moving forward', () => {
    renderComponent(<QaChecklist />);
    
    const textarea = screen.getByPlaceholderText(/Digite sua resposta/);
    const nextButton = screen.getByRole('button', { name: /Próxima/i });
    
    // Answer and move to second question
    fireEvent.change(textarea, { target: { value: 'my_dataset' } });
    fireEvent.click(nextButton);
    
    expect(screen.getByText(/What is the source of the data/)).toBeInTheDocument();
    
    // Go back
    const prevButton = screen.getByRole('button', { name: /Anterior/i });
    fireEvent.click(prevButton);
    
    // Should be back to first question
    expect(screen.getByText(/What is the name of the dataset you want to validate/)).toBeInTheDocument();
  });

  test('submits form and displays results on last question', async () => {
    // Mock successful API response
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        dsl: { dataset: { name: 'test' }, rules: [] },
        pyspark_code: 'print("test")',
        errors: [],
        warnings: []
      })
    });

    renderComponent(<QaChecklist />);
    
    const textarea = screen.getByPlaceholderText(/Digite sua resposta/);
    
    // Navigate to last question by going through all 14 questions
    // There are 14 questions total (3+3+3+4+1)
    for (let i = 0; i < 13; i++) {
      fireEvent.change(textarea, { target: { value: `answer${i}` } });
      const nextButton = screen.getByRole('button', { name: /Próxima/i });
      fireEvent.click(nextButton);
    }
    
    // Should now be on last question
    expect(screen.getByText(/relationships between two columns/)).toBeInTheDocument();
    
    // Fill and submit
    fireEvent.change(textarea, { target: { value: 'start_date:<:end_date' } });
    const submitButton = screen.getByRole('button', { name: /Gerar JSON e PySpark/i });
    fireEvent.click(submitButton);
    
    // Should show success message and results
    await waitFor(() => {
      expect(screen.getByText(/JSON e código PySpark gerados com sucesso/)).toBeInTheDocument();
    });
    
    expect(screen.getByText('JSON')).toBeInTheDocument();
    expect(screen.getByText('Código PySpark')).toBeInTheDocument();
  });

  test('clears form when Limpar button is clicked', () => {
    renderComponent(<QaChecklist />);
    
    const textarea = screen.getByPlaceholderText(/Digite sua resposta/);
    const nextButton = screen.getByRole('button', { name: /Próxima/i });
    
    // Answer first question and move forward
    fireEvent.change(textarea, { target: { value: 'my_dataset' } });
    fireEvent.click(nextButton);
    
    // Should be on second question
    expect(screen.getByText(/What is the source of the data/)).toBeInTheDocument();
    
    // Click Limpar
    const clearButton = screen.getByRole('button', { name: /Limpar conversa/i });
    fireEvent.click(clearButton);
    
    // Should be back to first question
    expect(screen.getByText(/What is the name of the dataset you want to validate/)).toBeInTheDocument();
    expect(screen.getByText(/Questão 1 de/)).toBeInTheDocument();
  });

  test('handles responsive layout classes', () => {
    renderComponent(<QaChecklist />);
    
    // Find the main container with the responsive classes by looking for the container with both classes
    const containers = document.querySelectorAll('.max-w-5xl.lg\\:max-w-7xl');
    expect(containers.length).toBeGreaterThan(0);
    expect(containers[0]).toHaveClass('max-w-5xl');
    expect(containers[0]).toHaveClass('lg:max-w-7xl');
  });

  test('textarea has proper accessibility attributes', () => {
    renderComponent(<QaChecklist />);
    
    const textarea = screen.getByPlaceholderText(/Digite sua resposta/);
    expect(textarea).toHaveAttribute('aria-label', 'Campo de mensagem');
  });

  test('displays error message when API fails', async () => {
    // Mock failed API response
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'API error' })
    });

    renderComponent(<QaChecklist />);
    
    const textarea = screen.getByPlaceholderText(/Digite sua resposta/);
    
    // Navigate to last question
    for (let i = 0; i < 13; i++) {
      fireEvent.change(textarea, { target: { value: `answer${i}` } });
      const nextButton = screen.getByRole('button', { name: /Próxima/i });
      fireEvent.click(nextButton);
    }
    
    // Submit on last question
    fireEvent.change(textarea, { target: { value: 'start_date:<:end_date' } });
    const submitButton = screen.getByRole('button', { name: /Gerar JSON e PySpark/i });
    fireEvent.click(submitButton);
    
    // Should show error
    await waitFor(() => {
      expect(screen.getByText(/Failed to generate JSON and PySpark code/)).toBeInTheDocument();
    });
  });

  test('preserves answers when navigating back and forth', () => {
    renderComponent(<QaChecklist />);
    
    const textarea = screen.getByPlaceholderText(/Digite sua resposta/);
    const nextButton = screen.getByRole('button', { name: /Próxima/i });
    
    // Answer first question
    fireEvent.change(textarea, { target: { value: 'my_dataset' } });
    fireEvent.click(nextButton);
    
    // Answer second question
    fireEvent.change(textarea, { target: { value: 'my_source' } });
    fireEvent.click(nextButton);
    
    // Go back twice
    const prevButton = screen.getByRole('button', { name: /Anterior/i });
    fireEvent.click(prevButton);
    fireEvent.click(prevButton);
    
    // First answer should be preserved
    expect(textarea.value).toBe('my_dataset');
  });
});
