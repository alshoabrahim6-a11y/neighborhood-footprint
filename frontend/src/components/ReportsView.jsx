// ============================================================================
// ReportsView.jsx
// ----------------------------------------------------------------------------
// تبويب "التقارير الدورية" (أدمن بس): بيعرض تقرير إحصائي فوري (لآخر أسبوع
// أو شهر)، وكمان لستة "لقطات" أسبوعية بتتولّد تلقائيًا لحالها كل أحد
// (عبر node-cron بالسيرفر الخلفي — راجع server.js). الأدمن يقدر كمان
// يولّد لقطة فورًا يدويًا بدل ما ينتظر الموعد الأسبوعي.
//
// التقرير نفسه بينطبع/يتحفظ كـ PDF باستخدام ميزة الطباعة العادية بالمتصفح
// (window.print) — هيك ما احتجنا أي مكتبة PDF إضافية، والمتصفح بيعرض
// العربي صح 100% (شكل الحروف واتجاه النص) بدون أي تعقيد إضافي.
// ============================================================================

import { useEffect, useState } from 'react';
import {
  fetchReportSummary,
  fetchSnapshots,
  fetchSnapshotById,
  generateSnapshotNow,
} from '../api';
import AnimatedNumber from './AnimatedNumber';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ----------------------------------------------------------------------------
// عرض تقرير واحد (فوري أو محفوظ) — هاد الجزء بالضبط يلي بينطبع
// ----------------------------------------------------------------------------
function ReportContent({ report }) {
  const changeText =
    report.percentChange === null
      ? 'لا توجد بيانات كافية للمقارنة'
      : report.percentChange >= 0
        ? `زيادة ${report.percentChange}% عن الفترة السابقة`
        : `انخفاض ${Math.abs(report.percentChange)}% عن الفترة السابقة`;

  return (
    <div className="printable-report">
      <div className="report-header">
        <h2>بصمة الحي — التقرير الدوري</h2>
        <p>
          الفترة: {formatDate(report.periodStart)} — {formatDate(report.periodEnd)}
        </p>
      </div>

      <div className="report-stats-row">
        <div className="report-stat-box">
          <span className="report-stat-number">
            <AnimatedNumber value={report.totalReports} />
          </span>
          <span className="report-stat-label">إجمالي البلاغات الموافق عليها</span>
        </div>
        <div className="report-stat-box">
          <span className="report-stat-number">
            <AnimatedNumber value={report.previousTotalReports} />
          </span>
          <span className="report-stat-label">الفترة السابقة</span>
        </div>
        <div className="report-stat-box">
          <span className="report-stat-number">{changeText}</span>
        </div>
      </div>

      <h3>التوزيع حسب الحي</h3>
      {report.byNeighborhood.length === 0 ? (
        <p>ما في بلاغات بهاي الفترة.</p>
      ) : (
        <table className="report-table">
          <thead>
            <tr>
              <th>الحي</th>
              <th>عدد البلاغات</th>
            </tr>
          </thead>
          <tbody>
            {report.byNeighborhood.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>التوزيع حسب نوع التلوث</h3>
      {report.byType.length === 0 ? (
        <p>ما في بلاغات بهاي الفترة.</p>
      ) : (
        <table className="report-table">
          <thead>
            <tr>
              <th>نوع التلوث</th>
              <th>عدد البلاغات</th>
            </tr>
          </thead>
          <tbody>
            {report.byType.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="report-footer">
        تم إنشاء هاد التقرير تلقائيًا بواسطة نظام بصمة الحي بتاريخ {formatDate(new Date().toISOString())}
      </p>
    </div>
  );
}

export default function ReportsView({ session }) {
  const accessToken = session?.access_token;

  const [periodDays, setPeriodDays] = useState(7);
  const [activeReport, setActiveReport] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!accessToken) return;
    fetchSnapshots(accessToken)
      .then(setSnapshots)
      .catch(() => setError('ما قدرنا نجيب لستة التقارير المحفوظة.'));
  }, [accessToken]);

  async function handleViewLive() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchReportSummary(periodDays, accessToken);
      setActiveReport(data);
    } catch {
      setError('فشل جلب التقرير. تأكد إن السيرفر الخلفي شغال.');
    } finally {
      setLoading(false);
    }
  }

  async function handleViewSnapshot(id) {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSnapshotById(id, accessToken);
      setActiveReport(data);
    } catch {
      setError('فشل جلب هاد التقرير المحفوظ.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateNow() {
    try {
      setGenerating(true);
      setError(null);
      const snapshot = await generateSnapshotNow(accessToken);
      setActiveReport(snapshot.summary);
      const updated = await fetchSnapshots(accessToken);
      setSnapshots(updated);
    } catch {
      setError('فشل توليد التقرير. تأكد إن السيرفر الخلفي شغال.');
    } finally {
      setGenerating(false);
    }
  }

  if (!accessToken) {
    return <p className="error-text">لازم تسجّل دخول أولًا لتشوف هاي الصفحة.</p>;
  }

  return (
    <div className="reports-page">
      <h2>التقارير الدورية</h2>

      {error && <p className="error-text">{error}</p>}

      <div className="reports-controls no-print">
        <div className="reports-live-controls">
          <label>
            تقرير فوري عن:
            <select value={periodDays} onChange={(e) => setPeriodDays(Number(e.target.value))}>
              <option value={7}>آخر 7 أيام</option>
              <option value={30}>آخر 30 يوم</option>
            </select>
          </label>
          <button className="primary-btn" onClick={handleViewLive} disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" /> جاري التحميل...
              </>
            ) : (
              'عرض 👁️'
            )}
          </button>
        </div>

        <button className="primary-btn" onClick={handleGenerateNow} disabled={generating}>
          {generating ? (
            <>
              <span className="spinner" /> جاري التوليد...
            </>
          ) : (
            'توليد تقرير أسبوعي الآن 🔄'
          )}
        </button>
      </div>

      <div className="reports-snapshots-list no-print">
        <h3>التقارير الأسبوعية المحفوظة تلقائيًا</h3>
        {snapshots.length === 0 ? (
          <p>ما في تقارير محفوظة لهلق — التقرير الأول رح يتولّد تلقائيًا أول أحد جاي، أو دوس "توليد تقرير أسبوعي الآن" فوق.</p>
        ) : (
          <ul className="snapshots-list">
            {snapshots.map((s, index) => (
              <li key={s.id} className="fade-in-item" style={{ '--i': Math.min(index, 10) }}>
                <span>
                  {formatDate(s.period_start)} — {formatDate(s.period_end)} ({s.total_reports} بلاغ)
                </span>
                <button className="auth-link-btn" onClick={() => handleViewSnapshot(s.id)}>
                  عرض 👁️
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {activeReport && (
        <>
          <div className="no-print">
            <button className="primary-btn" onClick={() => window.print()}>
              🖨️ طباعة / حفظ PDF
            </button>
          </div>
          <ReportContent report={activeReport} />
        </>
      )}
    </div>
  );
}
