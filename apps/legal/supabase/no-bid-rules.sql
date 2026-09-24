-- Structured, editable no-bid rules — replaces the old free-text policy
-- paragraph in the corpus seed. Each rule's pattern is checked against every
-- ingested RFP and forces a NO-GO on match (see checkNoBidRules in
-- src/lib/no-bid-rules.ts). Additive.

CREATE TABLE IF NOT EXISTS no_bid_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern TEXT NOT NULL,
  reason TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO no_bid_rules (pattern, reason) VALUES
  ('kubernetes', 'Pure Kubernetes / SaaS catalog work is outside the firm''s practice areas.'),
  ('shopify', 'Shopify-adjacent vendor portal work is outside the firm''s practice areas.')
ON CONFLICT DO NOTHING;
