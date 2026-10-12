// ============================================================================
// SettingsContext.jsx
// ----------------------------------------------------------------------------
// One user preference remembered across visits via localStorage: color
// theme (light/dark). The app is English-only (the earlier Arabic/English
// language switch was removed per the project owner's choice), so `t()`
// always resolves against English — it's kept so components can still call
// t('someKey') without needing to change, in case translations come back.
//
// Any component can read/change the theme with the useSettings() hook
// below, instead of passing props down through every page.
// ============================================================================

import { createContext, useContext, useEffect, useState } from 'react';
import { translate } from './i18n';

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

const LANG = 'en';

export function SettingsProvider({ children }) {
  const [theme, setThemeState] = useState(() => readStored('nf_theme', 'light'));

  useEffect(() => {
    document.documentElement.setAttribute('dir', 'ltr');
    document.documentElement.setAttribute('lang', LANG);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  function setTheme(next) {
    setThemeState(next);
    writeStored('nf_theme', next);
  }

  const t = (key) => translate(LANG, key);

  return (
    <SettingsContext.Provider value={{ theme, setTheme, t }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
