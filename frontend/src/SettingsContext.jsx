// ============================================================================
// SettingsContext.jsx
// ----------------------------------------------------------------------------
// Two small, independent user preferences, both remembered across visits
// via localStorage: UI language (ar/en) and color theme (light/dark).
//
// Any component can read/change these with the useSettings() hook below,
// instead of passing props down through every page.
// ============================================================================

import { createContext, useContext, useEffect, useState } from 'react';
import { LANGUAGES, translate } from './i18n';

const SettingsContext = createContext(null);

function readStored(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback; // localStorage can throw in some browser contexts (private mode, etc.)
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // non-fatal — the preference just won't persist this session
  }
}

export function SettingsProvider({ children }) {
  const [lang, setLangState] = useState(() => readStored('nf_lang', 'en'));
  const [theme, setThemeState] = useState(() => readStored('nf_theme', 'light'));

  // Reflect both preferences onto <html> so plain CSS (dir, [data-theme])
  // can react to them without every component needing to know.
  useEffect(() => {
    document.documentElement.setAttribute('dir', LANGUAGES[lang]?.dir || 'ltr');
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  function setLang(next) {
    setLangState(next);
    writeStored('nf_lang', next);
  }

  function setTheme(next) {
    setThemeState(next);
    writeStored('nf_theme', next);
  }

  const t = (key) => translate(lang, key);

  return (
    <SettingsContext.Provider value={{ lang, setLang, theme, setTheme, t }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
