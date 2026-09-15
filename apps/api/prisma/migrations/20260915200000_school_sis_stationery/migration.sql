-- School SIS campus store / stationery. Isolated school schema only.

CREATE TABLE "school"."school_stationery_categories" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "parent_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_stationery_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_stationery_categories_tenant_id_code_key"
  ON "school"."school_stationery_categories"("tenant_id", "code");
CREATE INDEX "school_stationery_categories_tenant_id_parent_id_idx"
  ON "school"."school_stationery_categories"("tenant_id", "parent_id");

ALTER TABLE "school"."school_stationery_categories"
  ADD CONSTRAINT "school_stationery_categories_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "school"."school_stationery_categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "school"."school_stationery_suppliers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contact_person" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "address" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "payment_terms" TEXT,
    "opening_balance" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_stationery_suppliers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_stationery_suppliers_tenant_id_name_idx"
  ON "school"."school_stationery_suppliers"("tenant_id", "name");

CREATE TABLE "school"."school_stationery_products" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "category_id" UUID NOT NULL,
    "subcategory_id" UUID,
    "brand" TEXT,
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'PIECE',
    "purchase_price" INTEGER NOT NULL DEFAULT 0,
    "selling_price" INTEGER NOT NULL DEFAULT 0,
    "tax_applicable" BOOLEAN NOT NULL DEFAULT false,
    "tax_percent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "discount_allowed" BOOLEAN NOT NULL DEFAULT true,
    "min_stock" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "qty_on_hand" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "opening_stock" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "supplier_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "image_url" TEXT,
    "remarks" TEXT,
    "grade_id" UUID,
    "academic_year_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_stationery_products_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_stationery_products_tenant_id_sku_key"
  ON "school"."school_stationery_products"("tenant_id", "sku");
CREATE INDEX "school_stationery_products_tenant_id_barcode_idx"
  ON "school"."school_stationery_products"("tenant_id", "barcode");
CREATE INDEX "school_stationery_products_tenant_id_name_idx"
  ON "school"."school_stationery_products"("tenant_id", "name");
CREATE INDEX "school_stationery_products_tenant_id_category_id_active_idx"
  ON "school"."school_stationery_products"("tenant_id", "category_id", "active");

ALTER TABLE "school"."school_stationery_products"
  ADD CONSTRAINT "school_stationery_products_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "school"."school_stationery_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school"."school_stationery_products"
  ADD CONSTRAINT "school_stationery_products_subcategory_id_fkey"
  FOREIGN KEY ("subcategory_id") REFERENCES "school"."school_stationery_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "school"."school_stationery_products"
  ADD CONSTRAINT "school_stationery_products_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "school"."school_stationery_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "school"."school_stationery_products"
  ADD CONSTRAINT "school_stationery_products_grade_id_fkey"
  FOREIGN KEY ("grade_id") REFERENCES "school"."school_grades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "school"."school_stationery_products"
  ADD CONSTRAINT "school_stationery_products_academic_year_id_fkey"
  FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "school"."school_stationery_product_variants" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "label" TEXT NOT NULL,
    "size" TEXT,
    "gender" TEXT,
    "colour" TEXT,
    "house" TEXT,
    "academic_year" TEXT,
    "purchase_price" INTEGER,
    "selling_price" INTEGER,
    "qty_on_hand" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "min_stock" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_stationery_product_variants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_stationery_product_variants_tenant_id_sku_key"
  ON "school"."school_stationery_product_variants"("tenant_id", "sku");
CREATE INDEX "school_stationery_product_variants_tenant_id_product_id_idx"
  ON "school"."school_stationery_product_variants"("tenant_id", "product_id");

ALTER TABLE "school"."school_stationery_product_variants"
  ADD CONSTRAINT "school_stationery_product_variants_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "school"."school_stationery_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "school"."school_stationery_product_class_maps" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "grade_id" UUID NOT NULL,
    "section_id" UUID,
    "gender" TEXT,
    "academic_year_id" UUID,
    "student_category" TEXT,
    CONSTRAINT "school_stationery_product_class_maps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_stationery_product_class_maps_tenant_id_grade_id_idx"
  ON "school"."school_stationery_product_class_maps"("tenant_id", "grade_id");
CREATE INDEX "school_stationery_product_class_maps_product_id_idx"
  ON "school"."school_stationery_product_class_maps"("product_id");

