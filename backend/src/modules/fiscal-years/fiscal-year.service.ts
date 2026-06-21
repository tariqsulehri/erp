import type { FiscalPeriod, FiscalYear, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { createFiscalYearSchema } from './fiscal-year.schema.js';
import type { z } from 'zod';

type CreateFiscalYearInput = z.infer<typeof createFiscalYearSchema>;

function businessError(message: string, statusCode = 400) {
  const error = new Error(message);
  Object.assign(error, { statusCode });
  return error;
}

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDateText(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addMonths(value: Date, months: number) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, value.getUTCDate()));
}

function endOfMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0));
}

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function mapFiscalYear(fiscalYear: FiscalYear) {
  return {
    id: fiscalYear.id,
    company_id: fiscalYear.companyId,
    fiscal_year: fiscalYear.fiscalYear,
    year_basis: fiscalYear.yearBasis,
    start_date: toDateText(fiscalYear.startDate),
    end_date: toDateText(fiscalYear.endDate),
    number_of_periods: fiscalYear.numberOfPeriods,
    period_type: fiscalYear.periodType,
    posting_cutoff_days: fiscalYear.postingCutoffDays,
    status: fiscalYear.status,
    is_active: fiscalYear.isActive,
    is_locked: fiscalYear.isLocked,
    locked_at: fiscalYear.lockedAt?.toISOString() ?? null,
    transaction_count: fiscalYear.transactionCount,
    total_debits: fiscalYear.totalDebits.toString(),
    total_credits: fiscalYear.totalCredits.toString(),
    notes: fiscalYear.notes,
    created_at: fiscalYear.createdAt.toISOString(),
    updated_at: fiscalYear.updatedAt.toISOString(),
  };
}

function mapFiscalPeriod(period: FiscalPeriod) {
  return {
    id: period.id,
    company_id: period.companyId,
    fiscal_year_id: period.fiscalYearId,
    period_number: period.periodNumber,
    period_name: period.periodName,
    start_date: toDateText(period.startDate),
    end_date: toDateText(period.endDate),
    status: period.status,
    is_open: period.isOpen,
    is_locked: period.isLocked,
    locked_at: period.lockedAt?.toISOString() ?? null,
    posting_cutoff_days: period.postingCutoffDays,
    transaction_count: period.transactionCount,
    total_debits: period.totalDebits.toString(),
    total_credits: period.totalCredits.toString(),
    notes: period.notes,
    created_at: period.createdAt.toISOString(),
    updated_at: period.updatedAt.toISOString(),
  };
}

export class FiscalYearService {
  constructor(private readonly companyId: string) {}

