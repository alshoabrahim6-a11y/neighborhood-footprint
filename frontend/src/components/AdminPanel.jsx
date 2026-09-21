// ============================================================================
// AdminPanel.jsx
// ----------------------------------------------------------------------------
// The admin panel: shows all reports (pending ones first) and lets the
// admin approve or reject them. A report doesn't show up on the public map
// until it's approved.
//
// This component doesn't check admin permission itself — App.jsx is what
// checks and decides whether to show the "Admin" tab at all, so here we
// assume that if we got here, the user really is an admin (and the backend
// also checks this separately and independently, so even if someone
// "tricks" the UI, the server will reject them).
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { fetchAdminReports, updateReportStatus } from '../api';
import { getPollutionInfo } from '../pollutionTypes';

const STATUS_LABELS = {
  pending: { label: 'Pending ⏳', className: 'status-pending' },
  approved: { label: 'Approved ✅', className: 'status-approved' },
  rejected: { label: 'Rejected ❌', className: 'status-rejected' },
};

export default function AdminPanel({ session }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const accessToken = session?.access_token;

  // useCallback so the function is only defined once (as long as
  // accessToken hasn't changed), so we can safely put it in the
  // useEffect's [dependencies] below.
  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchAdminReports(accessToken);
      setReports(data);
      setError(null);
    } catch {
      setError("Couldn't fetch the reports. Make sure the backend server is running.");
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
      // Instead of reloading everything from the server, update the report's status locally right away
      setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status } : r)));
    } catch {
      setError('The operation failed. Try again.');
    } finally {
      setBusyId(null);
    }
  }

  if (!accessToken) {
    return <p className="error-text">You need to log in first to see this page.</p>;
  }

  if (loading) {
    return (
      <p>
        <span className="spinner" /> Loading reports...
      </p>
    );
  }

  const pendingCount = reports.filter((r) => r.status === 'pending').length;

  return (
    <div className="admin-page">
      <h2>Admin Panel</h2>
      <p className="admin-summary">
        Number of pending reports awaiting review: <b>{pendingCount}</b>
      </p>

      {error && <p className="error-text">{error}</p>}

      <div className="admin-list">
        {reports.map((report, index) => {
          const info = getPollutionInfo(report.pollution_type);
          const statusInfo = STATUS_LABELS[report.status] || STATUS_LABELS.pending;
          const confidencePct = report.ai_confidence ? `${Math.round(report.ai_confidence * 100)}%` : 'unknown';

          return (
            <div
              key={report.id}
              className="admin-card fade-in-item"
              style={{ '--i': Math.min(index, 10) }}
            >
              <img src={report.image_url} alt="Report photo" className="admin-card-img" />
              <div className="admin-card-body">
                <div className="admin-card-header">
                  <b style={{ color: info.color }}>{info.label}</b>
                  <span className={`status-badge ${statusInfo.className}`}>{statusInfo.label}</span>
                  {report.is_duplicate && <span className="status-badge duplicate-badge">⚠️ Possible duplicate report</span>}
                </div>
                <p className="admin-card-meta">
                  AI confidence: {confidencePct}
                  {report.neighborhoods?.name && <> · Neighborhood: {report.neighborhoods.name}</>}
                </p>
                {report.user_email && <p className="admin-card-meta">Reported by: {report.user_email}</p>}
                {report.description && <p className="admin-card-meta">Note: {report.description}</p>}
                {report.is_duplicate && (
                  <p className="duplicate-note">
                    ⚠️ There's a previous report nearby with the same type within the last two weeks
                    {report.duplicate_report?.created_at && (
                      <> (dated {new Date(report.duplicate_report.created_at).toLocaleDateString('en-GB')})</>
                    )}
                    {report.duplicate_report?.user_email && <> — reported by: {report.duplicate_report.user_email}</>}
                    . Review it before approving to avoid duplication.
                  </p>
                )}
                <p className="suggestion-text">💡 {info.suggestion}</p>

                <div className="admin-card-actions">
                  <button
                    className="approve-btn"
                    disabled={busyId === report.id || report.status === 'approved'}
                    onClick={() => handleDecision(report.id, 'approved')}
                  >
                    Approve ✅
                  </button>
                  <button
                    className="reject-btn"
                    disabled={busyId === report.id || report.status === 'rejected'}
                    onClick={() => handleDecision(report.id, 'rejected')}
                  >
                    Reject ❌
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {reports.length === 0 && !error && <p>No reports yet.</p>}
      </div>
    </div>
  );
}
