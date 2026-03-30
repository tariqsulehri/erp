import { AppDataSource } from '@/db/data-source';
import { COATemplate, TemplateAccount, ACCOUNT_CATEGORIES } from './coa-template.entity';
import { Account } from './account.entity';
import { AccountService } from './account.service';

/**
 * ============================================================================
 * COA Template Service
 * ============================================================================
 *
 * Manages predefined Chart of Accounts templates and instantiates them for
 * new companies.
 *
 * 4-digit hierarchy (all codes exactly 4 digits):
 *   X000  Category   (÷1000)  — top-level, non-posting
 *   XX00  Group      (÷100)   — non-posting
 *   XXX0  Sub-Group  (÷10)    — non-posting
 *   XXXX  Posting    (other)  — receives journal entries
 *
 * All four levels are stored explicitly in the template.accounts array.
 * buildOrderedEntries() sorts them Category → Group → Sub-Group → Posting
 * so parent accounts are always created before their children.
 *
 * 5 Standard Account Types:
 *   Asset | Liability | Equity | Revenue | Expense
 *
 * COGS, Operating Expenses, and Tax Expenses all map to type = Expense.
 * ============================================================================
 */

export class COATemplateService {
  private templateRepo = AppDataSource.getRepository(COATemplate);

  /** Return all active templates */
  async getTemplates(): Promise<COATemplate[]> {
    return this.templateRepo.find({ where: { is_active: true } });
  }

  /** Return a single template by its code */
  async getTemplateByCode(code: string): Promise<COATemplate | null> {
    return this.templateRepo.findOne({ where: { template_code: code, is_active: true } });
  }

  /**
   * Instantiate a COA template for a company.
   *
   * Inserts accounts in level order (Category → Group → Sub-Group → Posting).
   * Accounts already present in the company are skipped (idempotent).
   *
   * @param companyId    Target company UUID
   * @param templateCode Template identifier (e.g. "TRADING")
   */
  async instantiateTemplate(companyId: string, templateCode: string): Promise<Account[]> {
    const template = await this.getTemplateByCode(templateCode);
    if (!template) throw new Error(`Template ${templateCode} not found`);

    const service = new AccountService(companyId);
    const created: Account[] = [];
    const ordered = this.buildOrderedEntries(template.accounts);

    for (const entry of ordered) {
      const existing = await service.getAccountByCode(entry.code);
      if (existing) continue;

      try {
        const num = parseInt(entry.code, 10);
        const isHeader = num % 10 === 0; // ends in 0 → category / group / sub-group

        const account = isHeader
          ? await service.createHeaderAccount(
              entry.code,
              entry.name,
              entry.account_type,
              entry.normal_balance,
            )
          : await service.createAccount({
              code:           entry.code,
              name:           entry.name,
              account_type:   entry.account_type,
              normal_balance: entry.normal_balance,
              is_posting:     entry.is_posting,
              is_system:      entry.is_system ?? false,
              description:    entry.description,
              sort_order:     entry.sort_order,
            });

        created.push(account);
      } catch (err) {
        console.error(`Failed to create account ${entry.code}:`, err);
        throw err;
      }
    }

    console.log(
      `Instantiated ${created.length} accounts from template "${templateCode}" for company ${companyId}`,
    );
    return created;
  }

  /**
   * Sort template accounts so parents always come before children:
   *   Level 1 (X000) → Level 2 (XX00) → Level 3 (XXX0) → Level 4 (XXXX)
   */
  private buildOrderedEntries(accounts: TemplateAccount[]): TemplateAccount[] {
    const level = (code: string): number => {
      const n = parseInt(code, 10);
      if (n % 1000 === 0) return 1;
      if (n % 100  === 0) return 2;
      if (n % 10   === 0) return 3;
      return 4;
    };
    return [...accounts].sort((a, b) => {
      const diff = level(a.code) - level(b.code);
      return diff !== 0 ? diff : a.code.localeCompare(b.code);
    });
  }

  /**
   * Seed the standard template into the database.
   * Called by the seed script; skipped if templates already exist.
   */
  async seedDefaultTemplates(): Promise<void> {
    const existing = await this.templateRepo.count();
    if (existing > 0) {
      console.warn('Templates already seeded, skipping...');
      return;
    }
    const template = this.buildTradingTemplate();
    await this.templateRepo.save(template);
    console.warn(`Seeded template: ${template.template_code}`);
  }

