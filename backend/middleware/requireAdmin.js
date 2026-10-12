// ============================================================================
// requireAdmin.js
// ----------------------------------------------------------------------------
// A "guard" (middleware) we put in front of any admin-only endpoint: it
// makes sure the request comes from a logged-in user (via the
// Authorization: Bearer <token> header), and that this user exists in the
// "admins" table in the database.
//
// If any condition fails, the request is rejected immediately (401 or 403)
// and never reaches the endpoint's own code.
// ============================================================================

import { supabase } from '../services/supabaseClient.js';

export async function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'You must log in first' });
  }

  const token = authHeader.slice('Bearer '.length);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData?.user) {
    return res.status(401).json({ error: 'Invalid session, please log in again' });
  }

  // select('*') (not an explicit column list) so this keeps working even
  // before migration 004_admin_roles.sql has been run on this project's
  // database yet (the 'role' column wouldn't exist yet otherwise, and an
  // explicit select('user_id, role') would error out on every request).
  const { data: adminRow, error: adminError } = await supabase
    .from('admins')
    .select('*')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (adminError) {
    console.error('❌ Error while checking admin permission:', adminError.message);
    return res.status(500).json({ error: 'An unexpected error occurred while checking permissions' });
  }

  if (!adminRow) {
    return res.status(403).json({ error: 'This account does not have admin permission' });
  }

  // Attach the user data to the request so any endpoint after this one can use it.
  // `role` comes from the admins table (RBAC) — 'admin' has full access,
  // 'moderator' can review reports but cannot manage other admins (see
  // routes/admin.js, requireFullAdmin).
  req.user = userData.user;
  req.user.role = adminRow.role || 'admin';
  next();
}

// A stricter guard for endpoints only a full 'admin' should reach (e.g.
// granting/revoking admin access to other accounts). Use after requireAdmin.
export function requireFullAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Only full admins can manage other admin accounts' });
  }
  next();
}
