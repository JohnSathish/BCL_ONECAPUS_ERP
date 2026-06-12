-- Legacy teaching PF: employer share is an earning; employee + employer shares are deducted.

INSERT INTO finance.pay_salary_components (id, tenant_id, code, name, component_type, category, is_statutory, sort_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), t.id, v.code, v.name, v.component_type, v.category, true, v.sort_order, true, NOW(), NOW()
FROM platform.tenants t
CROSS JOIN (
  VALUES
    ('PF_EMPLOYER', 'Employer PF Contribution', 'EARNING', 'STATUTORY', 26),
    ('PF_EMPLOYEE', 'Employee PF Contribution', 'DEDUCTION', 'STATUTORY', 106)
) AS v(code, name, component_type, category, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM finance.pay_salary_components c
  WHERE c.tenant_id = t.id AND c.code = v.code AND c.deleted_at IS NULL
);

-- Remove wrong PF deduction rows from DBC legacy structure.
DELETE FROM finance.pay_structure_components psc
USING finance.pay_structure_templates pst, finance.pay_salary_components comp
WHERE psc.pay_structure_template_id = pst.id
  AND psc.pay_salary_component_id = comp.id
  AND pst.code = 'DBC_TEACHING_LEGACY'
  AND comp.code = 'PF';

-- Upsert correct DBC legacy structure component formulas (per tenant).
INSERT INTO finance.pay_structure_components (id, tenant_id, pay_structure_template_id, pay_salary_component_id, formula_json, sort_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), pst.tenant_id, pst.id, comp.id, v.formula_json::jsonb, v.sort_order, true, NOW(), NOW()
FROM finance.pay_structure_templates pst
CROSS JOIN (
  VALUES
    ('BASIC', '{"op":"ASSIGNED_BASIC","round":"NEAREST_RUPEE"}', 10),
    ('PF_EMPLOYER', '{"op":"MIN","round":"NEAREST_RUPEE","args":[{"op":"PERCENT_OF","base":"BASIC","rate":12,"round":"NEAREST_RUPEE"},{"op":"FIXED","value":780,"round":"NEAREST_RUPEE"}]}', 20),
    ('PF_EMPLOYEE', '{"op":"REFERENCE","ref":"PF_EMPLOYER"}', 30),
    ('PPF', '{"op":"REFERENCE","ref":"PF_EMPLOYER"}', 40),
    ('HOUSE_RENT', '{"op":"FIXED","value":0,"round":"NEAREST_RUPEE"}', 50),
    ('LOAN', '{"op":"LOAN_DEDUCTION"}', 60)
) AS v(code, formula_json, sort_order)
JOIN finance.pay_salary_components comp ON comp.tenant_id = pst.tenant_id AND comp.code = v.code AND comp.deleted_at IS NULL
WHERE pst.code = 'DBC_TEACHING_LEGACY' AND pst.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM finance.pay_structure_components existing
    WHERE existing.pay_structure_template_id = pst.id
      AND existing.pay_salary_component_id = comp.id
  );

UPDATE finance.pay_structure_components psc
SET formula_json = v.formula_json::jsonb,
    sort_order = v.sort_order,
    updated_at = NOW()
FROM finance.pay_structure_templates pst,
     finance.pay_salary_components comp,
     (
       VALUES
         ('BASIC', '{"op":"ASSIGNED_BASIC","round":"NEAREST_RUPEE"}', 10),
         ('PF_EMPLOYER', '{"op":"MIN","round":"NEAREST_RUPEE","args":[{"op":"PERCENT_OF","base":"BASIC","rate":12,"round":"NEAREST_RUPEE"},{"op":"FIXED","value":780,"round":"NEAREST_RUPEE"}]}', 20),
         ('PF_EMPLOYEE', '{"op":"REFERENCE","ref":"PF_EMPLOYER"}', 30),
         ('PPF', '{"op":"REFERENCE","ref":"PF_EMPLOYER"}', 40),
         ('HOUSE_RENT', '{"op":"FIXED","value":0,"round":"NEAREST_RUPEE"}', 50),
         ('LOAN', '{"op":"LOAN_DEDUCTION"}', 60)
     ) AS v(code, formula_json, sort_order)
WHERE psc.pay_structure_template_id = pst.id
  AND psc.pay_salary_component_id = comp.id
  AND pst.code = 'DBC_TEACHING_LEGACY'
  AND comp.code = v.code;
