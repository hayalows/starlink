-- Starlink Ghana phone companion migration, deployed to the connected Supabase project.
-- Do not run this on the existing RouteLab tables; this is an isolated, RLS-protected table.
-- Applied as migration starlink_phone_capability_storage.
CREATE TABLE IF NOT EXISTS public.starlink_phone_pairs (
  monitor_id uuid PRIMARY KEY,
  view_digest text NOT NULL UNIQUE CHECK (length(view_digest) = 64),
  write_digest text NOT NULL UNIQUE CHECK (length(write_digest) = 64),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.starlink_phone_pairs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.starlink_phone_pairs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.starlink_phone_pairs TO service_role;
CREATE INDEX IF NOT EXISTS starlink_phone_pairs_updated_index
  ON public.starlink_phone_pairs (updated_at DESC);
