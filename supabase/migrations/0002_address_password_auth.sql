-- Adds a self-service "street address + community password" verification
-- step on top of the existing Google OAuth login. Residents still sign in
-- with Google (handle_new_user still creates a 'pending' profile row), but
-- instead of waiting for an admin to manually approve them, they can
-- immediately verify themselves by submitting their street address and the
-- shared community password. If both check out, their profile flips to
-- 'approved' right away — and to role 'admin' if their normalized address
-- matches the one seeded as the admin address.
--
-- The verification check itself always runs through the service-role
-- client (never RLS-gated to the browser), so the community password hash
-- is never exposed to, and self-approval can never be forged by, a
-- regular authenticated client.

-- 1. Where a resident's verified address lives.
ALTER TABLE public.profiles
  ADD COLUMN street_address TEXT,
  ADD COLUMN address_normalized TEXT;

-- 2. Single-row table holding the shared community password (hashed) and
-- the normalized admin address. Enforced to exactly one row.
CREATE TABLE public.community_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  password_hash TEXT NOT NULL,
  admin_address_normalized TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.community_settings ENABLE ROW LEVEL SECURITY;
-- No policies: this table is default-deny for anon/authenticated. Only the
-- service-role client (used server-side in /api/auth/verify and the admin
-- "change community password" action) can read or write it.
