/**
 * Tests for frontend/src/context/LanguageContext.js
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { LanguageProvider, useLanguage } from '../../../frontend/src/context/LanguageContext';

const LANG_KEY = 'smartdatatest_language';

beforeEach(() => {
  localStorage.clear();
  jest.restoreAllMocks();
});

const ConsumerComponent = () => {
  const { language, changeLanguage } = useLanguage();
  return (
    <div>
      <span data-testid="lang">{language}</span>
      <button onClick={() => changeLanguage('en-US')}>Switch EN</button>
      <button onClick={() => changeLanguage('pt-BR')}>Switch PT</button>
    </div>
  );
};

describe('LanguageContext', () => {
  test('default language is pt-BR', () => {
    render(
      <LanguageProvider>
        <ConsumerComponent />
      </LanguageProvider>
    );
    expect(screen.getByTestId('lang').textContent).toBe('pt-BR');
  });

  test('changeLanguage updates state', async () => {
    render(
      <LanguageProvider>
        <ConsumerComponent />
      </LanguageProvider>
    );
    await act(async () => {
      userEvent.click(screen.getByText('Switch EN'));
    });
    expect(screen.getByTestId('lang').textContent).toBe('en-US');
  });

  test('changeLanguage persists to localStorage', async () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
    render(
      <LanguageProvider>
        <ConsumerComponent />
      </LanguageProvider>
    );
    await act(async () => {
      userEvent.click(screen.getByText('Switch EN'));
    });
    expect(setItemSpy).toHaveBeenCalledWith(LANG_KEY, 'en-US');
  });

  test('initializes from localStorage if key exists', () => {
    localStorage.setItem(LANG_KEY, 'en-US');
    render(
      <LanguageProvider>
        <ConsumerComponent />
      </LanguageProvider>
    );
    expect(screen.getByTestId('lang').textContent).toBe('en-US');
  });

  test('useLanguage throws error outside LanguageProvider', () => {
    const originalError = console.error;
    console.error = jest.fn();
    const BrokenComponent = () => {
      useLanguage();
      return null;
    };
    expect(() => render(<BrokenComponent />)).toThrow();
    console.error = originalError;
  });
});
