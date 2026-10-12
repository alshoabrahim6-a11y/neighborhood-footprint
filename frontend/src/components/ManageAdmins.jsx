// ============================================================================
// ManageAdmins.jsx
// ----------------------------------------------------------------------------
// Lets a full admin grant or revoke admin/moderator access to existing
// accounts, from inside the app. This replaces the old workflow of running
// backend/scripts/make-admin.js (or list-users.js / fix-admin.js) by hand
// from the terminal — everything here goes through the same backend
// endpoints, which are themselves protected (requireAdmin / requireFullAdmin
// on the server, so this isn't just a UI-level restriction).
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { addAdmin, fetchAllUsers, removeAdmin } from '../api';

export default function ManageAdmins({ session }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('admin');
  const [busyUserId, setBusyUserId] = useState(null);

  const accessToken = session?.access_token;
  const currentUserId = session?.user?.id;

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchAllUsers(accessToken);
      setUsers(data);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.error || "Couldn't load the accounts list.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) loadUsers();
  }, [accessToken, loadUsers]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    try {
      setError(null);
      setNotice(null);
      await addAdmin(newEmail.trim(), newRole, accessToken);
      setNotice(`${newEmail.trim()} is now ${newRole === 'moderator' ? 'a moderator' : 'an admin'}.`);
      setNewEmail('');
      await loadUsers();
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not grant access. Make sure the account already signed up.');
    }
  }

  async function handleRemove(userId, email) {
    try {
      setBusyUserId(userId);
      setError(null);
      await removeAdmin(userId, accessToken);
      setNotice(`Admin access removed for ${email}.`);
      await loadUsers();
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not remove access.');
    } finally {
      setBusyUserId(null);
    }
  }

  const admins = users.filter((u) => u.role);

  return (
    <div className="manage-admins">
      <h3>Manage Admins</h3>
      <p className="admin-summary">
        Grant or revoke admin access to existing accounts here — no script or terminal needed.
      </p>

      {error && <p className="error-text">{error}</p>}
      {notice && <p className="success-text">{notice}</p>}

      <form className="add-admin-form" onSubmit={handleAdd}>
        <input
          type="email"
          placeholder="Account email (must already be registered)"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          required
        />
        <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
          <option value="admin">Admin (full access)</option>
          <option value="moderator">Moderator (reports only)</option>
        </select>
        <button type="submit">Grant access</button>
      </form>

      {loading ? (
        <p>
          <span className="spinner" /> Loading accounts...
        </p>
      ) : (
        <table className="admins-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {admins.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.role === 'moderator' ? 'Moderator' : 'Admin'}</td>
                <td>
                  <button
                    className="reject-btn"
                    disabled={u.id === currentUserId || busyUserId === u.id}
                    title={u.id === currentUserId ? "You can't remove your own access" : undefined}
                    onClick={() => handleRemove(u.id, u.email)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {admins.length === 0 && (
              <tr>
                <td colSpan={3}>No admins yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
