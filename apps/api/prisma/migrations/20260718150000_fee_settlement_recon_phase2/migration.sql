-- Fee settlement recon: bank 3-way fields + fees:reconcile permission

ALTER TABLE finance.fee_settlement_lines
  ADD COLUMN IF NOT EXISTS bank_match_status TEXT,
  ADD COLUMN IF NOT EXISTS bank_statement_line_id UUID,
  ADD COLUMN IF NOT EXISTS bank_amount_difference DECIMAL(12, 2);

CREATE INDEX IF NOT EXISTS fee_settlement_lines_tenant_bank_match_idx
  ON finance.fee_settlement_lines (tenant_id, bank_match_status);

INSERT INTO platform.permissions (id, slug, resource, action, description, created_at, updated_at)
SELECT gen_random_uuid(), 'fees:reconcile', 'fees', 'reconcile',
       'Import and reconcile fee gateway settlements', now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM platform.permissions p
  WHERE p.slug = 'fees:reconcile' AND p.deleted_at IS NULL
);

-- Grant to finance operators and leadership
INSERT INTO platform.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM platform.roles r
JOIN platform.permissions p ON p.slug = 'fees:reconcile'
WHERE r.slug IN (
  'accountant',
  'college-admin',
  'super-admin',
  'university-admin',
  'institution-admin',
  'principal',
  'vice-principal'
)
  AND r.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM platform.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
