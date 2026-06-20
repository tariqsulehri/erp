import { z } from 'zod';

export const SUPPLIER_TYPES = ['individual', 'company', 'government'] as const;
export type SupplierType = typeof SUPPLIER_TYPES[number];
export const PARTY_TYPES = ['Customer', 'Supplier', 'Customer And Supplier'] as const;
export const MAIN_ROLES = ['Customer', 'Supplier'] as const;

/* ── Create ───────────────────────────────────────────────────── */
export const CreateSupplierInput = z.object({
  code:                z.string().min(1).max(20).toUpperCase().optional(), // auto if omitted
  name:                z.string().min(1).max(200).trim(),
  trade_name:          z.string().max(200).trim().optional(),
  supplier_type:       z.enum(SUPPLIER_TYPES).default('company'),
  party_type:          z.enum(PARTY_TYPES).default('Supplier'),
  main_role:           z.enum(MAIN_ROLES).default('Supplier'),
  tax_registration_no: z.string().max(50).trim().optional(),

  email:    z.string().email().optional().or(z.literal('')),
  phone:    z.string().max(30).optional(),
  mobile:   z.string().max(30).optional(),

  address:     z.string().max(500).optional(),
  city:        z.string().max(100).optional(),
  country:     z.string().max(100).optional(),
  postal_code: z.string().max(20).optional(),

  payment_terms_days: z.number().int().min(0).max(365).default(30),
  currency_code:      z.string().length(3).toUpperCase().default('PKR'),

  ap_account_id:      z.string().uuid().optional(),
  advance_account_id: z.string().uuid().optional(),

  bank_name:       z.string().max(100).optional(),
  bank_account_no: z.string().max(50).optional(),
  bank_swift_code: z.string().max(20).optional(),
  bank_iban:       z.string().max(34).optional(),

  is_active: z.boolean().default(true),
  notes:     z.string().max(1000).optional(),
});
export type CreateSupplierInput = z.infer<typeof CreateSupplierInput>;

/* ── Update ───────────────────────────────────────────────────── */
export const UpdateSupplierInput = CreateSupplierInput.partial().extend({
  id: z.string().uuid(),
});
export type UpdateSupplierInput = z.infer<typeof UpdateSupplierInput>;

/* ── List / filter query ──────────────────────────────────────── */
export const ListSuppliersQuery = z.object({
  search:        z.string().optional(),
  supplier_type: z.enum(SUPPLIER_TYPES).optional(),
  is_active:     z.boolean().optional(),
  page:          z.number().int().min(1).default(1),
  limit:         z.number().int().min(1).max(200).default(50),
});
export type ListSuppliersQuery = z.infer<typeof ListSuppliersQuery>;
