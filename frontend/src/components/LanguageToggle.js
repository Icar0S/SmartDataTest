import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const LANGUAGES = [
  { code: 'pt-BR', label: 'PT-BR' },
  { code: 'en-US', label: 'EN-US' },
];

/**
 * LanguageToggle component.
 * Visual identical to MethodologyPage.js toggle; the "glass" variant matches
 * the login and home pages.
 *
 * @param {Object} props
 * @param {'sm'|'md'} props.size - Button size variant.
 * @param {'default'|'glass'} props.variant - Visual style.
 */
export default function LanguageToggle({ size = 'sm', variant = 'default' }) {
  const { language, changeLanguage } = useLanguage();

  if (variant === 'glass') {
    return (
      <div
        data-testid="language-toggle"
        role="group"
        aria-label="Idioma / Language"
        className="glass flex items-center gap-0.5 rounded-full p-1"
      >
        {LANGUAGES.map(({ code, label }) => {
          const active = language === code;
          return (
            <button
              key={code}
              type="button"
              lang={code}
              aria-pressed={active}
              onClick={() => changeLanguage(code)}
              className={`rounded-full px-3 py-1 font-code text-[11px] font-medium tracking-wider transition-all duration-300 ${
                active
                  ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-[0_0_18px_-4px_rgba(192,132,252,0.8)]'
                  : 'text-sdt-muted hover:text-sdt-fg'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  const btnClass = size === 'sm'
    ? 'px-2 py-1 text-xs'
    : 'px-4 py-2 text-sm';

  return (
    <div
      data-testid="language-toggle"
      className="flex items-center gap-2 bg-gray-800/50 backdrop-blur-sm rounded-lg p-1 border border-gray-700/50"
    >
      <button
        onClick={() => changeLanguage('pt-BR')}
        className={`${btnClass} rounded-md transition-all flex items-center gap-1 ${
          language === 'pt-BR' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
        }`}
      >
        <Languages className="w-4 h-4" />
        PT-BR
      </button>
      <button
        onClick={() => changeLanguage('en-US')}
        className={`${btnClass} rounded-md transition-all flex items-center gap-1 ${
          language === 'en-US' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
        }`}
      >
        <Languages className="w-4 h-4" />
        EN-US
      </button>
    </div>
  );
}
