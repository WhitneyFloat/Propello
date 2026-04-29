-- Propello Funder Seed — First 100 Foundations
-- Populate this with your manually curated foundation list before going live.
-- Format: (ein, foundation_name, total_assets, geographic_focus, primary_program_areas, last_990_year)

INSERT INTO funder_profiles (ein, foundation_name, total_assets, geographic_focus, primary_program_areas, last_990_year) VALUES
-- NYC / National foundations (examples — replace with real 990 data)
('13-1837418', 'Ford Foundation', 16000000000, 'National', ARRAY['Social Justice', 'Democracy', 'Economic Opportunity'], 2023),
('23-7150390', 'Robert Wood Johnson Foundation', 12000000000, 'National', ARRAY['Health', 'Health Equity', 'Public Health'], 2023),
('53-0196603', 'W.K. Kellogg Foundation', 9000000000, 'National', ARRAY['Children', 'Education', 'Family Economic Security'], 2023),
('94-1421623', 'David and Lucile Packard Foundation', 8000000000, 'National', ARRAY['Conservation', 'Children', 'Science'], 2023),
('13-3726175', 'Robin Hood Foundation', 450000000, 'New York City', ARRAY['Poverty', 'Education', 'Housing', 'Workforce'], 2023),
('13-3503155', 'New York Community Trust', 3200000000, 'New York City', ARRAY['Health', 'Education', 'Environment', 'Arts'], 2023),
('13-1624087', 'Tiger Foundation', 100000000, 'New York City', ARRAY['Education', 'Poverty', 'Youth'], 2023)
-- Add remaining 93 foundations here
;
