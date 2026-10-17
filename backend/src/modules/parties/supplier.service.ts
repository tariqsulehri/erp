import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { PartyAccountService } from './party-account.service.js';
import type { PartyListQuery, SupplierInput, UpdateSupplierInput } from './party.schema.js';

const supplierAccountService = new PartyAccountService();

function cleanText(value: string | null | undefined) {
  return value?.trim() || null;
}

function supplierToResponse(supplier: any) {
  return {
    id: supplier.id,
    company_id: supplier.companyId,
    code: supplier.code,
    name: supplier.name,
    trade_name: supplier.tradeName,
    supplier_type: supplier.supplierType,
    party_type: supplier.partyType,
    main_role: supplier.mainRole,
    tax_registration_no: supplier.taxRegistrationNo,
    email: supplier.email,
    phone: supplier.phone,
    mobile: supplier.mobile,
    address: supplier.address,
    city: supplier.city,
    country: supplier.country,
    postal_code: supplier.postalCode,
    payment_terms_days: supplier.paymentTermsDays,
    currency_code: supplier.currencyCode,
    ap_account_id: supplier.apAccountId,
    advance_account_id: supplier.advanceAccountId,
    bank_name: supplier.bankName,
    bank_account_no: supplier.bankAccountNo,
    bank_swift_code: supplier.bankSwiftCode,
    bank_iban: supplier.bankIban,
    is_active: supplier.isActive,
    notes: supplier.notes,
    created_at: supplier.createdAt,
    updated_at: supplier.updatedAt,
  };
}

