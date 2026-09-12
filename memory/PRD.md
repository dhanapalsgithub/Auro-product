# Auro Products — GST Billing & Cotton Box Management

## Original Problem Statement
Billing software for **Auro Products**, a contractor holding a Tamil Nadu TASMAC wine-shop **cotton box** supply/recycling tender. Must handle **149 wine shops** (identified by shop number + location). Cotton boxes are picked up on a **per-shop cycle** (default 5 days, some shops 2 days). Cotton box unit = **PCS**, waste unit = **kg**, where **waste = quantity ÷ 12**. After an inventory entry, the shop must be reminded again after its cycle days. GST is **18% (9% CGST + 9% SGST)**. Company/GST/address/logo derived from the uploaded PDF invoice (Auro Products, GSTIN 33AITPM1982E1Z1, Trichy, Tamil Nadu). Liquid-glass professional UI with sidebar, settings, pagination, calendar, CSV export, and a printable GST tax invoice.

## Architecture
- **Backend**: FastAPI + MongoDB (motor). JWT auth (Bearer token in localStorage). Collections: users, shops, entries, invoices, settings, counters.
- **Frontend**: React 19 + Tailwind (liquid-glass theme, Outfit/IBM Plex Sans/JetBrains Mono), recharts, sonner toasts, react-router.
- **Auth**: username/password (bcrypt + PyJWT). Admin seeded from env.

## User Persona
Single operator/admin managing the cotton box tender across 149 TASMAC shops — enters pickups, tracks waste, raises GST invoices, monitors due reminders.

## Core Requirements (static)
- 149 shops directory by shop_no + location, searchable, district filter, paginated.
- Per-shop configurable pickup cycle (default 5, some 2 days).
- Box entry with live waste = qty/12 kg.
- Reminder engine: next pickup = last entry + cycle_days; overdue/due-today/upcoming.
- GST invoice: 18% (CGST 9% + SGST 9%), HSN 4819, round off, amount in words, print layout.
- Settings for company/GST/rates/bank/terms.
- All tables paginated + CSV export; calendar view of pickups.

## Implemented (2026-06)
- JWT login, admin seed (bmartbuild4@gmail.com).
- 149 auto-seeded shops across TN districts; shops CRUD + search + district filter + pagination.
- Cotton box entry with live waste calc + entries table (paginated, export).
- Dashboard: stats + urgency-sorted pickup reminders + alert counter in header.
- GST invoices: create, list (search + date range), print/PDF view matching Indian tax invoice.
- Waste analytics (top shops bar + monthly line charts).
- Calendar month grid of pickups with month navigation.
- Settings page (company/tax/bank/terms) with persistence.
- Verified 100% by testing agent (16/16 backend, all frontend flows).

### Iteration 2 (2026-06)
- Multi-line-item invoices with per-item rate; part payments with status (unpaid/partial/paid).
- Payments & Ledger page: payment history + per-shop ledger (opening/debit/credit/closing, running balance).
- Reports page: daily + monthly summaries with charts and CSV export.
- Inventory dashboard: per-shop boxes/waste/last-entry, searchable + export.
- Bulk shop import (CSV/XLSX) updating supervisor & contact by shop_no.
- Invoice UPI QR (qrcode.react) + bank details + "Built by R I Billing Pro" footer; app logo updated to uploaded AP logo (ri-logo.png).
- Auto reminders: daily 9 AM IST cron (.emergent/crons.yml -> /api/cron/reminders, Bearer WEBHOOK_CRON_SECRET) sending EMAIL via Resend (working) + WhatsApp/SMS via Twilio (activates when TWILIO_* env creds added).
- Verified 100% by testing agent (26/26 backend, all frontend flows).

## Integrations
- Resend (Emergent managed) — email reminders. Working, no key needed.
- Twilio — WhatsApp/SMS reminders. OPTIONAL: needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (and/or TWILIO_SMS_FROM) in backend/.env. Currently EMPTY -> WhatsApp/SMS skipped gracefully.

## Backlog / Remaining
- **P1**: Multi-line-item invoices; edit existing invoice; supervisor/contact bulk import for shops.
- **P1**: Real bank details + QR/UPI on invoice; invoice number series config.
- **P2**: Explicit CORS origin for production; timezone-safe date filtering.
- **P2**: Multi-user roles; audit log; email/WhatsApp pickup reminders.

## Notes
- Waste divisor is configurable in Settings (default 12).
- Auth is Bearer token in localStorage key `auro_token`.
