# Deprecated scripts

These scripts are no longer the normal way to manage admins/users.

Admin/user management now lives inside the app itself:
Admin Panel → "Manage Admins" (grant or revoke access by email, no
terminal needed). See `backend/routes/admin.js` (`GET/POST/DELETE
/api/admin/admins`, `GET /api/admin/users`) and
`frontend/src/components/ManageAdmins.jsx`.

`make-admin.js` is kept here only as an emergency fallback — for example,
if every admin account is ever accidentally removed and there's no one
left who can open the Admin Panel to re-grant access. In that one case,
you can still run it by hand:

```
node scripts/_deprecated/make-admin.js your@email.com
```

(run from the `backend/` folder — its import path was already adjusted
for its new location).

`fix-admin.js` and `list-users.js` are kept only for reference and are not
needed anymore — the Admin Panel's "Manage Admins" list replaces
`list-users.js`, and the new app-side validation (an account must already
exist before it can be made admin) replaces what `fix-admin.js` patched.
