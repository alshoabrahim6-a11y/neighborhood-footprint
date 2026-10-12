// ============================================================================
// App.jsx — the frontend's entry point
// ----------------------------------------------------------------------------
// Instead of using a full routing library, we use simple "tabs" (just state)
// to navigate between: the map, reporting pollution, the neighborhood points
// board, and the admin panel (shown only to admins). Navigation is a left
// sidebar on wide screens that collapses into a horizontal bar on narrow
// screens, rather than a top tab strip.
//
// We also track "login" (session) state centrally: as soon as the page
// opens, we fetch any session already saved (if the user logged in before
// and closed the browser), and we listen for any change (login/logout) via
// supabase.auth.onAuthStateChange.
//
// Whenever the session changes, we ask the backend "is this account an
// admin?" — this check is only so we know whether to show the "Admin" tab
// or not (a nicer user experience); the real protection lives on the
// backend (requireAdmin middleware) regardless of what the UI shows.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import MapView from './components/MapView';
import UploadForm from './components/UploadForm';
import NeighborhoodBoard from './components/NeighborhoodBoard';
import AuthPanel from './components/AuthPanel';
import AdminPanel from './components/AdminPanel';
import ReportsView from './components/ReportsView';
import AboutPage from './components/AboutPage';
import StatsDashboard from './components/StatsDashboard';
import SettingsSelector from './components/SettingsSelector';
import { checkIsAdmin } from './api';
import { supabase } from './supabaseClient';
import { useSettings } from './SettingsContext';
import './App.css';

// Tab labels come from the translation dictionary (t()) instead of being
// hardcoded here, so they follow the selected language — see src/i18n.js.
const BASE_TAB_KEYS = {
  map: { labelKey: 'tabMap', component: MapView },
  upload: { labelKey: 'tabUpload', component: UploadForm },
  board: { labelKey: 'tabBoard', component: NeighborhoodBoard },
  stats: { labelKey: 'tabStats', component: StatsDashboard },
  about: { labelKey: 'tabAbout', component: AboutPage },
};

export default function App() {
  const { t } = useSettings();
  const [activeTab, setActiveTab] = useState('map');
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // ------------------------------------------------------------------
  // Offline support (PWA): we track internet connectivity via
  // navigator.onLine + the browser's 'online'/'offline' events, so we can
  // show a clear warning to the user when the connection drops — the data
  // shown at that point is the last version saved locally (Service
  // Worker), not live.
  // ------------------------------------------------------------------
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    // 1) Fetch any session already saved in the browser (localStorage) when the page opens
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    // 2) Listen for any login-state change (new login, logout, session refresh...)
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setIsAdmin(false);
      return;
    }
    checkIsAdmin(session.access_token).then(setIsAdmin);
  }, [session]);

  // The "Admin" tab only shows up if the user is actually an admin.
  // useMemo so we don't create a new object on every render, otherwise the
  // useEffect below would run unnecessarily every time.
  const TABS = useMemo(() => {
    const base = isAdmin
      ? {
          ...BASE_TAB_KEYS,
          admin: { labelKey: 'tabAdmin', component: AdminPanel },
          reports: { labelKey: 'tabReports', component: ReportsView },
        }
      : BASE_TAB_KEYS;

    // Resolve each tab's translated label now, so the rest of the render
    // below doesn't need to know about labelKey vs label.
    return Object.fromEntries(
      Object.entries(base).map(([key, tab]) => [key, { ...tab, label: t(tab.labelKey) }])
    );
  }, [isAdmin, t]);

  // If we were on the "Admin" tab and the user then logs out (or turns out
  // not to be an admin), send them back automatically to the map tab
  // instead of leaving an empty screen.
  useEffect(() => {
    if (!TABS[activeTab]) setActiveTab('map');
  }, [TABS, activeTab]);

  const ActiveComponent = TABS[activeTab]?.component || MapView;

  return (
    <div className="app-shell">
      <aside className="app-sidebar no-print">
        <div className="sidebar-brand">
          <span className="sidebar-brand-icon" aria-hidden="true">🌿</span>
          <div>
            <div className="sidebar-brand-title">{t('appTitle')}</div>
            <div className="sidebar-brand-subtitle">{t('appSubtitle')}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {Object.entries(TABS).map(([key, tab]) => (
            <button
              key={key}
              className={key === activeTab ? 'sidebar-link active' : 'sidebar-link'}
              onClick={() => setActiveTab(key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <SettingsSelector />
        </div>
      </aside>

      <div className="app-content">
        {!isOnline && <div className="offline-banner no-print">{t('offlineBanner')}</div>}

        <div className="no-print">
          <AuthPanel session={session} />
        </div>

        <main className="app-main">
          {/* We pass session to every tab; tabs unrelated to login (map,
              neighborhood board) just get an unused prop, which is fine.
              key={activeTab} makes React recreate the component every time we
              switch tabs, re-triggering the "fadeInUp" effect (.tab-content)
              each time. */}
          <div key={activeTab} className="tab-content">
            <ActiveComponent session={session} />
          </div>
        </main>
      </div>
    </div>
  );
}
