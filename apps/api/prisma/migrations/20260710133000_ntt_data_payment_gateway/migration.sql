INSERT INTO "finance"."payment_gateway_providers" ("code", "name", "description", "sort_order")
VALUES
  ('NTT_DATA', 'NTT DATA Payment Services', 'NTT DATA (AtomPay / AIPAY) — Cards, UPI, Net Banking, Wallets', 4)
ON CONFLICT ("code") DO NOTHING;

-- Keep Razorpay first in sort order
UPDATE "finance"."payment_gateway_providers" SET "sort_order" = 1 WHERE "code" = 'RAZORPAY';
UPDATE "finance"."payment_gateway_providers" SET "sort_order" = 4 WHERE "code" = 'NTT_DATA';
UPDATE "finance"."payment_gateway_providers" SET "sort_order" = 5 WHERE "code" = 'PHONEPE';
UPDATE "finance"."payment_gateway_providers" SET "sort_order" = 6 WHERE "code" = 'PAYU';
UPDATE "finance"."payment_gateway_providers" SET "sort_order" = 7 WHERE "code" = 'CCAVENUE';
UPDATE "finance"."payment_gateway_providers" SET "sort_order" = 8 WHERE "code" = 'EASEBUZZ';
UPDATE "finance"."payment_gateway_providers" SET "sort_order" = 9 WHERE "code" = 'STRIPE';
UPDATE "finance"."payment_gateway_providers" SET "sort_order" = 10 WHERE "code" = 'PAYPAL';
UPDATE "finance"."payment_gateway_providers" SET "sort_order" = 11 WHERE "code" = 'CUSTOM';
