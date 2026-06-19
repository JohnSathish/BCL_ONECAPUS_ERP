# Cloudflare Setup — BCL OneCampus ERP

Protect `erp.donboscocollege.ac.in`, `admissions.donboscocollege.ac.in`, and `library.donboscocollege.ac.in`.

## 1. DNS (orange cloud / proxied)

| Type | Name       | Content       | Proxy   |
| ---- | ---------- | ------------- | ------- |
| A    | erp        | VPS origin IP | Proxied |
| A    | admissions | VPS origin IP | Proxied |
| A    | library    | VPS origin IP | Proxied |

Keep the direct A record IP documented for rollback (grey-cloud if needed).

## 2. SSL/TLS

- Mode: **Full (strict)**
- Origin: Let's Encrypt cert on nginx (`nginx.ssl.conf`)
- Always Use HTTPS: **On**
- Minimum TLS: 1.2

## 3. WAF & bot protection

- Enable **Bot Fight Mode**
- Managed rules: Cloudflare OWASP Core Ruleset (block mode)
- Custom rule: block known bad bots on `/api/v1/auth/login`

## 4. Rate limiting (edge)

| Rule  | Match                      | Limit             |
| ----- | -------------------------- | ----------------- |
| Login | `POST */api/v1/auth/login` | 5 / 15 min per IP |
| OTP   | `POST */api/v1/auth/mfa/*` | 3 / 15 min per IP |
| API   | `*/api/*`                  | 100 / min per IP  |

## 5. Headers

Cloudflare can add HSTS; nginx also sends HSTS. Do not duplicate conflicting values.

Forward `CF-IPCountry` — nginx passes it to the API as `CF-IPCountry` for login geo.

## 6. Rollback

1. Grey-cloud DNS records (disable proxy)
2. Traffic flows direct to VPS
3. Investigate false positives in WAF events

## 7. Post-cutover checks

- [ ] https://erp.donboscocollege.ac.in loads with valid cert
- [ ] Login works (math challenge + credentials)
- [ ] Razorpay fee checkout loads (CSP allows checkout.razorpay.com)
- [ ] Admissions and library subdomains resolve
- [ ] API receives `CF-IPCountry` on login audit logs
