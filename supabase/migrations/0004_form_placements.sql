-- Where a form shows up in the chart — which group (Documentation, Care plan,
-- Billing, …) and which item within it (Assessments, Medical / nursing, …).
-- Targets src/chartSections.ts's settled list by name, so a placement always
-- points at a real chart location, never a typo of one. A form can have zero,
-- one, or several placements — nothing forces a form onto exactly one tab.
alter table form_templates add column if not exists placements jsonb not null default '[]'::jsonb;
