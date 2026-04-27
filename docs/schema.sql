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
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  INDEX idx_circles_status (status),
  INDEX idx_circles_creator_id (creator_id),
  INDEX idx_circles_type (circle_type)
);

-- ─── Members ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  position INTEGER CHECK (position > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected', 'defaulted', 'completed')),
  has_received_payout BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  INDEX idx_members_circle_id (circle_id),
  INDEX idx_members_user_id (user_id),
  INDEX idx_members_status (status),
  UNIQUE KEY unique_member_per_circle (circle_id, user_id)
);

-- ─── Contributions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contributions (
  id UUID PRIMARY KEY,
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL CHECK (cycle_number > 0),
  amount_usdc NUMERIC(20, 7) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'missed')),
  tx_hash VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  INDEX idx_contributions_circle_id (circle_id),
  INDEX idx_contributions_member_id (member_id),
  INDEX idx_contributions_status (status)
);

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
  INDEX idx_payouts_circle_id (circle_id),
  INDEX idx_payouts_member_id (recipient_member_id),
  INDEX idx_payouts_paid_at (paid_at),
  INDEX idx_payouts_cycle (circle_id, cycle_number)
);

-- ─── Users ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  phone VARCHAR(20) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  stellar_public_key VARCHAR(56),
  reputation_score INTEGER NOT NULL DEFAULT 0 CHECK (reputation_score >= 0 AND reputation_score <= 100),
  sms_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  INDEX idx_users_phone (phone)
);
