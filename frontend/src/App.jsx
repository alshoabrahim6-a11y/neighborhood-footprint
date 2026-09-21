// ============================================================================
// App.jsx — the frontend's entry point
// ----------------------------------------------------------------------------
// Instead of using a full routing library, we use simple "tabs" (just state)
// to navigate between: the map, reporting pollution, the neighborhood points
// board, and the admin panel (shown only to admins).
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

import { useEffect, useMemo, useRef, useState } from 'react';
import MapView from './components/MapView';
import UploadForm from './components/UploadForm';
import NeighborhoodBoard from './components/NeighborhoodBoard';
import AuthPanel from './components/AuthPanel';
import AdminPanel from './components/AdminPanel';
import ReportsView from './components/ReportsView';
import AboutPage from './components/AboutPage';
import StatsDashboard from './components/StatsDashboard';
import { checkIsAdmin } from './api';
import { supabase } from './supabaseClient';
import './App.css';

const BASE_TABS = {
  map: { label: '🗺️ Map', component: MapView },
  upload: { label: '📸 Report Pollution', component: UploadForm },
  board: { label: '🏆 Neighborhood Points', component: NeighborhoodBoard },
  stats: { label: '📈 Statistics', component: StatsDashboard },
  about: { label: '📖 About', component: AboutPage },
};

export default function App() {
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
  const TABS = useMemo(
    () =>
      isAdmin
        ? {
            ...BASE_TABS,
            admin: { label: '🛡️ Admin', component: AdminPanel },
            reports: { label: '📊 Reports', component: ReportsView },
          }
        : BASE_TABS,
    [isAdmin]
  );

  // If we were on the "Admin" tab and the user then logs out (or turns out
  // not to be an admin), send them back automatically to the map tab
  // instead of leaving an empty screen.
  useEffect(() => {
    if (!TABS[activeTab]) setActiveTab('map');
  }, [TABS, activeTab]);

  const ActiveComponent = TABS[activeTab]?.component || MapView;

  // ----------------------------------------------------------------------------
  // Animated tab indicator under the active tab: every time we switch tabs,
  // we measure the active button's position and width (getBoundingClientRect)
  // and smoothly move a small underline (transform + width in CSS), instead
  // of it jumping suddenly.
  // ----------------------------------------------------------------------------
  const tabRefs = useRef({});
  const navRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ transform: 'translateX(0)', width: 0 });

  useEffect(() => {
    const activeButton = tabRefs.current[activeTab];
    const nav = navRef.current;
    if (!activeButton || !nav) return;

    setIndicatorStyle({
      transform: `translateX(${activeButton.offsetLeft}px)`,
      width: `${activeButton.offsetWidth}px`,
    });
  }, [activeTab, TABS]);

  return (
    <div className="app" dir="ltr">
      <header className="app-header no-print">
        <h1>Neighborhood Footprint</h1>
        <p className="subtitle">Community-driven environmental pollution monitoring</p>
      </header>

      {!isOnline && (
        <div className="offline-banner no-print">
          📴 You're currently offline — the data shown may be the last version saved on your device. Submitting a new report or logging in requires an internet connection.
        </div>
      )}

      <div className="no-print">
        <AuthPanel session={session} />
      </div>

      <nav className="tabs no-print" ref={navRef}>
        {Object.entries(TABS).map(([key, tab]) => (
          <button
            key={key}
            ref={(el) => {
              tabRefs.current[key] = el;
            }}
            className={key === activeTab ? 'tab active' : 'tab'}
            onClick={() => setActiveTab(key)}
          >
            {tab.label}
          </button>
        ))}
        <span className="tab-indicator" style={indicatorStyle} />
      </nav>

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
  );
}