  // ──────────────────────────────────────────────────────────────────
  // Trading COA Template — 5 Standard Types
  // Asset | Liability | Equity | Revenue | Expense
  // ──────────────────────────────────────────────────────────────────

  /**
   * Build the Trading COA template.
   *
   * Structure:
   *   1000 Assets       — Current Assets, Fixed Assets, Other Assets
   *   2000 Liabilities  — Current Liabilities, Long-Term Liabilities
   *   3000 Equity       — Share Capital, Retained Earnings, Drawings
   *   4000 Revenue      — Sales Revenue, Other Income
   *   5000 Expenses     — Cost of Goods Sold, Operating Expenses,
   *                       Finance Costs, Depreciation, Tax Expense
   *
   * All COGS, OpEx, Depreciation, and Tax accounts use type = Expense.
   * Tax liabilities (VAT Payable, Income Tax Payable) use type = Liability.
   */
  private buildTradingTemplate(): COATemplate {
    const accounts: TemplateAccount[] = [

      // ================================================================
      // 1000  ASSETS
      // ================================================================
      { code: '1000', name: 'Assets',              account_type: 'Asset', normal_balance: 'Debit',  is_posting: false },

      // 1100  Current Assets
      { code: '1100', name: 'Current Assets',      account_type: 'Asset', normal_balance: 'Debit',  is_posting: false },

        // 1110  Cash & Cash Equivalents
        { code: '1110', name: 'Cash & Cash Equivalents',       account_type: 'Asset', normal_balance: 'Debit', is_posting: false },
        { code: '1111', name: 'Cash in Hand',                   account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '1112', name: 'Cash at Bank — Current Account', account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '1113', name: 'Cash at Bank — Savings Account', account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '1114', name: 'Petty Cash',                     account_type: 'Asset', normal_balance: 'Debit', is_posting: true },

        // 1120  Accounts Receivable
        { code: '1120', name: 'Accounts Receivable',            account_type: 'Asset', normal_balance: 'Debit', is_posting: false },
        { code: '1121', name: 'Trade Debtors',                  account_type: 'Asset', normal_balance: 'Debit', is_posting: true, is_system: true },
        { code: '1122', name: 'Notes Receivable',               account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '1123', name: 'Advance to Employees',           account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '1124', name: 'PDC Receivable',                 account_type: 'Asset', normal_balance: 'Debit', is_posting: true, is_system: true },
        { code: '1125', name: 'Other Receivables',              account_type: 'Asset', normal_balance: 'Debit', is_posting: true },

        // 1130  Inventory
        { code: '1130', name: 'Inventory',                      account_type: 'Asset', normal_balance: 'Debit', is_posting: false },
        { code: '1131', name: 'Merchandise Inventory',          account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '1132', name: 'Raw Materials',                  account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '1133', name: 'Work in Progress',               account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '1134', name: 'Finished Goods',                 account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '1135', name: 'Goods in Transit',               account_type: 'Asset', normal_balance: 'Debit', is_posting: true },

        // 1140  Prepaid & Other Current Assets
        { code: '1140', name: 'Prepaid & Other Current Assets', account_type: 'Asset', normal_balance: 'Debit', is_posting: false },
        { code: '1141', name: 'Prepaid Insurance',              account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '1142', name: 'Prepaid Rent',                   account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '1143', name: 'Prepaid Expenses — Other',       account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '1144', name: 'Input VAT Recoverable',          account_type: 'Asset', normal_balance: 'Debit', is_posting: true, is_system: true },
        { code: '1145', name: 'Advance Payments to Suppliers',  account_type: 'Asset', normal_balance: 'Debit', is_posting: true },

      // 1200  Non-Current Assets
      { code: '1200', name: 'Non-Current Assets',  account_type: 'Asset', normal_balance: 'Debit',  is_posting: false },

        // 1210  Property, Plant & Equipment (cost)
        { code: '1210', name: 'Property, Plant & Equipment',    account_type: 'Asset', normal_balance: 'Debit', is_posting: false },
        { code: '1211', name: 'Land',                           account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '1212', name: 'Buildings',                      account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '1213', name: 'Office Equipment',               account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '1214', name: 'Furniture & Fixtures',           account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '1215', name: 'Motor Vehicles',                 account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '1216', name: 'Computer & IT Equipment',        account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '1217', name: 'Machinery & Equipment',          account_type: 'Asset', normal_balance: 'Debit', is_posting: true },

        // 1220  Accumulated Depreciation (contra-asset → Credit balance)
        { code: '1220', name: 'Accumulated Depreciation',       account_type: 'Asset', normal_balance: 'Credit', is_posting: false,
          description: 'Contra-asset accounts. Credit balance reduces the carrying value of PPE.' },
        { code: '1221', name: 'Accum. Dep. — Buildings',        account_type: 'Asset', normal_balance: 'Credit', is_posting: true },
        { code: '1222', name: 'Accum. Dep. — Office Equipment', account_type: 'Asset', normal_balance: 'Credit', is_posting: true },
        { code: '1223', name: 'Accum. Dep. — Furniture',        account_type: 'Asset', normal_balance: 'Credit', is_posting: true },
        { code: '1224', name: 'Accum. Dep. — Motor Vehicles',   account_type: 'Asset', normal_balance: 'Credit', is_posting: true },
        { code: '1225', name: 'Accum. Dep. — IT Equipment',     account_type: 'Asset', normal_balance: 'Credit', is_posting: true },
        { code: '1226', name: 'Accum. Dep. — Machinery',        account_type: 'Asset', normal_balance: 'Credit', is_posting: true },

        // 1230  Intangible Assets
        { code: '1230', name: 'Intangible Assets',              account_type: 'Asset', normal_balance: 'Debit', is_posting: false },
        { code: '1231', name: 'Goodwill',                       account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '1232', name: 'Software & Licences',            account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '1233', name: 'Patents & Trademarks',           account_type: 'Asset', normal_balance: 'Debit', is_posting: true },

        // 1240  Long-Term Investments
        { code: '1240', name: 'Long-Term Investments',          account_type: 'Asset', normal_balance: 'Debit', is_posting: false },
        { code: '1241', name: 'Investment in Subsidiaries',     account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '1242', name: 'Investment in Associates',       account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '1243', name: 'Investment Securities',          account_type: 'Asset', normal_balance: 'Debit', is_posting: true },

      // ================================================================
      // 2000  LIABILITIES
      // ================================================================
      { code: '2000', name: 'Liabilities',         account_type: 'Liability', normal_balance: 'Credit', is_posting: false },

      // 2100  Current Liabilities
      { code: '2100', name: 'Current Liabilities', account_type: 'Liability', normal_balance: 'Credit', is_posting: false },

        // 2110  Accounts Payable
        { code: '2110', name: 'Accounts Payable',               account_type: 'Liability', normal_balance: 'Credit', is_posting: false },
        { code: '2111', name: 'Trade Creditors',                account_type: 'Liability', normal_balance: 'Credit', is_posting: true, is_system: true },
        { code: '2112', name: 'Accrued Expenses',               account_type: 'Liability', normal_balance: 'Credit', is_posting: true },
        { code: '2113', name: 'PDC Payable',                    account_type: 'Liability', normal_balance: 'Credit', is_posting: true, is_system: true },
        { code: '2114', name: 'Advance from Customers',         account_type: 'Liability', normal_balance: 'Credit', is_posting: true },

        // 2120  Tax Liabilities
        { code: '2120', name: 'Tax Liabilities',                account_type: 'Liability', normal_balance: 'Credit', is_posting: false },
        { code: '2121', name: 'Output VAT Payable',             account_type: 'Liability', normal_balance: 'Credit', is_posting: true, is_system: true },
        { code: '2122', name: 'Income Tax Payable',             account_type: 'Liability', normal_balance: 'Credit', is_posting: true },
        { code: '2123', name: 'Withholding Tax Payable',        account_type: 'Liability', normal_balance: 'Credit', is_posting: true },
        { code: '2124', name: 'Sales Tax Payable',              account_type: 'Liability', normal_balance: 'Credit', is_posting: true },

        // 2130  Short-Term Borrowings
        { code: '2130', name: 'Short-Term Borrowings',          account_type: 'Liability', normal_balance: 'Credit', is_posting: false },
        { code: '2131', name: 'Bank Overdraft',                 account_type: 'Liability', normal_balance: 'Credit', is_posting: true },
        { code: '2132', name: 'Short-Term Bank Loan',           account_type: 'Liability', normal_balance: 'Credit', is_posting: true },
        { code: '2133', name: 'Current Portion — Long-Term Debt', account_type: 'Liability', normal_balance: 'Credit', is_posting: true },

        // 2140  Other Current Liabilities
        { code: '2140', name: 'Other Current Liabilities',      account_type: 'Liability', normal_balance: 'Credit', is_posting: false },
        { code: '2141', name: 'Salaries Payable',               account_type: 'Liability', normal_balance: 'Credit', is_posting: true },
        { code: '2142', name: 'Deferred Revenue',               account_type: 'Liability', normal_balance: 'Credit', is_posting: true },
        { code: '2143', name: 'Customer Deposits',              account_type: 'Liability', normal_balance: 'Credit', is_posting: true },
        { code: '2144', name: 'Other Payables',                 account_type: 'Liability', normal_balance: 'Credit', is_posting: true },

      // 2200  Non-Current Liabilities
      { code: '2200', name: 'Non-Current Liabilities', account_type: 'Liability', normal_balance: 'Credit', is_posting: false },

        // 2210  Long-Term Borrowings
        { code: '2210', name: 'Long-Term Borrowings',           account_type: 'Liability', normal_balance: 'Credit', is_posting: false },
        { code: '2211', name: 'Long-Term Bank Loan',            account_type: 'Liability', normal_balance: 'Credit', is_posting: true },
        { code: '2212', name: 'Finance Lease Liability',        account_type: 'Liability', normal_balance: 'Credit', is_posting: true },
        { code: '2213', name: 'Shareholder Loans',              account_type: 'Liability', normal_balance: 'Credit', is_posting: true },

        // 2220  Deferred Tax
        { code: '2220', name: 'Deferred Liabilities',          account_type: 'Liability', normal_balance: 'Credit', is_posting: false },
        { code: '2221', name: 'Deferred Tax Liability',        account_type: 'Liability', normal_balance: 'Credit', is_posting: true },
        { code: '2222', name: 'Provision for Gratuity',        account_type: 'Liability', normal_balance: 'Credit', is_posting: true },

      // ================================================================
      // 3000  EQUITY
      // ================================================================
      { code: '3000', name: 'Equity',              account_type: 'Equity', normal_balance: 'Credit', is_posting: false },

      // 3100  Share Capital
      { code: '3100', name: 'Share Capital',       account_type: 'Equity', normal_balance: 'Credit', is_posting: false },

        { code: '3110', name: 'Issued Capital',                 account_type: 'Equity', normal_balance: 'Credit', is_posting: false },
        { code: '3111', name: 'Paid-Up Capital',                account_type: 'Equity', normal_balance: 'Credit', is_posting: true },
        { code: '3112', name: 'Share Premium Reserve',          account_type: 'Equity', normal_balance: 'Credit', is_posting: true },
        { code: '3113', name: "Proprietor's Capital",           account_type: 'Equity', normal_balance: 'Credit', is_posting: true },

      // 3200  Retained Earnings & Reserves
      { code: '3200', name: 'Retained Earnings & Reserves', account_type: 'Equity', normal_balance: 'Credit', is_posting: false },

        { code: '3210', name: 'Retained Earnings',              account_type: 'Equity', normal_balance: 'Credit', is_posting: false },
        { code: '3211', name: 'Retained Earnings — Prior Years', account_type: 'Equity', normal_balance: 'Credit', is_posting: true },
        { code: '3212', name: 'Current Year Profit / Loss',     account_type: 'Equity', normal_balance: 'Credit', is_posting: true, is_system: true },

        { code: '3220', name: 'Reserves',                       account_type: 'Equity', normal_balance: 'Credit', is_posting: false },
        { code: '3221', name: 'General Reserve',                account_type: 'Equity', normal_balance: 'Credit', is_posting: true },
        { code: '3222', name: 'Capital Reserve',                account_type: 'Equity', normal_balance: 'Credit', is_posting: true },

      // 3300  Drawings & Distributions
      { code: '3300', name: 'Drawings & Distributions', account_type: 'Equity', normal_balance: 'Debit', is_posting: false },

        { code: '3310', name: 'Drawings',                       account_type: 'Equity', normal_balance: 'Debit', is_posting: false },
        { code: '3311', name: "Proprietor's Drawings",          account_type: 'Equity', normal_balance: 'Debit', is_posting: true },
        { code: '3312', name: 'Dividends Paid',                 account_type: 'Equity', normal_balance: 'Debit', is_posting: true },

      // ================================================================
      // 4000  REVENUE
      // ================================================================
      { code: '4000', name: 'Revenue',             account_type: 'Revenue', normal_balance: 'Credit', is_posting: false },

      // 4100  Trading Revenue
      { code: '4100', name: 'Trading Revenue',     account_type: 'Revenue', normal_balance: 'Credit', is_posting: false },

        // 4110  Sales
        { code: '4110', name: 'Sales',                          account_type: 'Revenue', normal_balance: 'Credit', is_posting: false },
        { code: '4111', name: 'Local Sales',                    account_type: 'Revenue', normal_balance: 'Credit', is_posting: true },
        { code: '4112', name: 'Export Sales',                   account_type: 'Revenue', normal_balance: 'Credit', is_posting: true },
        { code: '4113', name: 'Sales — Services',               account_type: 'Revenue', normal_balance: 'Credit', is_posting: true },

        // 4120  Sales Contra (debit-normal contra-revenue)
        { code: '4120', name: 'Sales Deductions',               account_type: 'Revenue', normal_balance: 'Debit', is_posting: false },
        { code: '4121', name: 'Sales Returns',                  account_type: 'Revenue', normal_balance: 'Debit', is_posting: true },
        { code: '4122', name: 'Sales Allowances',               account_type: 'Revenue', normal_balance: 'Debit', is_posting: true },
        { code: '4123', name: 'Sales Discounts',                account_type: 'Revenue', normal_balance: 'Debit', is_posting: true },

      // 4200  Other Income
      { code: '4200', name: 'Other Income',        account_type: 'Revenue', normal_balance: 'Credit', is_posting: false },

        { code: '4210', name: 'Non-Operating Income',           account_type: 'Revenue', normal_balance: 'Credit', is_posting: false },
        { code: '4211', name: 'Interest Income',                account_type: 'Revenue', normal_balance: 'Credit', is_posting: true },
        { code: '4212', name: 'Rental Income',                  account_type: 'Revenue', normal_balance: 'Credit', is_posting: true },
        { code: '4213', name: 'Dividend Income',                account_type: 'Revenue', normal_balance: 'Credit', is_posting: true },
        { code: '4214', name: 'Gain on Disposal of Assets',     account_type: 'Revenue', normal_balance: 'Credit', is_posting: true },
        { code: '4215', name: 'Foreign Exchange Gain',          account_type: 'Revenue', normal_balance: 'Credit', is_posting: true },
        { code: '4216', name: 'Miscellaneous Income',           account_type: 'Revenue', normal_balance: 'Credit', is_posting: true },

      // ================================================================
      // 5000  EXPENSES  (COGS + Operating Expenses + Finance + Tax)
      //
      // All sub-categories use account_type = 'Expense' so that the
      // income statement rolls them up correctly under a single type.
      // ================================================================
      { code: '5000', name: 'Expenses',            account_type: 'Expense', normal_balance: 'Debit', is_posting: false },

      // 5100  Cost of Goods Sold
      { code: '5100', name: 'Cost of Goods Sold',  account_type: 'Expense', normal_balance: 'Debit', is_posting: false,
        description: 'Direct costs of trading stock: purchases, freight, and related deductions.' },

        { code: '5110', name: 'Purchases',                      account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '5111', name: 'Purchases — Local',              account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5112', name: 'Purchases — Import',             account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5113', name: 'Purchase Returns',               account_type: 'Expense', normal_balance: 'Credit', is_posting: true },
        { code: '5114', name: 'Purchase Discounts',             account_type: 'Expense', normal_balance: 'Credit', is_posting: true },

        { code: '5120', name: 'Direct Cost of Production',      account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '5121', name: 'Raw Material Consumed',          account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5122', name: 'Direct Labour',                  account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5123', name: 'Manufacturing Overhead',         account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5124', name: 'Freight Inward',                 account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5125', name: 'Customs & Import Duties',        account_type: 'Expense', normal_balance: 'Debit', is_posting: true },

      // 5200  Gross Profit Adjustments
      { code: '5200', name: 'Gross Profit Adjustments', account_type: 'Expense', normal_balance: 'Debit', is_posting: false },

        { code: '5210', name: 'Inventory Adjustments',          account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '5211', name: 'Opening Stock',                  account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5212', name: 'Closing Stock',                  account_type: 'Expense', normal_balance: 'Credit', is_posting: true },
        { code: '5213', name: 'Inventory Write-Down',           account_type: 'Expense', normal_balance: 'Debit', is_posting: true },

      // 5300  Selling & Distribution Expenses
      { code: '5300', name: 'Selling & Distribution',  account_type: 'Expense', normal_balance: 'Debit', is_posting: false },

        { code: '5310', name: 'Sales & Marketing',              account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '5311', name: 'Sales Staff Salaries',           account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5312', name: 'Advertising & Promotion',        account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5313', name: 'Commission Expense',             account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5314', name: 'Delivery & Distribution',        account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5315', name: 'Packaging Expense',              account_type: 'Expense', normal_balance: 'Debit', is_posting: true },

      // 5400  Administrative Expenses
      { code: '5400', name: 'Administrative Expenses', account_type: 'Expense', normal_balance: 'Debit', is_posting: false },

        { code: '5410', name: 'Staff Costs',                    account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '5411', name: 'Admin Staff Salaries',           account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5412', name: 'Staff Benefits & Allowances',    account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5413', name: 'Employee Gratuity',              account_type: 'Expense', normal_balance: 'Debit', is_posting: true },

        { code: '5420', name: 'Office & Occupancy',             account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '5421', name: 'Office Rent',                    account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5422', name: 'Utilities (Electricity, Water)',  account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5423', name: 'Office Supplies',                account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5424', name: 'Repairs & Maintenance',          account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5425', name: 'Insurance Expense',              account_type: 'Expense', normal_balance: 'Debit', is_posting: true },

        { code: '5430', name: 'Professional & IT Services',     account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '5431', name: 'Legal & Professional Fees',      account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5432', name: 'Audit & Accounting Fees',        account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5433', name: 'IT & Software Expenses',         account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5434', name: 'Consulting Fees',                account_type: 'Expense', normal_balance: 'Debit', is_posting: true },

        { code: '5440', name: 'Travel & Communications',        account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '5441', name: 'Travel & Accommodation',         account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5442', name: 'Vehicle Running Expenses',       account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5443', name: 'Telephone & Internet',           account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5444', name: 'Postage & Courier',              account_type: 'Expense', normal_balance: 'Debit', is_posting: true },

      // 5500  Depreciation & Amortisation
      { code: '5500', name: 'Depreciation & Amortisation', account_type: 'Expense', normal_balance: 'Debit', is_posting: false,
        description: 'Periodic charge for using fixed and intangible assets.' },

        { code: '5510', name: 'Depreciation',                   account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '5511', name: 'Dep. — Buildings',               account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5512', name: 'Dep. — Office Equipment',        account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5513', name: 'Dep. — Furniture & Fixtures',    account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5514', name: 'Dep. — Motor Vehicles',          account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5515', name: 'Dep. — IT Equipment',            account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5516', name: 'Dep. — Machinery',               account_type: 'Expense', normal_balance: 'Debit', is_posting: true },

        { code: '5520', name: 'Amortisation',                   account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '5521', name: 'Amort. — Software & Licences',   account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5522', name: 'Amort. — Patents & Trademarks',  account_type: 'Expense', normal_balance: 'Debit', is_posting: true },

      // 5600  Finance Costs
      { code: '5600', name: 'Finance Costs',        account_type: 'Expense', normal_balance: 'Debit', is_posting: false },

        { code: '5610', name: 'Interest & Bank Charges',        account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '5611', name: 'Bank Charges',                   account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5612', name: 'Interest on Bank Loans',         account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5613', name: 'Interest on Finance Leases',     account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5614', name: 'Foreign Exchange Loss',          account_type: 'Expense', normal_balance: 'Debit', is_posting: true },

      // 5700  Tax Expense
      { code: '5700', name: 'Tax Expense',          account_type: 'Expense', normal_balance: 'Debit', is_posting: false,
        description: 'Income tax charges recognised in profit or loss (not tax liabilities in the balance sheet).' },

        { code: '5710', name: 'Income Tax',                     account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '5711', name: 'Corporate Income Tax',           account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5712', name: 'Deferred Tax Expense',           account_type: 'Expense', normal_balance: 'Debit', is_posting: true },

      // 5800  Other Expenses
      { code: '5800', name: 'Other Expenses',       account_type: 'Expense', normal_balance: 'Debit', is_posting: false },

        { code: '5810', name: 'Miscellaneous Expenses',         account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '5811', name: 'Loss on Disposal of Assets',     account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5812', name: 'Bad Debt Expense',               account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5813', name: 'Provision for Doubtful Debts',   account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5814', name: 'Donations & Charity',            account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5815', name: 'Penalties & Fines',              account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '5816', name: 'Miscellaneous Expenses',         account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
    ];

    return this.templateRepo.create({
      template_code:  'TRADING',
      template_name:  'Standard Trading COA',
      description:    'Complete Chart of Accounts for a trading company. Uses 5 standard types: Asset, Liability, Equity, Revenue, Expense. COGS, Operating, Finance, Depreciation and Tax expenses all classified as Expense type.',
      accounts,
      account_count:  accounts.length,
      is_active:      true,
    });
  }
}
