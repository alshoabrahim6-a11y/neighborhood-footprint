// ============================================================================
// AuthPanel.jsx
// ----------------------------------------------------------------------------
// A small bar at the top of the page: if the user is logged in, it shows
// their email and a logout button. If not, it shows a small form (email +
// password) with two buttons: "Login" and "New Account".
//
// Note: signing up is optional — the site keeps working even without
// logging in (public reports, the map, and the neighborhood board are all
// available to everyone). The account feature here is just so we know "who
// sent which report", and this is a starting point for future features
// (admin panel, personal report history...).
// ============================================================================

import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function AuthPanel({ session }) {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [showForm, setShowForm] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Account created! If email confirmation is enabled on your project, check your inbox before logging in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setShowForm(false);
      }
      setPassword('');
    } catch (err) {
      // Simpler translation for the most common Supabase error messages
      if (err.message?.includes('Invalid login credentials')) {
        setMessage('Wrong email or password.');
      } else if (err.message?.includes('User already registered')) {
        setMessage('This email is already registered — try "Login" instead of "New Account".');
      } else {
        setMessage(err.message || 'An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  // --- Logged-in user ---
  if (session) {
    return (
      <div className="auth-bar">
        <span className="auth-email">👤 {session.user.email}</span>
        <button className="auth-link-btn" onClick={handleLogout}>
          Log Out
        </button>
      </div>
    );
  }

  // --- Not logged in: a simple button that opens the form ---
  if (!showForm) {
    return (
      <div className="auth-bar">
        <span className="auth-hint">You can report without logging in, but logging in lets you track your reports</span>
        <button className="auth-link-btn" onClick={() => setShowForm(true)}>
          Log In / New Account
        </button>
      </div>
    );
  }

  return (
    <div className="auth-bar auth-bar-form">
      <form onSubmit={handleSubmit} className="auth-form">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password (at least 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
        <button type="submit" className="primary-btn auth-submit-btn" disabled={loading}>
          {loading ? '...' : mode === 'signup' ? 'Create Account' : 'Log In'}
        </button>
        <button
          type="button"
          className="auth-link-btn"
          onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
        >
          {mode === 'signup' ? 'Already have an account? Log in' : "Don't have an account? Create one"}
        </button>
        <button type="button" className="auth-link-btn" onClick={() => setShowForm(false)}>
          Cancel
        </button>
      </form>
      {message && <p className="auth-message">{message}</p>}
    </div>
  );
}
