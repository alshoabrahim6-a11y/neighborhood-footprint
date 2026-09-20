// ============================================================================
// StatsDashboard.jsx
// ----------------------------------------------------------------------------
// تبويب "الإحصائيات" — متاح للجميع بدون تسجيل دخول، وبيعرض 3 رسوم بيانية
// (Chart.js عبر react-chartjs-2) مبنية على إجمالي البلاغات الموافق عليها:
//   1) رسم أعمدة  → عدد البلاغات حسب الحي
//   2) رسم دائري  → توزيع البلاغات حسب نوع التلوث
//   3) رسم خطي    → عدد البلاغات بكل أسبوع من آخر 8 أسابيع (الاتجاه العام)
//
// البيانات كلها "مجمّعة" (aggregated) وما فيها ولا معلومة شخصية — نفس مستوى
// الخصوصية يلي الخريطة الحرارية العامة أصلاً بتعرضه.
// ============================================================================

import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { fetchLeaderboard, fetchPublicStats } from '../api';
import AnimatedNumber from './AnimatedNumber';

// رموز الميداليات لأول 3 مراكز بلوحة المتصدرين
const MEDALS = ['🥇', '🥈', '🥉'];

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend
);

// نفس لوحة الألوان الأساسية للتطبيق (أخضر + ذهبي) بالإضافة لألوان مساعدة
// لباقي شرائح الرسم الدائري لما يكون في أكتر من نوعين-ثلاثة تلوث
const CHART_COLORS = ['#1f5c3a', '#c99a2e', '#4a90a4', '#a12e2e', '#7a5c99', '#5c6b62'];

const FONT_FAMILY = "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif";

function formatWeekLabel(iso) {
  return new Date(iso).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
}

export default function StatsDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [leaderboardError, setLeaderboardError] = useState(null);

  useEffect(() => {
    fetchPublicStats()
      .then(setStats)
      .catch(() => setError('ما قدرنا نجيب الإحصائيات. تأكد إن السيرفر الخلفي شغال.'));
  }, []);

  useEffect(() => {
    fetchLeaderboard(10)
      .then(setLeaderboard)
      .catch(() => setLeaderboardError('ما قدرنا نجيب لوحة المتصدرين.'));
  }, []);

  if (error) {
    return <p className="error-text">{error}</p>;
  }

  if (!stats) {
    return (
      <p>
        <span className="spinner" /> جارِ تحميل الإحصائيات...
      </p>
    );
  }

  const topNeighborhood = stats.byNeighborhood[0]?.name || '—';
  const topType = stats.byType[0]?.label || '—';

  const barData = {
    labels: stats.byNeighborhood.map((n) => n.name),
    datasets: [
      {
        label: 'عدد البلاغات',
        data: stats.byNeighborhood.map((n) => n.count),
        backgroundColor: '#1f5c3a',
        borderRadius: 6,
        maxBarThickness: 40,
      },
    ],
  };

  const doughnutData = {
    labels: stats.byType.map((t) => t.label),
    datasets: [
      {
        data: stats.byType.map((t) => t.count),
        backgroundColor: stats.byType.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderColor: '#ffffff',
        borderWidth: 2,
      },
    ],
  };

  const lineData = {
    labels: stats.weeklyTrend.map((w) => formatWeekLabel(w.weekStart)),
    datasets: [
      {
        label: 'بلاغات الأسبوع',
        data: stats.weeklyTrend.map((w) => w.count),
        borderColor: '#c99a2e',
        backgroundColor: 'rgba(201, 154, 46, 0.15)',
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#c99a2e',
      },
    ],
  };

  const commonFont = { family: FONT_FAMILY };
  const legendLabelFont = { labels: { font: commonFont } };

  return (
    <div className="stats-page">
      <h2>لوحة الإحصائيات</h2>

      <div className="report-stats-row fade-in-item">
        <div className="report-stat-box">
          <span className="report-stat-number">
            <AnimatedNumber value={stats.totalReports} />
          </span>
          <span className="report-stat-label">إجمالي البلاغات الموافق عليها</span>
        </div>
        <div className="report-stat-box">
          <span className="report-stat-number" style={{ fontSize: '1.1rem' }}>
            {topNeighborhood}
          </span>
          <span className="report-stat-label">الحي الأكثر بلاغات</span>
        </div>
        <div className="report-stat-box">
          <span className="report-stat-number" style={{ fontSize: '1.1rem' }}>
            {topType}
          </span>
          <span className="report-stat-label">نوع التلوث الأكثر انتشارًا</span>
        </div>
      </div>

      <div className="stats-chart-card fade-in-item" style={{ '--i': 1 }}>
        <h3>عدد البلاغات حسب الحي</h3>
        {stats.byNeighborhood.length === 0 ? (
          <p>ما في بيانات كافية لعرض هاد الرسم لسا.</p>
        ) : (
          <div className="stats-chart-box">
            <Bar
              data={barData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { ticks: { font: commonFont } },
                  y: { ticks: { font: commonFont, precision: 0 } },
                },
              }}
            />
          </div>
        )}
      </div>

      <div className="stats-charts-grid">
        <div className="stats-chart-card fade-in-item" style={{ '--i': 2 }}>
          <h3>التوزيع حسب نوع التلوث</h3>
          {stats.byType.length === 0 ? (
            <p>ما في بيانات كافية لعرض هاد الرسم لسا.</p>
          ) : (
            <div className="stats-chart-box">
              <Doughnut
                data={doughnutData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom', ...legendLabelFont } },
                }}
              />
            </div>
          )}
        </div>

        <div className="stats-chart-card fade-in-item" style={{ '--i': 3 }}>
          <h3>الاتجاه الأسبوعي (آخر 8 أسابيع)</h3>
          <div className="stats-chart-box">
            <Line
              data={lineData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  x: { ticks: { font: commonFont } },
                  y: { ticks: { font: commonFont, precision: 0 }, beginAtZero: true },
                },
              }}
            />
          </div>
        </div>
      </div>

      <div className="stats-chart-card fade-in-item leaderboard-card" style={{ '--i': 4 }}>
        <h3>لوحة المتصدرين 🏆</h3>
        <p className="leaderboard-hint">أكتر المستخدمين نشاطًا بالإبلاغ (حسب عدد البلاغات الموافق عليها)</p>
        {leaderboardError && <p className="error-text">{leaderboardError}</p>}
        {!leaderboardError && !leaderboard && (
          <p>
            <span className="spinner" /> جارِ تحميل لوحة المتصدرين...
          </p>
        )}
        {leaderboard && leaderboard.length === 0 && <p>ما في بيانات كافية لعرض لوحة المتصدرين لسا.</p>}
        {leaderboard && leaderboard.length > 0 && (
          <ol className="leaderboard-list">
            {leaderboard.map((entry, index) => (
              <li key={entry.email} className="leaderboard-row fade-in-item" style={{ '--i': index }}>
                <span className="leaderboard-rank">{MEDALS[index] || `#${index + 1}`}</span>
                <span className="leaderboard-email">{entry.email}</span>
                <span className="leaderboard-count">{entry.count} بلاغ</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
