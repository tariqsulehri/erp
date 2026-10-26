# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Accounting, inventory, purchasing, and sales staff at small and mid-sized companies, working at desktop computers through a full working day. Many are non-native English speakers and not highly technical. Supervisors and approvers review and post documents. (Source: CLAUDE.md UI rules and the voucher approval workflow.)

## Product Purpose

A multi-company ERP that records financial vouchers, chart of accounts, customers, suppliers, inventory, purchases, sales, and returns, and posts them to the ledger and stock history correctly. Success is fast, error-free data entry and posted records that can be trusted.

## Positioning

Accounting-grade correctness for day-to-day operations: posted accounting and stock transactions are immutable and corrected only by reversal or adjustment, stock history is the source of truth, and every figure on screen follows the company's own settings for currency, dates, and numbers.

## Operating Context

- Staff enter vouchers with many line items, in long sessions, mostly by keyboard.
- Documents move Draft → Approval → Posted; fiscal periods open and close.
- Master data (branches, warehouses, cities, areas, items, units) is maintained in list screens.
- Printed vouchers and reports are shared with managers and auditors.

## Capabilities and Constraints

- Frontend: Next.js (`frontend/`). Backend: Express + Prisma + PostgreSQL (`backend/`), which owns all business rules.
- Date format, currency, timezone, country, and number formatting come from settings, never hardcoded.
- Account codes are 10-digit `MM GG SS PPPP`.
- Two themes only: Light and Dark (confirmed 2026-09-29).
- Primary target is desktop (1280px and wider). Tablet and phone layouts are not yet supported (inferred from the current app shell; open decision).

## Brand Commitments

- Visual direction "Calm Ledger", chosen by the product owner on 2026-09-29: quiet, precise, trustworthy; white working surfaces, one blue for actions, navy only for navigation, no decorative gradients.
- Compact density: 32px controls and fields.

## Product Principles

1. Correctness is visible: numbers align, totals reconcile, status is always shown.
2. Plain words over jargon; labels in Title Case.
3. The same task looks the same on every screen.
4. Speed for repeat users beats first-glance decoration.

## Accessibility & Inclusion

- WCAG 2.1 AA contrast for text and controls in both themes.
- 12px minimum text size; visible keyboard focus on every control.
- Required fields marked with `*`; errors say what is wrong and how to fix it.
