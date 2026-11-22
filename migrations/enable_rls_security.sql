-- ============================================================
-- Supabase Security Advisor RLS Fix (rls_disabled_in_public)
-- Enables Row Level Security on all public tables
--
-- Bu dosya backend her açıldığında çalışır. Bu yüzden erişimi GENİŞLETMEZ:
--  * Herkese açık içerik tablolarında (haber, vefat, eczane, kesinti ...) yalnızca
--    zaten kamuya açık olan SELECT USING (true) politikası tekrarlanır.
--  * Filtreli okunan ya da kişisel veri tutan tablolarda (citizen_reports, device_tokens,
--    place_reviews, supporters, publisher_announcements, pro_subscriptions) burada
--    HİÇBİR anon/authenticated politikası oluşturulmaz. Permissive politikalar OR'lanır;
--    USING (true) / WITH CHECK (true) eklemek supabase/migrations/ içindeki filtreleri
--    (20261118120000_fix_critical_rls_leaks.sql vb.) sessizce devre dışı bırakır.
--  * Geniş GRANT verilmez (tek istisna: 20261118'deki device_tokens SELECT (token)).
-- ============================================================

-- 1. City Contents & Backups
ALTER TABLE IF EXISTS public.city_contents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Access for city_contents" ON public.city_contents;
CREATE POLICY "Public Read Access for city_contents" ON public.city_contents
  FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE IF EXISTS public.city_content_backups ENABLE ROW LEVEL SECURITY;

-- 2. News Items
ALTER TABLE IF EXISTS public.news_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Access for news_items" ON public.news_items;
CREATE POLICY "Public Read Access for news_items" ON public.news_items
  FOR SELECT TO anon, authenticated USING (true);

-- 3. Pharmacies (yazma yalnızca backend/service_role)
ALTER TABLE IF EXISTS public.pharmacies ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF to_regclass('public.pharmacies') IS NOT NULL THEN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.pharmacies FROM anon, authenticated;
  END IF;
END $$;
DROP POLICY IF EXISTS "Public Read Access for pharmacies" ON public.pharmacies;
CREATE POLICY "Public Read Access for pharmacies" ON public.pharmacies
  FOR SELECT TO anon, authenticated USING (true);

-- 4. Obituary Items
ALTER TABLE IF EXISTS public.obituary_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Access for obituary_items" ON public.obituary_items;
CREATE POLICY "Public Read Access for obituary_items" ON public.obituary_items
  FOR SELECT TO anon, authenticated USING (true);

-- 5. Daily News Briefings
ALTER TABLE IF EXISTS public.daily_news_briefings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Access for daily_news_briefings" ON public.daily_news_briefings;
CREATE POLICY "Public Read Access for daily_news_briefings" ON public.daily_news_briefings
  FOR SELECT TO anon, authenticated USING (true);

-- 6. Motivational Verses
ALTER TABLE IF EXISTS public.motivational_verses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Access for motivational_verses" ON public.motivational_verses;
CREATE POLICY "Public Read Access for motivational_verses" ON public.motivational_verses
  FOR SELECT TO anon, authenticated USING (true);

-- 7. Publisher Announcements & Popup Announcements
-- publisher_announcements okuması is_active filtresiyle (supabase migration).
ALTER TABLE IF EXISTS public.publisher_announcements ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.popup_announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Access for popup_announcements" ON public.popup_announcements;
CREATE POLICY "Public Read Access for popup_announcements" ON public.popup_announcements
  FOR SELECT TO anon, authenticated USING (true);

-- 8. Place Reviews
-- Okuma yalnızca onaylı yorumlar (place_reviews_select_approved); burada USING (true)
-- politikası yaratmak bekleyen/reddedilen yorumları anon'a açar.
ALTER TABLE IF EXISTS public.place_reviews ENABLE ROW LEVEL SECURITY;

-- 9. Supporters & Subscriptions
-- Okuma is_hidden filtresiyle (supabase migration); USING (true) gizli destekçileri açar.
ALTER TABLE IF EXISTS public.supporters ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.pro_subscriptions ENABLE ROW LEVEL SECURITY;

-- 10. Citizen Reports
-- 20261118 ile kapatılan eski okuma/güncelleme politikaları ve yetkiler; geri açılmasın.
ALTER TABLE IF EXISTS public.citizen_reports ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF to_regclass('public.citizen_reports') IS NOT NULL THEN
    DROP POLICY IF EXISTS citizen_reports_select_anon ON public.citizen_reports;
    DROP POLICY IF EXISTS citizen_reports_update_anon ON public.citizen_reports;
    DROP POLICY IF EXISTS citizen_reports_delete_anon ON public.citizen_reports;
    REVOKE SELECT, UPDATE, DELETE, TRUNCATE ON TABLE public.citizen_reports FROM anon, authenticated;
  END IF;
END $$;

-- 11. Device Tokens & Push Logs
-- Politikalar (insert/update) supabase/migrations tarafından yönetilir; burada yalnızca
-- konum/adres kolonlarının okunmasını ve silmeyi kapatan yetki geri alımı tekrarlanır.
ALTER TABLE IF EXISTS public.device_tokens ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF to_regclass('public.device_tokens') IS NOT NULL THEN
    REVOKE SELECT, DELETE, TRUNCATE ON TABLE public.device_tokens FROM anon, authenticated;
    -- Tablo seviyesindeki REVOKE kolon yetkilerini de siler; eski istemcilerin
    -- upsert(onConflict: token) çağrısı için 20261118'deki dar yetki geri verilir.
    GRANT SELECT (token) ON public.device_tokens TO anon, authenticated;
  END IF;
END $$;

ALTER TABLE IF EXISTS public.push_logs ENABLE ROW LEVEL SECURITY;

-- 12. Outages (Power & Water Outages)
ALTER TABLE IF EXISTS public.outages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read outages" ON public.outages;
DROP POLICY IF EXISTS "Public Read Access for outages" ON public.outages;
CREATE POLICY "Public Read Access for outages" ON public.outages
  FOR SELECT TO anon, authenticated USING (true);

-- 13. 5651 Traffic Logs & News Push Logs (Backend-only; deny all public Data API access)
ALTER TABLE IF EXISTS public.traffic_logs_5651 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.news_push_logs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF to_regclass('public.traffic_logs_5651') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.traffic_logs_5651 FROM anon, authenticated;
  END IF;
  IF to_regclass('public.news_push_logs') IS NOT NULL THEN
    REVOKE ALL ON TABLE public.news_push_logs FROM anon, authenticated;
  END IF;
END $$;

