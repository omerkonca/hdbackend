-- ============================================================
-- Supabase Security Advisor RLS Fix (rls_disabled_in_public)
-- Enables Row Level Security on all public tables
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

-- 3. Pharmacies
ALTER TABLE IF EXISTS public.pharmacies ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE IF EXISTS public.publisher_announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Access for publisher_announcements" ON public.publisher_announcements;
CREATE POLICY "Public Read Access for publisher_announcements" ON public.publisher_announcements
  FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE IF EXISTS public.popup_announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Access for popup_announcements" ON public.popup_announcements;
CREATE POLICY "Public Read Access for popup_announcements" ON public.popup_announcements
  FOR SELECT TO anon, authenticated USING (true);

-- 8. Place Reviews
ALTER TABLE IF EXISTS public.place_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Access for place_reviews" ON public.place_reviews;
CREATE POLICY "Public Read Access for place_reviews" ON public.place_reviews
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Public Insert Access for place_reviews" ON public.place_reviews;
CREATE POLICY "Public Insert Access for place_reviews" ON public.place_reviews
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- 9. Supporters & Subscriptions
ALTER TABLE IF EXISTS public.supporters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Access for supporters" ON public.supporters;
CREATE POLICY "Public Read Access for supporters" ON public.supporters
  FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE IF EXISTS public.pro_subscriptions ENABLE ROW LEVEL SECURITY;

-- 10. Citizen Reports
ALTER TABLE IF EXISTS public.citizen_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "citizen_reports_insert_anon" ON public.citizen_reports;
CREATE POLICY "citizen_reports_insert_anon" ON public.citizen_reports
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "citizen_reports_select_anon" ON public.citizen_reports;
CREATE POLICY "citizen_reports_select_anon" ON public.citizen_reports
  FOR SELECT TO anon, authenticated USING (true);

-- 11. Device Tokens & Push Logs
ALTER TABLE IF EXISTS public.device_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "device_tokens_insert_anon" ON public.device_tokens;
CREATE POLICY "device_tokens_insert_anon" ON public.device_tokens
  FOR INSERT TO anon, authenticated
  WITH CHECK (length(token) >= 10 AND platform IN ('ios', 'android', 'web'));

DROP POLICY IF EXISTS "device_tokens_update_anon" ON public.device_tokens;
CREATE POLICY "device_tokens_update_anon" ON public.device_tokens
  FOR UPDATE TO anon, authenticated
  USING (length(token) >= 10)
  WITH CHECK (length(token) >= 10 AND platform IN ('ios', 'android', 'web'));

ALTER TABLE IF EXISTS public.push_logs ENABLE ROW LEVEL SECURITY;
