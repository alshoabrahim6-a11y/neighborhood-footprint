// ============================================================================
// api.js
// ----------------------------------------------------------------------------
// All communication with the backend server lives in one place, so if we
// ever change the server address we don't have to change it everywhere in
// the code.
// ============================================================================

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export const api = axios.create({ baseURL: API_BASE_URL });

export async function fetchNeighborhoods() {
  const res = await api.get('/api/neighborhoods');
  return res.data;
}

export async function fetchReports() {
  const res = await api.get('/api/reports');
  return res.data;
}

export async function fetchHeatmapPoints() {
  const res = await api.get('/api/reports/heatmap');
  return res.data;
}

/** Public statistics (Statistics dashboard) — available to everyone without logging in */
export async function fetchPublicStats() {
  const res = await api.get('/api/reports/stats');
  return res.data;
}

/** Leaderboard (most active reporters) — available to everyone without logging in */
export async function fetchLeaderboard(limit = 10) {
  const res = await api.get('/api/reports/leaderboard', { params: { limit } });
  return res.data;
}

/**
 * Submits a new pollution report to the server (photo + location + extra data)
 * @param {{ image: File, latitude: number, longitude: number, neighborhoodId: string, description: string, accessToken?: string }} report
 *
 * accessToken is optional: if the user is logged in, we send their session
 * "token" in the Authorization header so the backend can identify them and
 * link the report to their account. If we don't send it (user not logged
 * in), the report is saved normally without being linked to any account.
 */
export async function submitReport({ image, latitude, longitude, neighborhoodId, description, accessToken }) {
  const formData = new FormData();
  formData.append('image', image);
  formData.append('latitude', latitude);
  formData.append('longitude', longitude);
  if (neighborhoodId) formData.append('neighborhood_id', neighborhoodId);
  if (description) formData.append('description', description);

  const headers = { 'Content-Type': 'multipart/form-data' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await api.post('/api/reports', formData, { headers });
  return res.data;
}

// ----------------------------------------------------------------------------
// Admin Panel — all of these functions need an accessToken for an admin
// account, otherwise the backend rejects the request (401 if not logged in,
// 403 if logged in but not an admin).
// ----------------------------------------------------------------------------

/** Checks whether this token's owner is an admin account or not */
export async function checkIsAdmin(accessToken) {
  try {
    const res = await api.get('/api/admin/check', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data.isAdmin === true;
  } catch {
    // 401 or 403 simply means not an admin (or not logged in at all)
    return false;
  }
}

/** Fetches all reports (in every status) for the admin to review */
export async function fetchAdminReports(accessToken) {
  const res = await api.get('/api/admin/reports', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

/** Changes a given report's status: 'approved' or 'rejected' */
export async function updateReportStatus(reportId, status, accessToken) {
  const res = await api.patch(
    `/api/admin/reports/${reportId}/status`,
    { status },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return res.data;
}

// ----------------------------------------------------------------------------
// Periodic Reports — these all need an admin account too
// ----------------------------------------------------------------------------

/** Live statistical summary for the last N days (computed on the fly, not saved) */
export async function fetchReportSummary(days, accessToken) {
  const res = await api.get('/api/admin/reports/summary', {
    params: { days },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

/** List of automatically saved weekly reports (without their full details) */
export async function fetchSnapshots(accessToken) {
  const res = await api.get('/api/admin/reports/snapshots', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

/** Details of a specific saved weekly report */
export async function fetchSnapshotById(id, accessToken) {
  const res = await api.get(`/api/admin/reports/snapshots/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

/** Generates and saves a weekly report immediately (manually, instead of waiting for the automatic schedule) */
export async function generateSnapshotNow(accessToken) {
  const res = await api.post(
    '/api/admin/reports/snapshots/generate',
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return res.data;
}
