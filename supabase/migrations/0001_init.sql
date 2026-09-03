-- Sherron Farms HOA Document Assistant — initial schema
-- Run this in the Supabase SQL Editor for your project.

-- 1. Enable pgvector extension (kept out of the public schema per Supabase's
-- linter guidance)
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector SCHEMA extensions;

-- 2. User Profiles Table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'resident' CHECK (role IN ('resident', 'board_member', 'admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile upon auth.users signup
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- This function only makes sense as an AFTER INSERT trigger on auth.users
-- (it references NEW). It doesn't need to be callable directly over the
-- REST RPC surface, so lock that down.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 3. Document Chunks & Embeddings Table
CREATE TABLE public.hoa_document_chunks (
  id BIGSERIAL PRIMARY KEY,
  document_name TEXT NOT NULL,         -- e.g., "Bylaws.pdf", "Amendment_2016_Sheds.pdf"
  document_type TEXT NOT NULL,         -- e.g., "Bylaws", "CC&Rs", "Architectural", "Amendment"
  effective_date DATE,                 -- Crucial for determining superseding rules
  section_title TEXT,                  -- e.g., "Article IV, Section 3: Sheds and Detached Structures"
  page_number INT,                     -- Physical page in source document
  content TEXT NOT NULL,               -- Cleaned markdown/text chunk
  embedding VECTOR(768) NOT NULL,      -- text-embedding-004 produces 768 dimensions
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create an HNSW index for fast similarity search
CREATE INDEX ON public.hoa_document_chunks
USING hnsw (embedding vector_cosine_ops);

-- 4. Vector Match RPC Function
CREATE OR REPLACE FUNCTION match_hoa_chunks (
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id BIGINT,
  document_name TEXT,
  document_type TEXT,
  effective_date DATE,
  section_title TEXT,
  page_number INT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
-- SECURITY INVOKER (the default, stated explicitly here) is deliberate:
-- this function runs as the calling user, so the "Approved users can read
-- document chunks" RLS policy below actually applies to it. A SECURITY
-- DEFINER version would run as the function owner and silently bypass RLS,
-- letting ANY caller — approved or not, even unauthenticated — pull
-- document chunks straight through this RPC.
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_name,
    c.document_type,
    c.effective_date,
    c.section_title,
    c.page_number,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.hoa_document_chunks c
  WHERE 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- 5. Row-Level Security (RLS) Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hoa_document_chunks ENABLE ROW LEVEL SECURITY;

-- Residents can only view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Only admins can update user approval status (also covers admin SELECT/INSERT/DELETE)
CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only approved users can query document chunks
CREATE POLICY "Approved users can read document chunks"
  ON public.hoa_document_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND status = 'approved'
    )
  );

-- NOTE: after running this migration and signing in once yourself, manually
-- promote your own row in the Supabase Table Editor:
--   UPDATE public.profiles SET role = 'admin', status = 'approved' WHERE email = 'you@example.com';
-- There is no other way to reach /admin the first time.
