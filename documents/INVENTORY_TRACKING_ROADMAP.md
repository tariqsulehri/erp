# Inventory Tracking Roadmap

This document defines the target model for multi-branch and multi-warehouse inventory tracking, the accounting treatment, the controls required, and the gaps compared with professional ERP systems (SAP Business One, Microsoft Dynamics, Oracle NetSuite, Odoo).

For how the code works today, see `INVENTORY_CURRENT_STATE.md`. Deficiency codes (D1–D13, F1–F9) in this file refer to that document.

Date: 2026-09-30.

---

## 1. Business Requirements

1. An item is defined **once**, centrally, for the whole company. Branches never create or edit items.
2. A warehouse may be far from the branches it supplies.
3. Each branch keeps **its own stock** and performs only operations: stock receipt, sale, sale return, stock count (audit), and stock adjustment.
4. Supported transfers:
   - Warehouse to Warehouse
   - Warehouse to Branch
   - Branch to Branch
5. Stock at any point must be traceable with a simple formula.

---

## 2. Target Model

### 2.1 Stock Points

Every place that holds stock is a **stock point**, stored as a row in `inventory_warehouses`.

| Stock point | `branch_id` | Example |
|---|---|---|
| Central warehouse | Head office branch, or none | "Main Warehouse Karachi" |
| Branch store | The branch | "Lahore Branch Store" |

No separate branch-stock table is needed. `inventory_stock_balances` and `inventory_stock_movements` already work per warehouse, so all ledgers, costing, and reports apply unchanged.

**Branch stock = sum of all stock points linked to that branch.**

### 2.2 Item Master

| Level | Holds |
|---|---|
| Company | Item definition: code, SKU, category, units, valuation method, prices |
| Stock point | Quantity on hand, average cost, stock value |
| Branch (optional, later) | Branch item settings: reorder level, minimum stock, whether the branch sells the item |

### 2.3 Stock Formula

For each stock point and period, in **quantity and value**:

```
Closing Stock = Opening Stock
              + Purchases        − Purchase Returns
              − Sales            + Sale Returns
              + Transfers In     − Transfers Out
              ± Adjustments      (count differences, damage, expiry)
```

This is the standard perpetual inventory reconciliation. It is reliable only when:

- every stock change comes from a posted document (never a direct edit),
- corrections are made by reversal (never by deletion),
- opening stock is entered through a document,
- transfers use the two-step flow with Stock In Transit,
- stock value is reconciled to the General Ledger every month.

Each term maps directly to a `movement_kind` in `inventory_stock_movements`, so the report can be built from existing data.

---

## 3. Transfers

### 3.1 One Transfer Document For All Types

Warehouse-to-warehouse, warehouse-to-branch, and branch-to-branch transfers are the same transaction: stock moving between two stock points of the same legal company. Use **one** transfer document. The system classifies it from the branches of the two stock points:

| From → To | Classification | GL impact |
|---|---|---|
| Stock point → stock point, same branch | Internal Move | None — location change only |
| Central warehouse → branch store | Branch Supply | Stock value moves to the receiving branch |
| Branch A → Branch B | Inter-Branch Transfer | Stock value moves between branches |

### 3.2 Two-Step Flow With Stock In Transit

| Status | Action | Performed by | Stock effect |
|---|---|---|---|
| Draft | Create transfer | Sender | None |
| Dispatched | Post dispatch | Sender | Out of source, into In Transit |
| Received | Confirm received quantities | Receiver | Out of In Transit, into destination |
| Received With Difference | Record short / damaged quantity | Receiver, approved | Difference to Transit Loss or Claim |
| Voided | Reverse | Authorised user | Opposite movements |

Same-branch internal moves may use a one-step post (dispatch and receive together).

New movement kinds needed: `TRANSIT_OUT` (source to transit), `TRANSIT_IN` (transit to destination), or equivalent use of `TRANSFER_OUT` / `TRANSFER_IN` with an in-transit stock point.

### 3.3 Stock Request

A branch raises a **Stock Request** listing items and quantities. The warehouse creates the transfer against the request. This records what was requested, what was sent, and what was received.

---

## 4. Accounting Treatment

### 4.1 Principles

1. **A transfer is not a sale.** Moving stock inside one legal company is not revenue.
2. **Transfer at cost.** Use the sending stock point's weighted average cost at dispatch (current code already does this).
3. **Management markup** between branches, if wanted, stays in management reports only. Unrealised profit is removed from financial statements.
4. **Freight on transfers** may be added to the receiving stock cost (IAS 2 allows costs of bringing inventory to its present location). Choose one policy — add to cost or expense — and apply it consistently.
5. **Goods in transit at period end** remain company inventory and appear in the balance sheet.

### 4.2 Journal Entries

Applies when branches keep separate accounts (branch dimension on voucher lines).

| Event | Debit | Credit |
|---|---|---|
| Dispatch | Stock In Transit | Inventory (Sending Branch) |
| Receive, full | Inventory (Receiving Branch) | Stock In Transit |
| Receive, short or damaged | Transit Loss, or Claim Receivable | Stock In Transit |
| Internal move, same branch | — | — |

**Control:** Stock In Transit must return to zero once all shipments are received. Any balance is an unreceived or missing shipment.

### 4.3 Branch Accounting

Prefer a **branch dimension on voucher lines** over inter-branch clearing accounts. The company keeps one Inventory account, and branch Profit And Loss and stock value come from filtering by branch.

---

## 5. Required Controls

