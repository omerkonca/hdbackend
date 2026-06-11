CREATE TABLE IF NOT EXISTS public.citizen_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('problem', 'suggestion', 'tip', 'other')),
  message text NOT NULL,
  contact_name text,
  contact_email text,
  image_urls text[] NOT NULL DEFAULT '{}',
  platform text,
  app_version text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_citizen_reports_created ON public.citizen_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_citizen_reports_status ON public.citizen_reports(status);

ALTER TABLE public.citizen_reports ENABLE ROW LEVEL SECURITY;