ALTER TABLE "school"."school_stationery_product_class_maps"
  ADD CONSTRAINT "school_stationery_product_class_maps_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "school"."school_stationery_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_stationery_product_class_maps"
  ADD CONSTRAINT "school_stationery_product_class_maps_grade_id_fkey"
  FOREIGN KEY ("grade_id") REFERENCES "school"."school_grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "school"."school_stationery_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "invoice_prefix" TEXT NOT NULL DEFAULT 'STN',
    "starting_number" INTEGER NOT NULL DEFAULT 1,
    "default_payment_method" TEXT NOT NULL DEFAULT 'CASH',
    "allow_walk_in_sales" BOOLEAN NOT NULL DEFAULT true,
    "allow_credit_sales" BOOLEAN NOT NULL DEFAULT false,
    "allow_negative_stock" BOOLEAN NOT NULL DEFAULT false,
    "default_tax_percent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "default_discount_percent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "cashier_max_discount_percent" DECIMAL(6,2) NOT NULL DEFAULT 5,
    "manager_max_discount_percent" DECIMAL(6,2) NOT NULL DEFAULT 15,
    "low_stock_alert" BOOLEAN NOT NULL DEFAULT true,
    "receipt_format" TEXT NOT NULL DEFAULT 'A5',
    "require_student_selection" BOOLEAN NOT NULL DEFAULT false,
    "enable_barcode" BOOLEAN NOT NULL DEFAULT true,
    "enable_product_images" BOOLEAN NOT NULL DEFAULT false,
    "enable_stock_tracking" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_stationery_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_stationery_settings_tenant_id_key"
  ON "school"."school_stationery_settings"("tenant_id");

CREATE TABLE "school"."school_stationery_sales" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "customer_type" TEXT NOT NULL,
    "student_id" UUID,
    "walk_in_name" TEXT,
    "walk_in_mobile" TEXT,
    "walk_in_address" TEXT,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "item_discount" INTEGER NOT NULL DEFAULT 0,
    "bill_discount" INTEGER NOT NULL DEFAULT 0,
    "bill_discount_pct" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "tax_amount" INTEGER NOT NULL DEFAULT 0,
    "grand_total" INTEGER NOT NULL DEFAULT 0,
    "amount_paid" INTEGER NOT NULL DEFAULT 0,
    "balance_due" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "cashier_user_id" UUID NOT NULL,
    "cashier_name" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_stationery_sales_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_stationery_sales_tenant_id_invoice_no_key"
  ON "school"."school_stationery_sales"("tenant_id", "invoice_no");
CREATE INDEX "school_stationery_sales_tenant_id_created_at_idx"
  ON "school"."school_stationery_sales"("tenant_id", "created_at");
CREATE INDEX "school_stationery_sales_tenant_id_student_id_idx"
  ON "school"."school_stationery_sales"("tenant_id", "student_id");
CREATE INDEX "school_stationery_sales_tenant_id_status_idx"
  ON "school"."school_stationery_sales"("tenant_id", "status");

ALTER TABLE "school"."school_stationery_sales"
  ADD CONSTRAINT "school_stationery_sales_academic_year_id_fkey"
  FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school"."school_stationery_sales"
  ADD CONSTRAINT "school_stationery_sales_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "school"."school_students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "school"."school_stationery_sale_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "product_name" TEXT NOT NULL,
    "variant_label" TEXT,
    "sku" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "rate" INTEGER NOT NULL,
    "discount_amt" INTEGER NOT NULL DEFAULT 0,
    "discount_pct" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "tax_percent" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_amount" INTEGER NOT NULL DEFAULT 0,
    "line_total" INTEGER NOT NULL,
    "returned_qty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    CONSTRAINT "school_stationery_sale_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_stationery_sale_items_sale_id_idx"
  ON "school"."school_stationery_sale_items"("sale_id");

ALTER TABLE "school"."school_stationery_sale_items"
  ADD CONSTRAINT "school_stationery_sale_items_sale_id_fkey"
  FOREIGN KEY ("sale_id") REFERENCES "school"."school_stationery_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_stationery_sale_items"
  ADD CONSTRAINT "school_stationery_sale_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "school"."school_stationery_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school"."school_stationery_sale_items"
  ADD CONSTRAINT "school_stationery_sale_items_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "school"."school_stationery_product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "school"."school_stationery_sale_payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_stationery_sale_payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_stationery_sale_payments_sale_id_idx"
  ON "school"."school_stationery_sale_payments"("sale_id");

ALTER TABLE "school"."school_stationery_sale_payments"
  ADD CONSTRAINT "school_stationery_sale_payments_sale_id_fkey"
  FOREIGN KEY ("sale_id") REFERENCES "school"."school_stationery_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "school"."school_stationery_stock_movements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "type" TEXT NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "qty_before" DECIMAL(14,3) NOT NULL,
    "qty_after" DECIMAL(14,3) NOT NULL,
    "ref_type" TEXT,
    "ref_id" UUID,
    "reason" TEXT,
    "remarks" TEXT,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_stationery_stock_movements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_stationery_stock_movements_tenant_id_product_id_created_at_idx"
  ON "school"."school_stationery_stock_movements"("tenant_id", "product_id", "created_at");
