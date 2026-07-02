import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { PartyAccountService } from './party-account.service.js';
import type { CustomerInput, PartyListQuery, UpdateCustomerInput } from './party.schema.js';

const customerAccountService = new PartyAccountService();

function cleanText(value: string | null | undefined) {
  return value?.trim() || null;
}

function customerToResponse(customer: any, linkedAccount?: { code: string; name: string } | null) {
  return {
    id: customer.id,
    company_id: customer.companyId,
    code: customer.code,
    name: customer.name,
    trade_name: customer.tradeName,
    customer_type: customer.customerType,
    party_type: customer.partyType,
    main_role: customer.mainRole,
    tax_registration_no: customer.taxRegistrationNo,
    email: customer.email,
    phone: customer.phone,
    mobile: customer.mobile,
    billing_address: customer.billingAddress,
    shipping_address: customer.shippingAddress,
    city: customer.city,
    country: customer.country,
    postal_code: customer.postalCode,
    payment_terms_days: customer.paymentTermsDays,
    credit_limit: Number(customer.creditLimit ?? 0),
    currency_code: customer.currencyCode,
    ar_account_id: customer.arAccountId,
    ar_account_code: linkedAccount?.code ?? null,
    ar_account_name: linkedAccount?.name ?? null,
    advance_account_id: customer.advanceAccountId,
    is_active: customer.isActive,
    notes: customer.notes,
    created_at: customer.createdAt,
    updated_at: customer.updatedAt,
  };
}

