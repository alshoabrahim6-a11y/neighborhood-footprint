// ============================================================================
// App.jsx — نقطة انطلاق الواجهة الأمامية
// ----------------------------------------------------------------------------
// بدل ما نستخدم مكتبة توجيه (routing) معقدة، بنستخدم "تبويبات" بسيطة
// (state بس) للتنقل بين: الخريطة، الإبلاغ عن تلوث، ولوحة نقاط الأحياء،
// ولوحة الإدارة (تظهر بس للأدمن).
//
// كمان هون بنراقب حالة "تسجيل الدخول" (session) بشكل مركزي: أول ما الصفحة
// تفتح منجيب أي جلسة محفوظة أصلاً (لو المستخدم سجّل دخول قبل وسكّر المتصفح)،
// وبنستمع لأي تغيير (دخول/خروج) عبر supabase.auth.onAuthStateChange.
//
// وكل ما تتغيّر الجلسة، منسأل السيرفر الخلفي "هل هاد الحساب أدمن؟" —
// السؤال هون بس عشان نعرف نظهر تبويب "الإدارة" أو لأ (تجربة استخدام
// أحسن)؛ الحماية الحقيقية موجودة بالسيرفر الخلفي (requireAdmin middleware)
// بغض النظر شو الواجهة عارضة.
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
  map: { label: '🗺️ الخريطة', component: MapView },
  upload: { label: '📸 إبلاغ عن تلوث', component: UploadForm },
  board: { label: '🏆 نقاط الأحياء', component: NeighborhoodBoard },
  stats: { label: '📈 الإحصائيات', component: StatsDashboard },
  about: { label: '📖 عن المشروع', component: AboutPage },
};

export default function App() {
  const [activeTab, setActiveTab] = useState('map');
  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // ------------------------------------------------------------------
  // دعم العمل بدون إنترنت (PWA): منراقب حالة الاتصال بالإنترنت عبر
  // navigator.onLine + أحداث 'online'/'offline' المتصفح، عشان نعرض
  // تنبيه واضح للمستخدم لما ينقطع النت — البيانات المعروضة وقتها بتكون
  // آخر نسخة محفوظة محليًا (Service Worker)، مش لحظية.
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
    // 1) نجيب أي جلسة محفوظة أصلاً بالمتصفح (localStorage) وقت ما الصفحة تفتح
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    // 2) نستمع لأي تغيير بحالة تسجيل الدخول (دخول جديد، خروج، تجديد الجلسة...)
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

  // تبويب "الإدارة" بيظهر بس لو المستخدم أدمن فعلًا
  // useMemo عشان ما نصنع "object" جديد بكل مرة الكومبوننت يعيد الرسم (render)،
  // وإلا الـ useEffect تحت رح يشتغل بلا داعي بكل مرة.
  const TABS = useMemo(
    () =>
      isAdmin
        ? {
            ...BASE_TABS,
            admin: { label: '🛡️ الإدارة', component: AdminPanel },
            reports: { label: '📊 التقارير', component: ReportsView },
          }
        : BASE_TABS,
    [isAdmin]
  );

  // لو كنا واقفين بتبويب "الإدارة" وبعدين المستخدم سجّل خروج (أو تبيّن
  // إنه مش أدمن)، نرجّعه تلقائيًا لتبويب الخريطة بدل ما يضل شاشة فاضية.
  useEffect(() => {
    if (!TABS[activeTab]) setActiveTab('map');
  }, [TABS, activeTab]);

  const ActiveComponent = TABS[activeTab]?.component || MapView;

  // ----------------------------------------------------------------------------
  // مؤشر متحرك (tab-indicator) تحت التبويب النشط: كل ما نبدّل تبويب، بنقيس
  // مكان وعرض الزر النشط (getBoundingClientRect) ومنحرّك خط صغير تحته
  // بانسيابية (transform + width بالـ CSS)، بدل ما يقفز فجأة.
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
    <div className="app" dir="rtl">
      <header className="app-header no-print">
        <h1>بصمة الحي</h1>
        <p className="subtitle">رصد التلوث البيئي بمشاركة المجتمع — Neighborhood Footprint</p>
      </header>

      {!isOnline && (
        <div className="offline-banner no-print">
          📴 أنت غير متصل بالإنترنت الآن — البيانات المعروضة هلق قد تكون آخر نسخة محفوظة على جهازك. إرسال بلاغ جديد أو تسجيل الدخول بيحتاجون اتصال بالإنترنت.
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
        {/* منمرر session لكل التبويبات؛ التبويبات يلي ما إلها علاقة بتسجيل
            الدخول (الخريطة، نقاط الأحياء) بترجّعا "prop" مش مستخدم، وهاد عادي.
            key={activeTab} بيخلي React يعيد إنشاء الكومبوننت كل ما نبدّل
            تبويب، فيتفعّل تأثير "fadeInUp" (.tab-content) من جديد كل مرة. */}
        <div key={activeTab} className="tab-content">
          <ActiveComponent session={session} />
        </div>
      </main>
    </div>
  );
}