| # | Control | Current status |
|---|---|---|
| C1 | Monthly reconciliation: stock value from movements = Inventory GL balance | Missing |
| C2 | Segregation of duties: dispatcher ≠ receiver; receipt confirmed at destination | Missing |
| C3 | Adjustments require approval and a reason code (damage, expiry, count difference, theft) | Missing — adjustments post as Approved |
| C4 | Periodic physical stock counts (cycle counts + year-end full count); variances posted by approved adjustment | Missing |
| C5 | No negative stock | **In place** |
| C6 | No posting into a closed fiscal period | **In place** |
| C7 | Opening stock entered through an auditable document | Missing — seed script only |
| C8 | Posted documents immutable; corrections by reversal | Partly — no reversal flow exists |
| C9 | Role and branch based permissions on posting | Missing |

---

## 6. Gap Analysis Against Professional ERPs

### 6.1 Already Sound

- Item master defined once per company.
- Every stock change writes a movement row (full history).
- Balance rows locked during posting.
- Negative stock blocked.
- Weighted average costing working.
- Fiscal period check on posting.
- Warehouses linked to branches; location control per warehouse.

### 6.2 Critical — Trust In The Numbers

| # | Gap | Professional ERP standard | Ref |
|---|---|---|---|
| G1 | Voiding a system voucher leaves stock unchanged | Cancelling reverses stock and journal together | D5 |
| G2 | No reversal flow for any stock document | Cancel / reverse creates linked opposite movements | D6 |
| G3 | No stock-to-GL reconciliation | Standard inventory vs ledger report | C1 |
| G4 | No permissions; user from a raw header | Role-based rights plus branch / warehouse restriction | D13 |
| G5 | Adjustments post without approval | Approval workflow with value / quantity limits | C3 |
| G6 | Adjustment account settings overwritten on every post | Account mapping configured once (by item group or warehouse) | D4 |
| G7 | Opening stock only via seed script | Opening balance document or import | C7 |

### 6.3 High — Multi-Branch Operations

| # | Gap | Professional ERP standard | Ref |
|---|---|---|---|
| G8 | One-step transfer, no Stock In Transit | Dispatch → In Transit → Receive, with difference handling | §3.2 |
| G9 | Branch not enforced on stock documents | Documents scoped to a branch; warehouse list filtered | — |
| G10 | No branch dimension on voucher lines | Profit And Loss and balance sheet by branch / cost centre | §4.3 |
| G11 | No stock request from branch | Request → transfer order → dispatch | §3.3 |
| G12 | No physical stock count | Freeze, count, variance report, approved posting | C4 |
| G13 | No stock reservation | Orders reserve; available = on hand − reserved | — |

### 6.4 Medium — Reporting

| # | Gap | Professional ERP standard | Ref |
|---|---|---|---|
| G14 | No stock ledger (item movement history) | By item / stock point / date with running balance | F2 |
| G15 | No stock movement summary | Opening → movement types → closing, quantity and value | §2.3 |
| G16 | No valuation report as of a date | Valuation at any past date by stock point, branch, category | F3 |
| G17 | No ageing / slow-moving report | Ageing buckets and dead-stock analysis for write-downs | — |
| G18 | No reorder / low-stock report | Reorder suggestions per stock point | F3 |
| G19 | Drafts cannot be reopened or posted from UI | Status-filtered list: open, edit, post | F1 |

### 6.5 Medium — Costing And Data Accuracy

| # | Gap | Professional ERP standard | Ref |
|---|---|---|---|
| G20 | Sale cost captured at draft, not posting | Cost fixed at posting | D7 |
| G21 | Stock value rounding 2 dp vs 4 dp | One rule; round only when creating vouchers | D8 |
| G22 | No database guard against double posting | Unique key on source document + line | D11 |
| G23 | No landed cost (freight, duty) | Landed cost document spread over received items | — |
| G24 | Back-dated entries do not recalculate later costs | Forward cost recalculation, or back-dating limits | — |

### 6.6 Lower — Later Features

- Unit conversions (buy in cartons, sell in pieces) — table exists, unused.
- Batch / lot numbers with expiry; serial numbers.
- FIFO and standard costing — declared, only weighted average works.
- Price lists per branch or customer group; branch item settings.
- Multi-level bin locations and put-away.
- Barcode scanning in receipt, sale, and stock count.
- Goods receipt separate from purchase invoice (three-way match: order, receipt, invoice).
- Audit trail for item master and price changes.

---

## 7. Stock Movement Summary Report

The key report for daily tracking and audit. One row per item (or totals per stock point) for the selected period:

| Opening | Purchase | Purchase Return | Sale | Sale Return | Transfer In | Transfer Out | Adjustment + | Adjustment − | In Transit | Closing |
|---|---|---|---|---|---|---|---|---|---|---|

- Quantity and value columns.
- Filters: stock point, branch, category, item, date range.
- Drill-down from any cell to the stock ledger.
- Totals must agree with the Inventory GL balance (control C1).

---

## 8. Implementation Priority

| Phase | Goal | Items |
|---|---|---|
| 1 | Numbers can be proven to an auditor | G1, G2, G3, G6, G7, G21, G22 |
| 2 | Branch and distant warehouse operations | Branch store stock points, G9, G8, G11, G12 |
| 3 | Daily visibility | G14, G15, G16, G19, G18 |
| 4 | Controls before branch users go live | G4, G5, G10 |
| 5 | Accuracy and extensions | G20, G23, G24, G13, G17, §6.6 |

Before coding Phase 2, write a design covering transfer statuses, new movement kinds, the Stock In Transit account, database changes, and posting rules, and update `ACCOUNTING_POSTING_RULES.md` with the transfer journal entries.