CREATE INDEX "school_stationery_stock_movements_tenant_id_type_created_at_idx"
  ON "school"."school_stationery_stock_movements"("tenant_id", "type", "created_at");

ALTER TABLE "school"."school_stationery_stock_movements"
  ADD CONSTRAINT "school_stationery_stock_movements_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "school"."school_stationery_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school"."school_stationery_stock_movements"
  ADD CONSTRAINT "school_stationery_stock_movements_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "school"."school_stationery_product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "school"."school_stationery_purchases" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_year_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "purchase_date" DATE NOT NULL,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "tax_amount" INTEGER NOT NULL DEFAULT 0,
    "grand_total" INTEGER NOT NULL DEFAULT 0,
    "payment_status" TEXT NOT NULL DEFAULT 'UNPAID',
    "amount_paid" INTEGER NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "school_stationery_purchases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_stationery_purchases_tenant_id_purchase_date_idx"
  ON "school"."school_stationery_purchases"("tenant_id", "purchase_date");
CREATE INDEX "school_stationery_purchases_tenant_id_supplier_id_idx"
  ON "school"."school_stationery_purchases"("tenant_id", "supplier_id");

ALTER TABLE "school"."school_stationery_purchases"
  ADD CONSTRAINT "school_stationery_purchases_academic_year_id_fkey"
  FOREIGN KEY ("academic_year_id") REFERENCES "school"."school_academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school"."school_stationery_purchases"
  ADD CONSTRAINT "school_stationery_purchases_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "school"."school_stationery_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "school"."school_stationery_purchase_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "purchase_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "qty" DECIMAL(14,3) NOT NULL,
    "rate" INTEGER NOT NULL,
    "discount_amt" INTEGER NOT NULL DEFAULT 0,
    "tax_percent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "tax_amount" INTEGER NOT NULL DEFAULT 0,
    "line_total" INTEGER NOT NULL,
    CONSTRAINT "school_stationery_purchase_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_stationery_purchase_items_purchase_id_idx"
  ON "school"."school_stationery_purchase_items"("purchase_id");

ALTER TABLE "school"."school_stationery_purchase_items"
  ADD CONSTRAINT "school_stationery_purchase_items_purchase_id_fkey"
  FOREIGN KEY ("purchase_id") REFERENCES "school"."school_stationery_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_stationery_purchase_items"
  ADD CONSTRAINT "school_stationery_purchase_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "school"."school_stationery_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school"."school_stationery_purchase_items"
  ADD CONSTRAINT "school_stationery_purchase_items_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "school"."school_stationery_product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "school"."school_stationery_returns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "return_no" TEXT NOT NULL,
    "reason" TEXT,
    "refund_total" INTEGER NOT NULL DEFAULT 0,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_stationery_returns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_stationery_returns_tenant_id_return_no_key"
  ON "school"."school_stationery_returns"("tenant_id", "return_no");
CREATE INDEX "school_stationery_returns_sale_id_idx"
  ON "school"."school_stationery_returns"("sale_id");

ALTER TABLE "school"."school_stationery_returns"
  ADD CONSTRAINT "school_stationery_returns_sale_id_fkey"
  FOREIGN KEY ("sale_id") REFERENCES "school"."school_stationery_sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "school"."school_stationery_return_items" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "return_id" UUID NOT NULL,
    "sale_item_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "qty" DECIMAL(14,3) NOT NULL,
    "condition" TEXT NOT NULL,
    "refund_amt" INTEGER NOT NULL,
    CONSTRAINT "school_stationery_return_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_stationery_return_items_return_id_idx"
  ON "school"."school_stationery_return_items"("return_id");

ALTER TABLE "school"."school_stationery_return_items"
  ADD CONSTRAINT "school_stationery_return_items_return_id_fkey"
  FOREIGN KEY ("return_id") REFERENCES "school"."school_stationery_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school"."school_stationery_return_items"
  ADD CONSTRAINT "school_stationery_return_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "school"."school_stationery_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school"."school_stationery_return_items"
  ADD CONSTRAINT "school_stationery_return_items_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "school"."school_stationery_product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "school"."school_stationery_audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL DEFAULT 'STATIONERY',
    "record_id" TEXT,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "school_stationery_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_stationery_audit_logs_tenant_id_created_at_idx"
  ON "school"."school_stationery_audit_logs"("tenant_id", "created_at");
CREATE INDEX "school_stationery_audit_logs_tenant_id_record_id_idx"
  ON "school"."school_stationery_audit_logs"("tenant_id", "record_id");
