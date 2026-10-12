// ============================================================================
// i18n.js
// ----------------------------------------------------------------------------
// A small, dependency-free translation dictionary for Arabic / English.
//
// Honest scope note: this covers the app's main chrome (header, nav tabs,
// login bar, the settings selectors themselves) — the parts every page
// shares. It does NOT yet translate the text inside every individual page
// (upload form fields, admin panel, statistics labels, etc.) — that's a
// much bigger job (every component would need its strings pulled out and
// added here). Adding a new page's strings is just a matter of adding keys
// here and calling t('yourKey') in that component, following the same
// pattern as App.jsx / AuthPanel.jsx.
// ============================================================================

export const LANGUAGES = {
  en: { code: 'en', label: 'English', dir: 'ltr' },
  ar: { code: 'ar', label: 'العربية', dir: 'rtl' },
};

const dict = {
  appTitle: { en: 'Neighborhood Footprint', ar: 'بصمة الحي' },
  appSubtitle: {
    en: 'Community-driven environmental pollution monitoring',
    ar: 'رصد التلوث البيئي بمشاركة سكان الحي',
  },
  tabMap: { en: '🗺️ Map', ar: '🗺️ الخريطة' },
  tabUpload: { en: '📸 Report Pollution', ar: '📸 بلّغ عن تلوث' },
  tabBoard: { en: '🏆 Neighborhood Points', ar: '🏆 نقاط الحي' },
  tabStats: { en: '📈 Statistics', ar: '📈 الإحصائيات' },
  tabAbout: { en: '📖 About', ar: '📖 عن المشروع' },
  tabAdmin: { en: '🛡️ Admin', ar: '🛡️ لوحة الإدارة' },
  tabReports: { en: '📊 Reports', ar: '📊 التقارير' },
  offlineBanner: {
    en: "📴 You're currently offline — the data shown may be the last version saved on your device. Submitting a new report or logging in requires an internet connection.",
    ar: '📴 أنت غير متصل بالإنترنت حالياً — البيانات المعروضة قد تكون آخر نسخة محفوظة على جهازك. إرسال بلاغ جديد أو تسجيل الدخول يحتاج اتصال بالإنترنت.',
  },
  authHint: {
    en: 'You can report without logging in, but logging in lets you track your reports',
    ar: 'تقدر تبلّغ بدون تسجيل دخول، بس تسجيل الدخول بيخليك تتابع بلاغاتك',
  },
  authLoginOrSignup: { en: 'Log In / New Account', ar: 'تسجيل الدخول / حساب جديد' },
  authLogout: { en: 'Log Out', ar: 'تسجيل الخروج' },
  languageLabel: { en: 'Language', ar: 'اللغة' },
  themeLabel: { en: 'Theme', ar: 'المظهر' },
  themeLight: { en: '☀️ Light', ar: '☀️ فاتح' },
  themeDark: { en: '🌙 Dark', ar: '🌙 داكن' },
  mapTapToInteract: {
    en: '👆 Tap to interact with the map',
    ar: '👆 دوس للتفاعل مع الخريطة',
  },
};

export function translate(lang, key) {
  const entry = dict[key];
  if (!entry) return key;
  return entry[lang] || entry.en || key;
}
