-- Support anonymous Supabase Auth sessions (used now that residents land
-- straight on /verify instead of signing in with Google first -- see
-- src/app/verify/page.tsx). Anonymous auth.users rows have a NULL email,
-- which the profiles.email NOT NULL constraint and handle_new_user() both
-- assumed would never happen.

ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, status, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'pending',
    'resident'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
