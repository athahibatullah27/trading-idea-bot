/*
  # Add 'no_entry_hit' status to trade recommendations

  1. Database Changes
    - Update the status check constraint to include 'no_entry_hit'
    - This allows trades that haven't reached their entry price to be tracked separately

  2. New Status Flow
    - pending -> no_entry_hit (if entry price not reached)
    - no_entry_hit -> pending (if entry price is reached)
    - pending -> accurate/inaccurate (if target/stop loss hit)
*/

-- Update the status check constraint to include the new 'no_entry_hit' status
ALTER TABLE trade_recommendations 
DROP CONSTRAINT IF EXISTS trade_recommendations_status_check;

ALTER TABLE trade_recommendations 
ADD CONSTRAINT trade_recommendations_status_check 
CHECK ((status = ANY (ARRAY['pending'::text, 'accurate'::text, 'inaccurate'::text, 'expired'::text, 'no_entry_hit'::text])));