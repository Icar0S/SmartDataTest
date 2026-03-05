/**
 * Tests for frontend/src/utils/commonTranslations.js
 */

import { commonTranslations } from '../../../frontend/src/utils/commonTranslations';

const EXPECTED_KEYS = [
  'backToHome',
  'loading',
  'error',
  'success',
  'cancel',
  'confirm',
  'save',
  'download',
  'upload',
  'reset',
];

describe('commonTranslations', () => {
  test('is exported as a non-null object', () => {
    expect(commonTranslations).toBeDefined();
    expect(typeof commonTranslations).toBe('object');
    expect(commonTranslations).not.toBeNull();
  });

  test('contains pt-BR locale', () => {
    expect(commonTranslations).toHaveProperty('pt-BR');
  });

  test('contains en-US locale', () => {
    expect(commonTranslations).toHaveProperty('en-US');
  });

  test.each(EXPECTED_KEYS)(
    'pt-BR has non-empty string for key "%s"',
    (key) => {
      expect(typeof commonTranslations['pt-BR'][key]).toBe('string');
      expect(commonTranslations['pt-BR'][key].length).toBeGreaterThan(0);
    }
  );

  test.each(EXPECTED_KEYS)(
    'en-US has non-empty string for key "%s"',
    (key) => {
      expect(typeof commonTranslations['en-US'][key]).toBe('string');
      expect(commonTranslations['en-US'][key].length).toBeGreaterThan(0);
    }
  );

  test('pt-BR and en-US have the same set of keys', () => {
    const ptKeys = Object.keys(commonTranslations['pt-BR']).sort();
    const enKeys = Object.keys(commonTranslations['en-US']).sort();
    expect(ptKeys).toEqual(enKeys);
  });

  test('pt-BR backToHome is in Portuguese', () => {
    expect(commonTranslations['pt-BR'].backToHome).toBe('Voltar para Home');
  });

  test('en-US backToHome is in English', () => {
    expect(commonTranslations['en-US'].backToHome).toBe('Back to Home');
  });

  test('pt-BR loading text matches expected value', () => {
    expect(commonTranslations['pt-BR'].loading).toBe('Carregando...');
  });

  test('en-US loading text matches expected value', () => {
    expect(commonTranslations['en-US'].loading).toBe('Loading...');
  });

  test('translations can be used with fallback pattern', () => {
    const lang = 'en-US';
    const tc = commonTranslations[lang] ?? commonTranslations['en-US'];
    expect(tc.error).toBe('Error');
  });

  test('unknown locale falls back to en-US via nullish coalescing', () => {
    const lang = 'fr-FR';
    const tc = commonTranslations[lang] ?? commonTranslations['en-US'];
    expect(tc).toEqual(commonTranslations['en-US']);
  });
});
