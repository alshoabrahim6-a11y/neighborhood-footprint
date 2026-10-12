// ============================================================================
// SettingsSelector.jsx
// ----------------------------------------------------------------------------
// The language (AR/EN) and theme (light/dark) selectors shown in the header.
// ============================================================================

import { useSettings } from '../SettingsContext';
import { LANGUAGES } from '../i18n';

export default function SettingsSelector() {
  const { lang, setLang, theme, setTheme, t } = useSettings();

  return (
    <div className="settings-selector no-print">
      <label className="settings-field">
        <span className="sr-only">{t('languageLabel')}</span>
        <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t('languageLabel')}>
          {Object.values(LANGUAGES).map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </label>

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
