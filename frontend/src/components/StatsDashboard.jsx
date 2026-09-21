// ============================================================================
// StatsDashboard.jsx
// ----------------------------------------------------------------------------
// The "Statistics" tab — available to everyone without logging in, showing
// 3 charts (Chart.js via react-chartjs-2) built from the total approved
// reports:
//   1) Bar chart   → number of reports by neighborhood
//   2) Pie chart   → distribution of reports by pollution type
//   3) Line chart  → number of reports per week for the last 8 weeks (overall trend)
//
// All the data is "aggregated" and contains no personal information — the
// same privacy level as the public heatmap already shows.
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

// Medal icons for the top 3 spots on the leaderboard
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

// The app's core color palette (green + gold) plus a few helper colors for
// the rest of the pie chart's slices when there are more than two or three pollution types
const CHART_COLORS = ['#1f5c3a', '#c99a2e', '#4a90a4', '#a12e2e', '#7a5c99', '#5c6b62'];

const FONT_FAMILY = "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif";

function formatWeekLabel(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function StatsDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [leaderboardError, setLeaderboardError] = useState(null);

  useEffect(() => {
    fetchPublicStats()
      .then(setStats)
      .catch(() => setError("Couldn't fetch the statistics. Make sure the backend server is running."));
  }, []);

  useEffect(() => {
    fetchLeaderboard(10)
      .then(setLeaderboard)
      .catch(() => setLeaderboardError("Couldn't fetch the leaderboard."));
  }, []);

  if (error) {
    return <p className="error-text">{error}</p>;
  }

  if (!stats) {
    return (
      <p>
        <span className="spinner" /> Loading statistics...
      </p>
    );
  }

  const topNeighborhood = stats.byNeighborhood[0]?.name || '—';
  const topType = stats.byType[0]?.label || '—';

  const barData = {
    labels: stats.byNeighborhood.map((n) => n.name),
    datasets: [
      {
        label: 'Number of Reports',
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
        label: 'Reports per Week',
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
      <h2>Statistics Dashboard</h2>

      <div className="report-stats-row fade-in-item">
        <div className="report-stat-box">
          <span className="report-stat-number">
            <AnimatedNumber value={stats.totalReports} />
          </span>
          <span className="report-stat-label">Total Approved Reports</span>
        </div>
        <div className="report-stat-box">
          <span className="report-stat-number" style={{ fontSize: '1.1rem' }}>
            {topNeighborhood}
          </span>
          <span className="report-stat-label">Most Reported Neighborhood</span>
        </div>
        <div className="report-stat-box">
          <span className="report-stat-number" style={{ fontSize: '1.1rem' }}>
            {topType}
          </span>
          <span className="report-stat-label">Most Common Pollution Type</span>
        </div>
      </div>

      <div className="stats-chart-card fade-in-item" style={{ '--i': 1 }}>
        <h3>Number of Reports by Neighborhood</h3>
        {stats.byNeighborhood.length === 0 ? (
          <p>Not enough data to show this chart yet.</p>
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
          <h3>Distribution by Pollution Type</h3>
          {stats.byType.length === 0 ? (
            <p>Not enough data to show this chart yet.</p>
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
          <h3>Weekly Trend (Last 8 Weeks)</h3>
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
        <h3>Leaderboard 🏆</h3>
        <p className="leaderboard-hint">Most active reporters (by number of approved reports)</p>
        {leaderboardError && <p className="error-text">{leaderboardError}</p>}
        {!leaderboardError && !leaderboard && (
          <p>
            <span className="spinner" /> Loading leaderboard...
          </p>
        )}
        {leaderboard && leaderboard.length === 0 && <p>Not enough data to show the leaderboard yet.</p>}
        {leaderboard && leaderboard.length > 0 && (
          <ol className="leaderboard-list">
            {leaderboard.map((entry, index) => (
              <li key={entry.email} className="leaderboard-row fade-in-item" style={{ '--i': index }}>
                <span className="leaderboard-rank">{MEDALS[index] || `#${index + 1}`}</span>
                <span className="leaderboard-email">{entry.email}</span>
                <span className="leaderboard-count">{entry.count} reports</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
