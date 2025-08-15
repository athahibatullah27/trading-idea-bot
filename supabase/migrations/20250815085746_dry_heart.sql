/*
  # Create trade recommendations table

  1. New Tables
    - `trade_recommendations`
      - `id` (uuid, primary key)
      - `symbol` (text, not null) - crypto symbol like BTC, ETH
      - `action` (text, not null) - buy, sell, hold
      - `confidence` (integer, not null) - confidence percentage 0-100
      - `target_price` (numeric, not null) - target price for the trade
      - `stop_loss` (numeric, not null) - stop loss price
      - `reasoning` (text array, not null) - array of reasoning strings
      - `timeframe` (text, not null) - expected timeframe
      - `risk_level` (text, not null) - low, medium, high
      - `status` (text, not null, default 'pending') - pending, accurate, inaccurate
      - `entry_price` (numeric) - actual price when recommendation was made
      - `evaluation_timestamp` (timestamptz) - when the recommendation was evaluated
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `trade_recommendations` table
    - Add policy for service role to manage all data
    - Add policy for anon users to read data (for dashboard)
*/

CREATE TABLE IF NOT EXISTS trade_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  action text NOT NULL CHECK (action IN ('buy', 'sell', 'hold')),
  confidence integer NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  target_price numeric NOT NULL CHECK (target_price > 0),
  stop_loss numeric NOT NULL CHECK (stop_loss > 0),
  reasoning text[] NOT NULL DEFAULT '{}',
  timeframe text NOT NULL DEFAULT '1-4 weeks',
  risk_level text NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accurate', 'inaccurate', 'expired')),
  entry_price numeric CHECK (entry_price > 0),
  evaluation_timestamp timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE trade_recommendations ENABLE ROW LEVEL SECURITY;

-- Policy for service role (bot) to manage all data
CREATE POLICY "Service role can manage all trade recommendations"
  ON trade_recommendations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy for anon users (dashboard) to read all data
CREATE POLICY "Anyone can read trade recommendations"
  ON trade_recommendations
  FOR SELECT
  TO anon
  USING (true);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_trade_recommendations_status ON trade_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_trade_recommendations_symbol ON trade_recommendations(symbol);
CREATE INDEX IF NOT EXISTS idx_trade_recommendations_created_at ON trade_recommendations(created_at DESC);