export class SupplierService {
  async nextCode(companyId: string) {
    const last = await prisma.supplier.findFirst({
      where: { companyId, code: { startsWith: 'SUP-', mode: 'insensitive' } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    const nextNumber = last ? Number.parseInt(last.code.split('-').pop() ?? '0', 10) + 1 : 1;
    return `SUP-${String(Number.isFinite(nextNumber) ? nextNumber : 1).padStart(4, '0')}`;
  }

  async list(companyId: string, query: PartyListQuery) {
    const where: Prisma.SupplierWhereInput = { companyId };

    if (query.is_active !== undefined) where.isActive = query.is_active;
    if (query.type) where.supplierType = query.type;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = query.page;
    const limit = query.limit;
    const [data, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        orderBy: [{ name: 'asc' }, { code: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.supplier.count({ where }),
    ]);

    return { data: data.map(supplierToResponse), total, page, limit };
  }

  async stats(companyId: string) {
    const [total, active, inactive, withBankDetails] = await Promise.all([
      prisma.supplier.count({ where: { companyId } }),
      prisma.supplier.count({ where: { companyId, isActive: true } }),
      prisma.supplier.count({ where: { companyId, isActive: false } }),
      prisma.supplier.count({
        where: {
          companyId,
          OR: [
            { bankAccountNo: { not: null } },
            { bankIban: { not: null } },
          ],
        },
      }),
    ]);

    return {
      total,
      active,
      inactive,
      with_bank_details: withBankDetails,
    };
  }

  async listAccounts(companyId: string) {
    return prisma.account.findMany({
      where: { companyId, isActive: true, isPosting: true },
      orderBy: { code: 'asc' },
      take: 500,
      select: { id: true, code: true, name: true, accountType: true },
    }).then(rows => rows.map(row => ({
      id: row.id,
      code: row.code,
      name: row.name,
      account_type: row.accountType,
    })));
  }

  async create(companyId: string, input: SupplierInput) {
    return prisma.$transaction(async transaction => {
      const code = (input.code?.trim().toUpperCase() || await this.nextCode(companyId));
      const existing = await transaction.supplier.findFirst({
        where: { companyId, code },
        select: { id: true },
      });

      if (existing) throw new Error(`Supplier Code "${code}" already exists.`);

      let linkedAccountId = input.ap_account_id;
      if (!linkedAccountId) {
        const linkedAccount = await supplierAccountService.createLinkedAccount(companyId, 'supplier', input.name, transaction);
        linkedAccountId = linkedAccount.id;
      }

      const supplier = await transaction.supplier.create({
        data: {
          companyId,
          code,
          name: input.name,
          tradeName: cleanText(input.trade_name),
          supplierType: input.supplier_type,
          partyType: input.party_type,
          mainRole: 'Supplier',
          taxRegistrationNo: cleanText(input.tax_registration_no),
          email: cleanText(input.email),
          phone: cleanText(input.phone),
          mobile: cleanText(input.mobile),
          address: cleanText(input.address),
          city: cleanText(input.city),
          country: cleanText(input.country),
          postalCode: cleanText(input.postal_code),
          paymentTermsDays: input.payment_terms_days,
          currencyCode: input.currency_code,
          apAccountId: linkedAccountId,
          advanceAccountId: input.advance_account_id ?? null,
          bankName: cleanText(input.bank_name),
          bankAccountNo: cleanText(input.bank_account_no),
          bankSwiftCode: cleanText(input.bank_swift_code),
          bankIban: cleanText(input.bank_iban),
          isActive: input.is_active,
          notes: cleanText(input.notes),
        },
      });
      return supplierToResponse(supplier);
    });
  }

  async update(companyId: string, id: string, input: UpdateSupplierInput) {
    const existingSupplier = await prisma.supplier.findFirst({ where: { id, companyId } });
    if (!existingSupplier) throw new Error('Supplier was not found.');

    return prisma.$transaction(async transaction => {
      const code = input.code?.trim().toUpperCase();
      if (code && code !== existingSupplier.code) {
        const conflict = await transaction.supplier.findFirst({
          where: { companyId, code },
          select: { id: true },
        });
        if (conflict) throw new Error(`Supplier Code "${code}" already exists.`);
      }

      if (input.name && input.name !== existingSupplier.name) {
        await supplierAccountService.syncLinkedAccountName(companyId, existingSupplier.apAccountId, 'supplier', input.name, transaction);
      }

      const supplier = await transaction.supplier.update({
        where: { id },
        data: {
          ...(code ? { code } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.trade_name !== undefined ? { tradeName: cleanText(input.trade_name) } : {}),
          ...(input.supplier_type !== undefined ? { supplierType: input.supplier_type } : {}),
          ...(input.party_type !== undefined ? { partyType: input.party_type } : {}),
          mainRole: 'Supplier',
          ...(input.tax_registration_no !== undefined ? { taxRegistrationNo: cleanText(input.tax_registration_no) } : {}),
          ...(input.email !== undefined ? { email: cleanText(input.email) } : {}),
          ...(input.phone !== undefined ? { phone: cleanText(input.phone) } : {}),
          ...(input.mobile !== undefined ? { mobile: cleanText(input.mobile) } : {}),
          ...(input.address !== undefined ? { address: cleanText(input.address) } : {}),
          ...(input.city !== undefined ? { city: cleanText(input.city) } : {}),
          ...(input.country !== undefined ? { country: cleanText(input.country) } : {}),
          ...(input.postal_code !== undefined ? { postalCode: cleanText(input.postal_code) } : {}),
          ...(input.payment_terms_days !== undefined ? { paymentTermsDays: input.payment_terms_days } : {}),
          ...(input.currency_code !== undefined ? { currencyCode: input.currency_code } : {}),
          ...(input.ap_account_id !== undefined ? { apAccountId: input.ap_account_id } : {}),
          ...(input.advance_account_id !== undefined ? { advanceAccountId: input.advance_account_id } : {}),
          ...(input.bank_name !== undefined ? { bankName: cleanText(input.bank_name) } : {}),
          ...(input.bank_account_no !== undefined ? { bankAccountNo: cleanText(input.bank_account_no) } : {}),
          ...(input.bank_swift_code !== undefined ? { bankSwiftCode: cleanText(input.bank_swift_code) } : {}),
          ...(input.bank_iban !== undefined ? { bankIban: cleanText(input.bank_iban) } : {}),
          ...(input.is_active !== undefined ? { isActive: input.is_active } : {}),
          ...(input.notes !== undefined ? { notes: cleanText(input.notes) } : {}),
        },
      });
      return supplierToResponse(supplier);
    });
  }

  async deactivate(companyId: string, id: string) {
    await prisma.supplier.updateMany({
      where: { id, companyId },
      data: { isActive: false },
    });
  }
}
