/**
 * Tests for frontend/src/components/LanguageToggle.js
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock useLanguage
const mockChangeLanguage = jest.fn();
let mockLanguage = 'pt-BR';

jest.mock('../../../frontend/src/context/LanguageContext', () => ({
  useLanguage: () => ({
    language: mockLanguage,
    changeLanguage: mockChangeLanguage,
  }),
}));

// Mock lucide-react
jest.mock('lucide-react', () => ({
  Languages: ({ className }) => <span className={className} data-testid="icon-languages">Lang</span>,
}));

import LanguageToggle from '../../../frontend/src/components/LanguageToggle';

const renderToggle = (props = {}) => render(<LanguageToggle {...props} />);

describe('LanguageToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage = 'pt-BR';
  });

  test('renders PT-BR and EN-US buttons', () => {
    renderToggle();
    expect(screen.getByText(/PT-BR/i)).toBeInTheDocument();
    expect(screen.getByText(/EN-US/i)).toBeInTheDocument();
  });

  test('clicking PT-BR button calls changeLanguage with pt-BR', () => {
    renderToggle();
    fireEvent.click(screen.getByText(/PT-BR/i));
    expect(mockChangeLanguage).toHaveBeenCalledWith('pt-BR');
  });

  test('clicking EN-US button calls changeLanguage with en-US', () => {
    renderToggle();
    fireEvent.click(screen.getByText(/EN-US/i));
    expect(mockChangeLanguage).toHaveBeenCalledWith('en-US');
  });

  test('PT-BR button has active style when language is pt-BR', () => {
    mockLanguage = 'pt-BR';
    renderToggle();
    const ptBtn = screen.getByText(/PT-BR/i);
    expect(ptBtn.className).toContain('bg-purple-600');
  });

  test('EN-US button has active style when language is en-US', () => {
    mockLanguage = 'en-US';
    renderToggle();
    const enBtn = screen.getByText(/EN-US/i);
    expect(enBtn.className).toContain('bg-purple-600');
  });

  test('PT-BR button does NOT have active style when language is en-US', () => {
    mockLanguage = 'en-US';
    renderToggle();
    const ptBtn = screen.getByText(/PT-BR/i);
    expect(ptBtn.className).not.toContain('bg-purple-600');
  });

  test('size="sm" applies smaller padding classes', () => {
    renderToggle({ size: 'sm' });
    const ptBtn = screen.getByText(/PT-BR/i);
    expect(ptBtn.className).toContain('px-2');
    expect(ptBtn.className).toContain('py-1');
    expect(ptBtn.className).toContain('text-xs');
  });

  test('size="md" applies larger padding classes', () => {
    renderToggle({ size: 'md' });
    const ptBtn = screen.getByText(/PT-BR/i);
    expect(ptBtn.className).toContain('px-4');
    expect(ptBtn.className).toContain('py-2');
    expect(ptBtn.className).toContain('text-sm');
  });

  test('languages icon is rendered in each button', () => {
    renderToggle();
    const icons = screen.getAllByTestId('icon-languages');
    expect(icons).toHaveLength(2);
  });
});