  async list(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where: Prisma.FiscalYearWhereInput = {
      companyId: this.companyId,
      isDeleted: false,
    };

    const [total, rows] = await prisma.$transaction([
      prisma.fiscalYear.count({ where }),
      prisma.fiscalYear.findMany({
        where,
        orderBy: [{ startDate: 'desc' }, { fiscalYear: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      data: rows.map(mapFiscalYear),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async create(input: CreateFiscalYearInput) {
    const startDate = parseDateOnly(input.start_date);
    const endDate = parseDateOnly(input.end_date);
    if (startDate >= endDate) {
      throw businessError('Start Date must be before End Date.');
    }

    return prisma.$transaction(async tx => {
      const overlappingYear = await tx.fiscalYear.findFirst({
        where: {
          companyId: this.companyId,
          isDeleted: false,
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
      });
      if (overlappingYear) {
        throw businessError('Fiscal Year dates overlap with an existing Fiscal Year.');
      }

      await tx.fiscalYear.updateMany({
        where: { companyId: this.companyId, isDeleted: false, isActive: true },
        data: { isActive: false },
      });

      const fiscalYear = await tx.fiscalYear.create({
        data: {
          companyId: this.companyId,
          fiscalYear: input.fiscal_year,
          yearBasis: input.year_basis,
          startDate,
          endDate,
          numberOfPeriods: input.number_of_periods,
          periodType: 'monthly',
          postingCutoffDays: input.posting_cutoff_days,
          status: 'open',
          isActive: true,
          periods: {
            create: this.buildPeriods(startDate, endDate, input.number_of_periods, input.posting_cutoff_days),
          },
        },
        include: { periods: { orderBy: { periodNumber: 'asc' } } },
      });

      return {
        success: true,
        fiscal_year: mapFiscalYear(fiscalYear),
        periods: fiscalYear.periods.map(mapFiscalPeriod),
        message: 'Fiscal Year created successfully.',
      };
    });
  }

  async getPeriods(fiscalYearId: string) {
    await this.assertFiscalYearExists(fiscalYearId);
    const periods = await prisma.fiscalPeriod.findMany({
      where: {
        companyId: this.companyId,
        fiscalYearId,
        isDeleted: false,
      },
      orderBy: { periodNumber: 'asc' },
    });
    return periods.map(mapFiscalPeriod);
  }

  async lockFiscalYear(fiscalYearId: string) {
    await this.assertFiscalYearExists(fiscalYearId);
    await prisma.fiscalYear.update({
      where: { id: fiscalYearId },
      data: {
        isLocked: true,
        status: 'closing',
        lockedAt: new Date(),
        closingStartedAt: new Date(),
      },
    });
    return { success: true, message: 'Fiscal Year locked successfully.' };
  }

  async lockPeriod(periodId: string) {
    const period = await this.assertPeriodExists(periodId);
    if (period.status === 'closed') {
      throw businessError('Closed periods cannot be locked again.');
    }

    await prisma.fiscalPeriod.update({
      where: { id: periodId },
      data: {
        isOpen: false,
        isLocked: true,
        status: 'locked',
        lockedAt: new Date(),
      },
    });

    return { success: true, message: 'Fiscal Period locked successfully.' };
  }

  async closePeriod(periodId: string) {
    const period = await this.assertPeriodExists(periodId);
    const openCount = await prisma.fiscalPeriod.count({
      where: {
        companyId: this.companyId,
        fiscalYearId: period.fiscalYearId,
        isDeleted: false,
        isOpen: true,
      },
    });

    if (openCount <= 1 && period.isOpen) {
      throw businessError('Cannot close the last open period. At least one period must remain open.');
    }

    await prisma.fiscalPeriod.update({
      where: { id: periodId },
      data: {
        isOpen: false,
        isLocked: true,
        status: 'closed',
      },
    });

    return { success: true, message: 'Fiscal Period closed successfully.' };
  }

  private buildPeriods(startDate: Date, endDate: Date, numberOfPeriods: number, postingCutoffDays: number) {
    return Array.from({ length: numberOfPeriods }, (_, index) => {
      const periodStart = addMonths(startDate, index);
      const periodEnd = index === numberOfPeriods - 1 ? endDate : endOfMonth(periodStart);
      return {
        companyId: this.companyId,
        periodNumber: index + 1,
        periodName: `${monthNames[periodStart.getUTCMonth()]} ${periodStart.getUTCFullYear()}`,
        startDate: periodStart,
        endDate: periodEnd,
        status: 'open',
        isOpen: true,
        postingCutoffDays,
      };
    });
  }

  private async assertFiscalYearExists(fiscalYearId: string) {
    const fiscalYear = await prisma.fiscalYear.findFirst({
      where: {
        id: fiscalYearId,
        companyId: this.companyId,
        isDeleted: false,
      },
    });
    if (!fiscalYear) {
      throw businessError('Fiscal Year was not found.', 404);
    }
    return fiscalYear;
  }

  private async assertPeriodExists(periodId: string) {
    const period = await prisma.fiscalPeriod.findFirst({
      where: {
        id: periodId,
        companyId: this.companyId,
        isDeleted: false,
      },
    });
    if (!period) {
      throw businessError('Fiscal Period was not found.', 404);
    }
    return period;
  }
}

