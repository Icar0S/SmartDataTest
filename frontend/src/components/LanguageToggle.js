import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

/**
 * LanguageToggle component.
 * Visual identical to MethodologyPage.js toggle.
 *
 * @param {Object} props
 * @param {'sm'|'md'} props.size - Button size variant.
 */
export default function LanguageToggle({ size = 'sm' }) {
  const { language, changeLanguage } = useLanguage();

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
