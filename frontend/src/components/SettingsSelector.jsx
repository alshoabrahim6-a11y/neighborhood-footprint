// ============================================================================
// SettingsSelector.jsx
// ----------------------------------------------------------------------------
// The light/dark theme toggle shown in the header. (A language selector used
// to live here too; it was removed per the project owner's choice — the app
// is English-only now.)
// ============================================================================

import { useSettings } from '../SettingsContext';

export default function SettingsSelector() {
  const { theme, setTheme, t } = useSettings();

  return (
    <div className="settings-selector no-print">
      <button
        type="button"
        className="theme-toggle-btn"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        aria-label={t('themeLabel')}
        title={t('themeLabel')}
      >
        {theme === 'dark' ? t('themeDark') : t('themeLight')}
      </button>
    </div>
  );
}
