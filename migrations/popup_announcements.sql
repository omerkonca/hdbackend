-- Pop-up Duyuru Tablosu
CREATE TABLE IF NOT EXISTS popup_announcements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  message TEXT DEFAULT '',
  image_url TEXT,
  action_text TEXT DEFAULT '',
  action_url TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 0,
  show_frequency TEXT DEFAULT 'once_per_day', -- 'once_per_day', 'every_launch', 'once_until_dismissed'
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_popup_announcements_active 
ON popup_announcements(is_active, priority DESC, created_at DESC);
