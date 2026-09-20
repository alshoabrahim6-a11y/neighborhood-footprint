// ============================================================================
// AdminPanel.jsx
// ----------------------------------------------------------------------------
// لوحة الإدارة: بتوري كل البلاغات (المعلّقة أولًا) وبتخلي الأدمن يوافق
// عليها أو يرفضها. البلاغ ما بيظهر بالخريطة العامة إلا بعد الموافقة.
//
// هاد الكومبوننت ما بيتحقق هو بنفسه من صلاحية الأدمن — App.jsx هو يلي
// بيتحقق ويقرر هل يعرض تبويب "الإدارة" أصلًا، فهون بنفترض إنه لو وصلنا
// هون، المستخدم فعلًا أدمن (والسيرفر الخلفي بيتحقق من هاد كمان بشكل
// منفصل ومستقل، فحتى لو حدا "خدع" الواجهة، السيرفر رح يرفضه).
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { fetchAdminReports, updateReportStatus } from '../api';
import { getPollutionInfo } from '../pollutionTypes';

const STATUS_LABELS = {
  pending: { label: 'معلّق ⏳', className: 'status-pending' },
  approved: { label: 'موافق عليه ✅', className: 'status-approved' },
  rejected: { label: 'مرفوض ❌', className: 'status-rejected' },
};

export default function AdminPanel({ session }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const accessToken = session?.access_token;

  // useCallback عشان الدالة تنعرّف مرة وحدة (طالما accessToken ما تغيّر)،
  // وهيك نقدر نحطها بأمان جوا [dependencies] الخاصة بـ useEffect تحت.
  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchAdminReports(accessToken);
      setReports(data);
      setError(null);
    } catch {
      setError('ما قدرنا نجيب البلاغات. تأكد إن السيرفر الخلفي شغال.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    loadReports();
  }, [accessToken, loadReports]);

  async function handleDecision(reportId, status) {
    try {
      setBusyId(reportId);
      await updateReportStatus(reportId, status, accessToken);
      // بدل ما نعيد تحميل كل شي من السيرفر، منحدّث حالة البلاغ محليًا فورًا
      setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status } : r)));
    } catch {
      setError('فشلت العملية. جرب مرة ثانية.');
    } finally {
      setBusyId(null);
    }
  }

  if (!accessToken) {
    return <p className="error-text">لازم تسجّل دخول أولًا لتشوف هاي الصفحة.</p>;
  }

  if (loading) {
    return (
      <p>
        <span className="spinner" /> جارِ تحميل البلاغات...
      </p>
    );
  }

  const pendingCount = reports.filter((r) => r.status === 'pending').length;

  return (
    <div className="admin-page">
      <h2>لوحة الإدارة</h2>
      <p className="admin-summary">
        عدد البلاغات المعلّقة يلي بحاجة مراجعة: <b>{pendingCount}</b>
      </p>

      {error && <p className="error-text">{error}</p>}

      <div className="admin-list">
        {reports.map((report, index) => {
          const info = getPollutionInfo(report.pollution_type);
          const statusInfo = STATUS_LABELS[report.status] || STATUS_LABELS.pending;
          const confidencePct = report.ai_confidence ? `${Math.round(report.ai_confidence * 100)}%` : 'غير معروف';

          return (
            <div
              key={report.id}
              className="admin-card fade-in-item"
              style={{ '--i': Math.min(index, 10) }}
            >
              <img src={report.image_url} alt="صورة البلاغ" className="admin-card-img" />
              <div className="admin-card-body">
                <div className="admin-card-header">
                  <b style={{ color: info.color }}>{info.label}</b>
                  <span className={`status-badge ${statusInfo.className}`}>{statusInfo.label}</span>
                  {report.is_duplicate && <span className="status-badge duplicate-badge">⚠️ بلاغ مكرر محتمل</span>}
                </div>
                <p className="admin-card-meta">
                  نسبة ثقة الذكاء الاصطناعي: {confidencePct}
                  {report.neighborhoods?.name && <> · الحي: {report.neighborhoods.name}</>}
                </p>
                {report.user_email && <p className="admin-card-meta">بلّغ بواسطة: {report.user_email}</p>}
                {report.description && <p className="admin-card-meta">ملاحظة: {report.description}</p>}
                {report.is_duplicate && (
                  <p className="duplicate-note">
                    ⚠️ في بلاغ سابق قريب جغرافيًا ونفس النوع خلال آخر أسبوعين
                    {report.duplicate_report?.created_at && (
                      <> (بتاريخ {new Date(report.duplicate_report.created_at).toLocaleDateString('ar-EG')})</>
                    )}
                    {report.duplicate_report?.user_email && <> — بلّغ فيه: {report.duplicate_report.user_email}</>}
                    . راجعه قبل ما توافق عليه لتتجنب ازدواجية.
                  </p>
                )}
                <p className="suggestion-text">💡 {info.suggestion}</p>

                <div className="admin-card-actions">
                  <button
                    className="approve-btn"
                    disabled={busyId === report.id || report.status === 'approved'}
                    onClick={() => handleDecision(report.id, 'approved')}
                  >
                    قبول ✅
                  </button>
                  <button
                    className="reject-btn"
                    disabled={busyId === report.id || report.status === 'rejected'}
                    onClick={() => handleDecision(report.id, 'rejected')}
                  >
                    رفض ❌
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {reports.length === 0 && !error && <p>ما في ولا بلاغ لهلق.</p>}
      </div>
    </div>
  );
}
