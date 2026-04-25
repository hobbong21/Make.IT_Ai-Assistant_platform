-- Update campaigns table to support new status values and add channel field
-- Support campaign CRUD and state machine (DRAFT -> SCHEDULED -> ACTIVE -> COMPLETED)

-- 1. Add channel column if not exists
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS channel VARCHAR(16);

-- 2. Drop old status constraint and recreate with new values
ALTER TABLE campaigns
DROP CONSTRAINT IF EXISTS chk_campaigns_status;

-- 3. Add new constraint supporting expanded status values
ALTER TABLE campaigns
ADD CONSTRAINT chk_campaigns_status_v2
CHECK (status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'));

-- 4. Add constraint for channel enum
ALTER TABLE campaigns
ADD CONSTRAINT chk_campaigns_channel
CHECK (channel IN ('INSTAGRAM', 'YOUTUBE', 'SEO', 'ADS', 'MULTI'));

-- 5. Update existing rows: if status = 'ENDED', change to 'COMPLETED'
UPDATE campaigns
SET status = 'COMPLETED'
WHERE status = 'ENDED';

-- 6. Set default channel for existing rows
UPDATE campaigns
SET channel = 'MULTI'
WHERE channel IS NULL;

-- 7. Make channel NOT NULL for new inserts
ALTER TABLE campaigns
ALTER COLUMN channel SET NOT NULL;

-- 8. Add index for channel queries
CREATE INDEX IF NOT EXISTS idx_campaigns_channel ON campaigns(user_id, channel);
