// ============================================================================
// ReportsView.jsx
// ----------------------------------------------------------------------------
// The "Periodic Reports" tab (admin only): shows a live statistical report
// (for the last week or month), plus a list of weekly "snapshots" generated
// automatically every Sunday (via node-cron on the backend — see
// server.js). The admin can also generate a snapshot immediately by hand
// instead of waiting for the weekly schedule.
//
// The report itself is printed/saved as a PDF using the browser's regular
// print feature (window.print) — this way we didn't need any extra PDF
// library, and the browser renders text correctly with no extra complexity.
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
  return new Date(iso).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ----------------------------------------------------------------------------
// Renders a single report (live or saved) — this is exactly the part that gets printed
// ----------------------------------------------------------------------------
function ReportContent({ report }) {
  const changeText =
    report.percentChange === null
      ? 'Not enough data to compare'
      : report.percentChange >= 0
        ? `${report.percentChange}% increase from the previous period`
        : `${Math.abs(report.percentChange)}% decrease from the previous period`;

  return (
    <div className="printable-report">
      <div className="report-header">
        <h2>Neighborhood Footprint — Periodic Report</h2>
        <p>
          Period: {formatDate(report.periodStart)} — {formatDate(report.periodEnd)}
        </p>
      </div>

      <div className="report-stats-row">
        <div className="report-stat-box">
          <span className="report-stat-number">
            <AnimatedNumber value={report.totalReports} />
          </span>
          <span className="report-stat-label">Total Approved Reports</span>
        </div>
        <div className="report-stat-box">
          <span className="report-stat-number">
            <AnimatedNumber value={report.previousTotalReports} />
          </span>
          <span className="report-stat-label">Previous Period</span>
        </div>
        <div className="report-stat-box">
          <span className="report-stat-number">{changeText}</span>
        </div>
      </div>

      <h3>Distribution by Neighborhood</h3>
      {report.byNeighborhood.length === 0 ? (
        <p>No reports in this period.</p>
      ) : (
        <table className="report-table">
          <thead>
            <tr>
              <th>Neighborhood</th>
              <th>Report Count</th>
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

      <h3>Distribution by Pollution Type</h3>
      {report.byType.length === 0 ? (
        <p>No reports in this period.</p>
      ) : (
        <table className="report-table">
          <thead>
            <tr>
              <th>Pollution Type</th>
              <th>Report Count</th>
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
        This report was generated automatically by the Neighborhood Footprint system on {formatDate(new Date().toISOString())}
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
      .catch(() => setError("Couldn't fetch the saved reports list."));
  }, [accessToken]);

  async function handleViewLive() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchReportSummary(periodDays, accessToken);
      setActiveReport(data);
    } catch {
      setError('Failed to fetch the report. Make sure the backend server is running.');
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
      setError("Failed to fetch this saved report.");
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
      setError('Failed to generate the report. Make sure the backend server is running.');
    } finally {
      setGenerating(false);
    }
  }

  if (!accessToken) {
    return <p className="error-text">You need to log in first to see this page.</p>;
  }

  return (
    <div className="reports-page">
      <h2>Periodic Reports</h2>

      {error && <p className="error-text">{error}</p>}

      <div className="reports-controls no-print">
        <div className="reports-live-controls">
          <label>
            Live report for:
            <select value={periodDays} onChange={(e) => setPeriodDays(Number(e.target.value))}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
            </select>
          </label>
          <button className="primary-btn" onClick={handleViewLive} disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" /> Loading...
              </>
            ) : (
              'View 👁️'
            )}
          </button>
        </div>

        <button className="primary-btn" onClick={handleGenerateNow} disabled={generating}>
          {generating ? (
            <>
              <span className="spinner" /> Generating...
            </>
          ) : (
            'Generate Weekly Report Now 🔄'
          )}
        </button>
      </div>

      <div className="reports-snapshots-list no-print">
        <h3>Automatically Saved Weekly Reports</h3>
        {snapshots.length === 0 ? (
          <p>No saved reports yet — the first report will be generated automatically next Sunday, or click "Generate Weekly Report Now" above.</p>
        ) : (
          <ul className="snapshots-list">
            {snapshots.map((s, index) => (
              <li key={s.id} className="fade-in-item" style={{ '--i': Math.min(index, 10) }}>
                <span>
                  {formatDate(s.period_start)} — {formatDate(s.period_end)} ({s.total_reports} reports)
                </span>
                <button className="auth-link-btn" onClick={() => handleViewSnapshot(s.id)}>
                  View 👁️
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
              🖨️ Print / Save as PDF
            </button>
          </div>
          <ReportContent report={activeReport} />
        </>
      )}
    </div>
  );
}