export class CustomerService {
  async nextCode(companyId: string) {
    const last = await prisma.customer.findFirst({
      where: { companyId, code: { startsWith: 'CUS-', mode: 'insensitive' } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    const nextNumber = last ? Number.parseInt(last.code.split('-').pop() ?? '0', 10) + 1 : 1;
    return `CUS-${String(Number.isFinite(nextNumber) ? nextNumber : 1).padStart(4, '0')}`;
  }

  async list(companyId: string, query: PartyListQuery) {
    const where: Prisma.CustomerWhereInput = { companyId };

    if (query.is_active !== undefined) where.isActive = query.is_active;
    if (query.type) where.customerType = query.type;
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
      prisma.customer.findMany({
        where,
        orderBy: [{ name: 'asc' }, { code: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);
    const linkedAccounts = await this.linkedAccounts(companyId, data.map(customer => customer.arAccountId).filter(Boolean) as string[]);

    return {
      data: data.map(customer => customerToResponse(customer, customer.arAccountId ? linkedAccounts.get(customer.arAccountId) : null)),
      total,
      page,
      limit,
    };
  }

  private async linkedAccounts(companyId: string, accountIds: string[]) {
    if (accountIds.length === 0) return new Map<string, { code: string; name: string }>();

    const accounts = await prisma.account.findMany({
      where: { companyId, id: { in: Array.from(new Set(accountIds)) } },
      select: { id: true, code: true, name: true },
    });

    return new Map(accounts.map(account => [account.id, { code: account.code, name: account.name }]));
  }

  async stats(companyId: string) {
    const [total, active, inactive, credit] = await Promise.all([
      prisma.customer.count({ where: { companyId } }),
      prisma.customer.count({ where: { companyId, isActive: true } }),
      prisma.customer.count({ where: { companyId, isActive: false } }),
      prisma.customer.aggregate({
        where: { companyId, isActive: true },
        _sum: { creditLimit: true },
      }),
    ]);

    return {
      total,
      active,
      inactive,
      total_credit_limit: Number(credit._sum.creditLimit ?? 0),
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

  async create(companyId: string, input: CustomerInput) {
    return prisma.$transaction(async transaction => {
      const code = (input.code?.trim().toUpperCase() || await this.nextCode(companyId));
      const existing = await transaction.customer.findFirst({
        where: { companyId, code },
        select: { id: true },
      });

      if (existing) throw new Error(`Customer Code "${code}" already exists.`);

      let linkedAccountId = input.ar_account_id;
      if (!linkedAccountId) {
        const linkedAccount = await customerAccountService.createLinkedAccount(companyId, 'customer', input.name, transaction);
        linkedAccountId = linkedAccount.id;
      }

      const customer = await transaction.customer.create({
        data: {
          companyId,
          code,
          name: input.name,
          tradeName: cleanText(input.trade_name),
          customerType: input.customer_type,
          partyType: input.party_type,
          mainRole: 'Customer',
          taxRegistrationNo: cleanText(input.tax_registration_no),
          email: cleanText(input.email),
          phone: cleanText(input.phone),
          mobile: cleanText(input.mobile),
          billingAddress: cleanText(input.billing_address),
          shippingAddress: cleanText(input.shipping_address),
          city: cleanText(input.city),
          country: cleanText(input.country),
          postalCode: cleanText(input.postal_code),
          paymentTermsDays: input.payment_terms_days,
          creditLimit: input.credit_limit,
          currencyCode: input.currency_code,
          arAccountId: linkedAccountId,
          advanceAccountId: input.advance_account_id ?? null,
          isActive: input.is_active,
          notes: cleanText(input.notes),
        },
      });
      return customerToResponse(customer);
    });
  }

  async update(companyId: string, id: string, input: UpdateCustomerInput) {
    const existingCustomer = await prisma.customer.findFirst({ where: { id, companyId } });
    if (!existingCustomer) throw new Error('Customer was not found.');

    return prisma.$transaction(async transaction => {
      const code = input.code?.trim().toUpperCase();
      if (code && code !== existingCustomer.code) {
        const conflict = await transaction.customer.findFirst({
          where: { companyId, code },
          select: { id: true },
        });
        if (conflict) throw new Error(`Customer Code "${code}" already exists.`);
      }

      if (input.name && input.name !== existingCustomer.name) {
        await customerAccountService.syncLinkedAccountName(companyId, existingCustomer.arAccountId, 'customer', input.name, transaction);
      }

      const customer = await transaction.customer.update({
        where: { id },
        data: {
          ...(code ? { code } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.trade_name !== undefined ? { tradeName: cleanText(input.trade_name) } : {}),
          ...(input.customer_type !== undefined ? { customerType: input.customer_type } : {}),
          ...(input.party_type !== undefined ? { partyType: input.party_type } : {}),
          mainRole: 'Customer',
          ...(input.tax_registration_no !== undefined ? { taxRegistrationNo: cleanText(input.tax_registration_no) } : {}),
          ...(input.email !== undefined ? { email: cleanText(input.email) } : {}),
          ...(input.phone !== undefined ? { phone: cleanText(input.phone) } : {}),
          ...(input.mobile !== undefined ? { mobile: cleanText(input.mobile) } : {}),
          ...(input.billing_address !== undefined ? { billingAddress: cleanText(input.billing_address) } : {}),
          ...(input.shipping_address !== undefined ? { shippingAddress: cleanText(input.shipping_address) } : {}),
          ...(input.city !== undefined ? { city: cleanText(input.city) } : {}),
          ...(input.country !== undefined ? { country: cleanText(input.country) } : {}),
          ...(input.postal_code !== undefined ? { postalCode: cleanText(input.postal_code) } : {}),
          ...(input.payment_terms_days !== undefined ? { paymentTermsDays: input.payment_terms_days } : {}),
          ...(input.credit_limit !== undefined ? { creditLimit: input.credit_limit } : {}),
          ...(input.currency_code !== undefined ? { currencyCode: input.currency_code } : {}),
          ...(input.ar_account_id !== undefined ? { arAccountId: input.ar_account_id } : {}),
          ...(input.advance_account_id !== undefined ? { advanceAccountId: input.advance_account_id } : {}),
          ...(input.is_active !== undefined ? { isActive: input.is_active } : {}),
          ...(input.notes !== undefined ? { notes: cleanText(input.notes) } : {}),
        },
      });
      return customerToResponse(customer);
    });
  }

  async deactivate(companyId: string, id: string) {
    await prisma.customer.updateMany({
      where: { id, companyId },
      data: { isActive: false },
    });
  }
}
