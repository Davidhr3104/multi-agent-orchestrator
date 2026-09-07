-- Helix for Legal — Conflict of Interest (firm knowledge)
-- Run in the Legal project's Supabase SQL editor. The app also seeds
-- the same rows in memory when these tables are not reachable.

CREATE TABLE IF NOT EXISTS firm_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL UNIQUE,
  client_type TEXT DEFAULT 'Corporate',
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS firm_matters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES firm_clients(id),
  matter_name TEXT NOT NULL,
  opposing_party TEXT,
  matter_type TEXT,
  status TEXT DEFAULT 'Closed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO firm_clients (client_name, client_type, status) VALUES
  ('Northstar PI Consortium', 'Corporate', 'Active'),
  ('Harbor Occupational Health', 'Corporate', 'Inactive'),
  ('TechVentures LLC', 'Corporate', 'Active')
ON CONFLICT (client_name) DO NOTHING;

INSERT INTO firm_matters (client_id, matter_name, opposing_party, matter_type, status)
SELECT c.id, v.matter_name, v.opposing_party, v.matter_type, v.status
FROM firm_clients c
JOIN (
  VALUES
    ('Northstar PI Consortium', 'Mass Tort Defense 2024', 'Plaintiff Group A', 'Litigation', 'Active'),
    ('Harbor Occupational Health', 'Workers Comp Audit', 'State Labor Board', 'RFP Response', 'Closed')
) AS v(client_name, matter_name, opposing_party, matter_type, status)
  ON c.client_name = v.client_name
WHERE NOT EXISTS (
  SELECT 1 FROM firm_matters m WHERE m.matter_name = v.matter_name
);

CREATE TABLE IF NOT EXISTS historical_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_title TEXT,
  practice_area TEXT,
  jurisdiction TEXT,
  complexity_score INT,
  estimated_hours INT,
  actual_hours INT,
  proposed_amount DECIMAL(12,2),
  won_amount DECIMAL(12,2),
  win_rate DECIMAL(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_area TEXT,
  min_rate DECIMAL(10,2),
  max_rate DECIMAL(10,2),
  avg_rate DECIMAL(10,2),
  jurisdiction TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO historical_pricing (rfp_title, practice_area, jurisdiction, complexity_score, estimated_hours, proposed_amount, won_amount, win_rate)
SELECT v.rfp_title, v.practice_area, v.jurisdiction, v.complexity_score, v.estimated_hours, v.proposed_amount, v.won_amount, v.win_rate
FROM (
  VALUES
    ('Mass Tort Defense 2024', 'Litigation', 'US', 8, 200, 400000.00, 380000.00, 75.00),
    ('Workers Comp Audit', 'Employment', 'US', 5, 80, 160000.00, 150000.00, 80.00),
    ('Medical Record Review', 'Healthcare', 'US', 6, 120, 240000.00, 220000.00, 70.00)
) AS v(rfp_title, practice_area, jurisdiction, complexity_score, estimated_hours, proposed_amount, won_amount, win_rate)
WHERE NOT EXISTS (
  SELECT 1 FROM historical_pricing h WHERE h.rfp_title = v.rfp_title
);

INSERT INTO pricing_rules (practice_area, min_rate, max_rate, avg_rate, jurisdiction)
SELECT v.practice_area, v.min_rate, v.max_rate, v.avg_rate, v.jurisdiction
FROM (
  VALUES
    ('Litigation', 1500.00, 2500.00, 2000.00, 'US'),
    ('Employment', 1200.00, 2000.00, 1600.00, 'US'),
    ('Healthcare', 1400.00, 2200.00, 1800.00, 'US')
) AS v(practice_area, min_rate, max_rate, avg_rate, jurisdiction)
WHERE NOT EXISTS (
  SELECT 1 FROM pricing_rules r WHERE r.practice_area = v.practice_area AND r.jurisdiction = v.jurisdiction
);
