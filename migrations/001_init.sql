-- Fennec Swap D1 schema

CREATE TABLE IF NOT EXISTS referrals (
    address TEXT PRIMARY KEY,
    ref TEXT,
    last_ref TEXT,
    ip TEXT,
    last_ip TEXT,
    ua TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    count INTEGER DEFAULT 1,
    source TEXT,
    page TEXT
);

CREATE TABLE IF NOT EXISTS wallet_analytics (
    address TEXT PRIMARY KEY,
    archetype_key TEXT,
    tier_level INTEGER DEFAULT 0,
    tx_count INTEGER DEFAULT 0,
    native_balance REAL DEFAULT 0,
    fennec_balance REAL DEFAULT 0,
    networth_usd REAL DEFAULT 0,
    lp_value_usd REAL DEFAULT 0,
    ordinals_count INTEGER DEFAULT 0,
    runes_count INTEGER DEFAULT 0,
    first_tx_ts INTEGER,
    last_audit_ts INTEGER,
    total_scans INTEGER DEFAULT 1,
    last_ip TEXT,
    referred_by TEXT,
    last_full_json TEXT
);

CREATE TABLE IF NOT EXISTS balance_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL,
    networth_usd REAL,
    fennec_balance REAL,
    native_balance REAL,
    timestamp INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY(address) REFERENCES wallet_analytics(address)
);

CREATE INDEX IF NOT EXISTS idx_history_address ON balance_history(address);
CREATE INDEX IF NOT EXISTS idx_wallet_networth ON wallet_analytics(networth_usd);
CREATE INDEX IF NOT EXISTS idx_wallet_fennec ON wallet_analytics(fennec_balance);
CREATE INDEX IF NOT EXISTS idx_wallet_lp ON wallet_analytics(lp_value_usd);
CREATE INDEX IF NOT EXISTS idx_wallet_last_audit ON wallet_analytics(last_audit_ts);
