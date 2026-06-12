-- BASIC was stored as REFERENCE -> BASIC, causing circular dependency during payroll calculate.

UPDATE finance.pay_structure_components psc
SET formula_json = '{"op":"ASSIGNED_BASIC","round":"NEAREST_RUPEE"}'::jsonb
FROM finance.pay_salary_components comp
WHERE psc.pay_salary_component_id = comp.id
  AND comp.code = 'BASIC'
  AND psc.formula_json->>'op' = 'REFERENCE'
  AND upper(psc.formula_json->>'ref') = 'BASIC';
