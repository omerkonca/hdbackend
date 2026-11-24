-- İlan talepleri: Uygulamadaki "İlan Ver" kısa formundan gelen başvurular.
-- Uygulama bu tabloya DOĞRUDAN yazmaz; tüm erişim backend'in service_role bağlantısı ile yapılır.
CREATE TABLE IF NOT EXISTS public.listing_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_type text NOT NULL CHECK (listing_type IN ('real_estate', 'auto', 'handyman', 'job', 'other')),
  profession text,
  contact_name text NOT NULL,
  phone text NOT NULL,
  note text,
  platform text,
  app_version text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'published', 'dismissed')),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_requests_created ON public.listing_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_requests_status ON public.listing_requests(status);

-- Güvenlik: anon/authenticated için hiçbir yetki yok (kişisel veri: ad + telefon).
ALTER TABLE public.listing_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.listing_requests FROM anon, authenticated;
