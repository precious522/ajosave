-- Ajosave Database Schema
-- PostgreSQL schema for circles, members, contributions, and payouts

-- ─── Circles ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS circles (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  creator_id VARCHAR(255) NOT NULL,
  contribution_usdc NUMERIC(20, 7) NOT NULL,
  contribution_ngn NUMERIC(20, 2) NOT NULL,
  max_members INTEGER NOT NULL CHECK (max_members > 0),
  cycle_frequency VARCHAR(20) NOT NULL CHECK (cycle_frequency IN ('weekly', 'biweekly', 'monthly')),
  circle_type VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (circle_type IN ('public', 'private')),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'active', 'completed', 'cancelled')),
  payout_method VARCHAR(20) NOT NULL DEFAULT 'fixed' CHECK (payout_method IN ('fixed', 'randomized')),
  randomization_seed VARCHAR(255),
  contract_id VARCHAR(255),
  current_cycle INTEGER NOT NULL DEFAULT 0,
  next_payout_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circles_status ON circles (status);
CREATE INDEX IF NOT EXISTS idx_circles_creator_id ON circles (creator_id);
CREATE INDEX IF NOT EXISTS idx_circles_type ON circles (circle_type);

-- ─── Members ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  position INTEGER CHECK (position > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected', 'defaulted', 'completed')),
  has_received_payout BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (circle_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_members_circle_id ON members (circle_id);
CREATE INDEX IF NOT EXISTS idx_members_user_id ON members (user_id);
CREATE INDEX IF NOT EXISTS idx_members_status ON members (status);

-- ─── Contributions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contributions (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL CHECK (cycle_number > 0),
  amount_usdc NUMERIC(20, 7) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'missed')),
  paystack_reference VARCHAR(255) UNIQUE,
  authorization_url TEXT,
  tx_hash VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, cycle_number)
);

CREATE INDEX IF NOT EXISTS idx_contributions_circle_id ON contributions (circle_id);
CREATE INDEX IF NOT EXISTS idx_contributions_circle_id_created_at ON contributions (circle_id, created_at);
CREATE INDEX IF NOT EXISTS idx_contributions_member_id ON contributions (member_id);
CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions (status);

-- ─── Payouts ────────────────────────────────────────────────────────────────────
-- Stores all payout records for horizontal scalability and persistence
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  recipient_member_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  cycle_number INTEGER NOT NULL CHECK (cycle_number > 0),
  amount_usdc NUMERIC(20, 7) NOT NULL,
  tx_hash VARCHAR(255) NOT NULL UNIQUE,
  paid_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (circle_id, cycle_number)
);

CREATE INDEX IF NOT EXISTS idx_payouts_circle_id ON payouts (circle_id);
CREATE INDEX IF NOT EXISTS idx_payouts_member_id ON payouts (recipient_member_id);
CREATE INDEX IF NOT EXISTS idx_payouts_paid_at ON payouts (paid_at);
CREATE INDEX IF NOT EXISTS idx_payouts_cycle ON payouts (circle_id, cycle_number);

-- ─── Users ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  phone VARCHAR(20) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  stellar_public_key VARCHAR(56),
  reputation_score INTEGER NOT NULL DEFAULT 0 CHECK (reputation_score >= 0 AND reputation_score <= 100),
  sms_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);
