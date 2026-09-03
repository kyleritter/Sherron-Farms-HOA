-- Seeds the shared community password ("pool party", bcrypt-hashed) and
-- the admin address. Any admin can change the community password later
-- from /admin; the admin address is set once here.
INSERT INTO public.community_settings (id, password_hash, admin_address_normalized)
VALUES (
  TRUE,
  '$2b$10$oiDj9LUnUngsp/M6sevfe.lcGAIWHWGPm8L704aNaWssXPFbOnZ7C', -- "pool party"
  '617 hiddenbrook dr'
)
ON CONFLICT (id) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  admin_address_normalized = EXCLUDED.admin_address_normalized;
