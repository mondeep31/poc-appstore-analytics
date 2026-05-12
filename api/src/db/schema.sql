CREATE TABLE IF NOT EXISTS play_installs_overview_daily (
  app_id INTEGER NOT NULL DEFAULT 1,
  date TEXT NOT NULL,
  daily_device_installs INTEGER,
  daily_device_uninstalls INTEGER,
  daily_device_upgrades INTEGER,
  total_user_installs INTEGER,
  daily_user_installs INTEGER,
  daily_user_uninstalls INTEGER,
  active_device_installs INTEGER,
  install_events INTEGER,
  update_events INTEGER,
  uninstall_events INTEGER,
  PRIMARY KEY (app_id, date)
);

CREATE TABLE IF NOT EXISTS play_installs_country_daily (
  app_id INTEGER NOT NULL DEFAULT 1,
  date TEXT NOT NULL,
  country TEXT NOT NULL,
  daily_device_installs INTEGER,
  daily_device_uninstalls INTEGER,
  daily_user_installs INTEGER,
  daily_user_uninstalls INTEGER,
  active_device_installs INTEGER,
  install_events INTEGER,
  uninstall_events INTEGER,
  PRIMARY KEY (app_id, date, country)
);

CREATE TABLE IF NOT EXISTS play_ratings_overview_daily (
  app_id INTEGER NOT NULL DEFAULT 1,
  date TEXT NOT NULL,
  daily_avg_rating REAL,
  total_avg_rating REAL,
  PRIMARY KEY (app_id, date)
);

CREATE TABLE IF NOT EXISTS play_review (
  review_id TEXT PRIMARY KEY,
  app_id INTEGER NOT NULL DEFAULT 1,
  app_version_code INTEGER,
  app_version_name TEXT,
  reviewer_language TEXT,
  device TEXT,
  submitted_at TEXT,
  last_updated_at TEXT,
  star_rating INTEGER,
  title TEXT,
  body TEXT,
  developer_replied_at TEXT,
  developer_reply_text TEXT,
  review_link TEXT
);

CREATE INDEX IF NOT EXISTS idx_play_review_submitted ON play_review (app_id, submitted_at);

CREATE TABLE IF NOT EXISTS play_crashes_overview_daily (
  app_id INTEGER NOT NULL DEFAULT 1,
  date TEXT NOT NULL,
  daily_crashes INTEGER,
  daily_anrs INTEGER,
  PRIMARY KEY (app_id, date)
);

CREATE TABLE IF NOT EXISTS play_crashes_device_daily (
  app_id INTEGER NOT NULL DEFAULT 1,
  date TEXT NOT NULL,
  device TEXT NOT NULL,
  daily_crashes INTEGER,
  daily_anrs INTEGER,
  PRIMARY KEY (app_id, date, device)
);

CREATE INDEX IF NOT EXISTS idx_play_crashes_device_date ON play_crashes_device_daily (app_id, date DESC);

CREATE TABLE IF NOT EXISTS play_crashes_app_version_daily (
  app_id INTEGER NOT NULL DEFAULT 1,
  date TEXT NOT NULL,
  app_version_code INTEGER NOT NULL,
  daily_crashes INTEGER,
  daily_anrs INTEGER,
  PRIMARY KEY (app_id, date, app_version_code)
);

CREATE TABLE IF NOT EXISTS play_crashes_os_version_daily (
  app_id INTEGER NOT NULL DEFAULT 1,
  date TEXT NOT NULL,
  os_version TEXT NOT NULL,
  daily_crashes INTEGER,
  daily_anrs INTEGER,
  PRIMARY KEY (app_id, date, os_version)
);
