import { prisma } from '../../db/prisma.js';

export interface CompanyProfileUpdateInput {
  name?: string;
  description?: string | null;
  registration_number?: string | null;
  tax_id?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  fiscal_year_basis?: 'calendar' | 'july' | 'april';
  number_of_periods?: number;
}

export class CompanyProfileService {
  async getForCompany(companyId: string) {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        id,
        group_id,
        name,
        description,
        registration_number,
        tax_id,
        currency_code,
        address,
        city,
        country,
        phone,
        email,
        fiscal_year_basis,
        number_of_periods,
        is_active,
        created_at,
        updated_at
      FROM companies
      WHERE id = CAST(${companyId} AS uuid)
      LIMIT 1
    `;

    if (!rows[0]) {
      const error = new Error('Company was not found.');
      Object.assign(error, { statusCode: 404 });
      throw error;
    }

    return rows[0];
  }

  async updateForCompany(companyId: string, input: CompanyProfileUpdateInput) {
    const data: Record<string, unknown> = {};

    if ('name' in input) data.name = input.name;
    if ('description' in input) data.description = input.description;
    if ('registration_number' in input) data.registrationNumber = input.registration_number;
    if ('tax_id' in input) data.taxId = input.tax_id;
    if ('address' in input) data.address = input.address;
    if ('city' in input) data.city = input.city;
    if ('country' in input) data.country = input.country;
    if ('phone' in input) data.phone = input.phone;
    if ('email' in input) data.email = input.email;
    if ('fiscal_year_basis' in input) data.fiscalYearBasis = input.fiscal_year_basis;
    if ('number_of_periods' in input) data.numberOfPeriods = input.number_of_periods;

    await prisma.company.update({
      where: { id: companyId },
      data,
    });

    return this.getForCompany(companyId);
  }
}
