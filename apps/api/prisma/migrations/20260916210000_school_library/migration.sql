CREATE TABLE IF NOT EXISTS school.school_lib_settings (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL UNIQUE,
  library_name TEXT NOT NULL DEFAULT 'Library',
  library_code TEXT NOT NULL DEFAULT 'STL-LIB',
  email TEXT,
  phone TEXT,
  barcode_prefix TEXT NOT NULL DEFAULT 'STL-LIB-',
  accession_prefix TEXT NOT NULL DEFAULT 'ACC',
  qr_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  grace_days INTEGER NOT NULL DEFAULT 0,
  max_fine NUMERIC(18, 2) NOT NULL DEFAULT 0,
  lost_penalty NUMERIC(18, 2) NOT NULL DEFAULT 0,
  damage_penalty NUMERIC(18, 2) NOT NULL DEFAULT 0,
  reservation_hold_days INTEGER NOT NULL DEFAULT 2,
  skip_weekends BOOLEAN NOT NULL DEFAULT FALSE,
  skip_holidays BOOLEAN NOT NULL DEFAULT FALSE,
  block_on_overdue BOOLEAN NOT NULL DEFAULT TRUE,
  block_on_unpaid_fine BOOLEAN NOT NULL DEFAULT TRUE,
  require_clearance BOOLEAN NOT NULL DEFAULT TRUE,
  notify_due BOOLEAN NOT NULL DEFAULT TRUE,
  notify_overdue BOOLEAN NOT NULL DEFAULT TRUE,
  notify_fine BOOLEAN NOT NULL DEFAULT TRUE,
  notify_reservation BOOLEAN NOT NULL DEFAULT TRUE,
  extras_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school.school_lib_circulation_rules (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  member_kind TEXT NOT NULL,
  grade_pattern TEXT,
  max_books INTEGER NOT NULL,
  loan_days INTEGER NOT NULL,
  max_renewals INTEGER NOT NULL DEFAULT 1,
  fine_per_day NUMERIC(18, 2) NOT NULL,
  grace_days INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS school_lib_circ_rules_tenant_idx
  ON school.school_lib_circulation_rules (tenant_id, member_kind, active);

CREATE TABLE IF NOT EXISTS school.school_lib_categories (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS school.school_lib_authors (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  biography TEXT,
  nationality TEXT,
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS school.school_lib_publishers (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  gstin TEXT,
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS school.school_lib_subjects (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS school.school_lib_locations (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  building TEXT NOT NULL DEFAULT 'Library',
  floor TEXT,
  room TEXT,
  section TEXT,
  rack TEXT,
  shelf TEXT,
  label TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS school_lib_locations_tenant_idx
  ON school.school_lib_locations (tenant_id, label);

CREATE TABLE IF NOT EXISTS school.school_lib_vendors (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  contact TEXT,
  phone TEXT,
  email TEXT,
  gstin TEXT,
  address TEXT
);
CREATE INDEX IF NOT EXISTS school_lib_vendors_tenant_idx
  ON school.school_lib_vendors (tenant_id, name);

CREATE TABLE IF NOT EXISTS school.school_lib_books (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  isbn TEXT,
  language TEXT NOT NULL DEFAULT 'English',
  book_type TEXT NOT NULL DEFAULT 'General',
  edition TEXT,
  publication_year INTEGER,
  pages INTEGER,
  volume TEXT,
  series TEXT,
  description TEXT,
  price NUMERIC(18, 2) NOT NULL DEFAULT 0,
  cover_url TEXT,
  category_id UUID REFERENCES school.school_lib_categories(id) ON DELETE SET NULL,
  author_id UUID REFERENCES school.school_lib_authors(id) ON DELETE SET NULL,
  co_author TEXT,
  publisher_id UUID REFERENCES school.school_lib_publishers(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES school.school_lib_subjects(id) ON DELETE SET NULL,
  keywords TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS school_lib_books_title_idx ON school.school_lib_books (tenant_id, title);
CREATE INDEX IF NOT EXISTS school_lib_books_isbn_idx ON school.school_lib_books (tenant_id, isbn);

CREATE TABLE IF NOT EXISTS school.school_lib_copies (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  book_id UUID NOT NULL REFERENCES school.school_lib_books(id) ON DELETE CASCADE,
  copy_code TEXT NOT NULL,
  accession_no TEXT NOT NULL,
  barcode TEXT NOT NULL,
  condition TEXT NOT NULL DEFAULT 'GOOD',
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
  purchase_price NUMERIC(18, 2) NOT NULL DEFAULT 0,
  purchase_date DATE,
  vendor_id UUID REFERENCES school.school_lib_vendors(id) ON DELETE SET NULL,
  location_id UUID REFERENCES school.school_lib_locations(id) ON DELETE SET NULL,
  row_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, copy_code),
  UNIQUE (tenant_id, accession_no),
  UNIQUE (tenant_id, barcode)
);
CREATE INDEX IF NOT EXISTS school_lib_copies_status_idx ON school.school_lib_copies (tenant_id, status);

CREATE TABLE IF NOT EXISTS school.school_lib_members (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  library_code TEXT NOT NULL,
  member_kind TEXT NOT NULL,
  student_id UUID REFERENCES school.school_students(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES school.school_staff(id) ON DELETE SET NULL,
  user_id UUID,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  blocked_reason TEXT,
  valid_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, library_code)
);
CREATE INDEX IF NOT EXISTS school_lib_members_student_idx ON school.school_lib_members (tenant_id, student_id);
CREATE INDEX IF NOT EXISTS school_lib_members_staff_idx ON school.school_lib_members (tenant_id, staff_id);
CREATE INDEX IF NOT EXISTS school_lib_members_status_idx ON school.school_lib_members (tenant_id, status);

CREATE TABLE IF NOT EXISTS school.school_lib_loans (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  member_id UUID NOT NULL REFERENCES school.school_lib_members(id) ON DELETE RESTRICT,
  copy_id UUID NOT NULL REFERENCES school.school_lib_copies(id) ON DELETE RESTRICT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ NOT NULL,
  returned_at TIMESTAMPTZ,
  renewals INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ISSUED',
  issued_by UUID NOT NULL,
  returned_by UUID,
  return_condition TEXT,
  return_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS school_lib_loans_due_idx ON school.school_lib_loans (tenant_id, status, due_at);
CREATE INDEX IF NOT EXISTS school_lib_loans_member_idx ON school.school_lib_loans (tenant_id, member_id, status);
CREATE INDEX IF NOT EXISTS school_lib_loans_copy_idx ON school.school_lib_loans (tenant_id, copy_id, status);

CREATE TABLE IF NOT EXISTS school.school_lib_reservations (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  book_id UUID NOT NULL REFERENCES school.school_lib_books(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES school.school_lib_members(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'WAITING',
  queue_no INTEGER NOT NULL,
  hold_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS school_lib_res_book_idx ON school.school_lib_reservations (tenant_id, book_id, status);

CREATE TABLE IF NOT EXISTS school.school_lib_fines (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  member_id UUID NOT NULL REFERENCES school.school_lib_members(id) ON DELETE RESTRICT,
  loan_id UUID REFERENCES school.school_lib_loans(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'OVERDUE',
  amount NUMERIC(18, 2) NOT NULL,
  paid_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING',
  waived_reason TEXT,
  receipt_no TEXT,
  voucher_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS school_lib_fines_status_idx ON school.school_lib_fines (tenant_id, status);

CREATE TABLE IF NOT EXISTS school.school_lib_fine_payments (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  fine_id UUID NOT NULL REFERENCES school.school_lib_fines(id) ON DELETE CASCADE,
  amount NUMERIC(18, 2) NOT NULL,
  mode TEXT NOT NULL,
  collected_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school.school_lib_lost (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  copy_id UUID NOT NULL REFERENCES school.school_lib_copies(id) ON DELETE CASCADE,
  member_id UUID,
  recovery NUMERIC(18, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school.school_lib_damaged (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  copy_id UUID NOT NULL REFERENCES school.school_lib_copies(id) ON DELETE CASCADE,
  member_id UUID,
  damage_type TEXT NOT NULL,
  notes TEXT,
  photo_url TEXT,
  recovery NUMERIC(18, 2) NOT NULL DEFAULT 0,
  decision TEXT NOT NULL DEFAULT 'REPAIR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school.school_lib_purchases (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  vendor_id UUID REFERENCES school.school_lib_vendors(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'REQUEST',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  title TEXT NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS school_lib_purchases_status_idx ON school.school_lib_purchases (tenant_id, status);

CREATE TABLE IF NOT EXISTS school.school_lib_purchase_items (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  purchase_id UUID NOT NULL REFERENCES school.school_lib_purchases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price NUMERIC(18, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS school.school_lib_stock_checks (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  expected INTEGER NOT NULL DEFAULT 0,
  scanned INTEGER NOT NULL DEFAULT 0,
  missing INTEGER NOT NULL DEFAULT 0,
  extra INTEGER NOT NULL DEFAULT 0,
  damaged INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS school_lib_stock_tenant_idx ON school.school_lib_stock_checks (tenant_id, created_at);

CREATE TABLE IF NOT EXISTS school.school_lib_stock_items (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  check_id UUID NOT NULL REFERENCES school.school_lib_stock_checks(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL,
  copy_id UUID,
  result TEXT NOT NULL DEFAULT 'SCANNED',
  UNIQUE (check_id, barcode)
);

CREATE TABLE IF NOT EXISTS school.school_lib_audits (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  ip TEXT,
  before_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS school_lib_audits_tenant_idx ON school.school_lib_audits (tenant_id, created_at);
