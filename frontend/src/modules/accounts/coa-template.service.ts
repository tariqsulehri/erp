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
 * 6-digit hierarchy (all main COA codes exactly 6 digits):
 *   X00000  Category    (÷100000)  — top-level, non-posting
 *   XX0000  Group       (÷10000)   — non-posting
 *   XXX000  Sub-Group   (÷1000)    — non-posting
 *   XXXX00  Sub-Detail  (÷100)     — non-posting
 *   XXXXX0  Segment     (÷10)      — non-posting
 *   XXXXXX  Posting     (other)    — receives journal entries
 *
 * Sub-ledger accounts use 7-digit codes (always posting leaf nodes):
 *   1300001–1399999  →  AR debtors  (customers) — 99,999 per company
 *   2100001–2199999  →  AP creditors (suppliers) — 99,999 per company
 *
 * All five levels of header accounts plus the posting level are stored
 * explicitly in the template.accounts array.
 * buildOrderedEntries() sorts them Category → Group → Sub-Group →
 * Sub-Detail → Segment → Posting so parent accounts are always created
 * before their children.
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
   * Inserts accounts in level order (Category → Group → Sub-Group →
   * Sub-Detail → Segment → Posting).
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
        // Any code whose last digit is 0 is a header (non-posting) account.
        // This works for all 6-digit levels (L1–L5 always end in 0) and
        // for 7-digit sub-ledger codes (which always end in a non-zero digit).
        const isHeader = num % 10 === 0;

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
   *   Level 1 (X00000) → Level 2 (XX0000) → Level 3 (XXX000) →
   *   Level 4 (XXXX00) → Level 5 (XXXXX0) → Level 6 (XXXXXX)
   */
  private buildOrderedEntries(accounts: TemplateAccount[]): TemplateAccount[] {
    const level = (code: string): number => {
      const n = parseInt(code, 10);
      if (n % 100000 === 0) return 1;
      if (n % 10000  === 0) return 2;
      if (n % 1000   === 0) return 3;
      if (n % 100    === 0) return 4;
      if (n % 10     === 0) return 5;
      return 6;
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
  //
  // All codes are 6-digit.  Non-posting header accounts end in 0
  // (divisible by 10).  Posting leaf accounts do NOT end in 0.
  //
  // Mapping from old 4-digit template:
  //   Non-posting: append '00'  (1000 → 100000, 1110 → 111000 …)
  //   Posting:     append '01'  (1111 → 111101, 2121 → 212101 …)
  // ──────────────────────────────────────────────────────────────────

  /**
   * Build the Trading COA template.
   *
   * Structure:
   *   100000 Assets       — Current Assets, Fixed Assets, Other Assets
   *   200000 Liabilities  — Current Liabilities, Long-Term Liabilities
   *   300000 Equity       — Share Capital, Retained Earnings, Drawings
   *   400000 Revenue      — Sales Revenue, Other Income
   *   500000 Expenses     — Cost of Goods Sold, Operating Expenses,
   *                         Finance Costs, Depreciation, Tax Expense
   *
   * All COGS, OpEx, Depreciation, and Tax accounts use type = Expense.
   * Tax liabilities (VAT Payable, Income Tax Payable) use type = Liability.
   */
  private buildTradingTemplate(): COATemplate {
    const accounts: TemplateAccount[] = [

      // ================================================================
      // 100000  ASSETS
      // ================================================================
      { code: '100000', name: 'Assets',              account_type: 'Asset', normal_balance: 'Debit',  is_posting: false },

      // 110000  Current Assets
      { code: '110000', name: 'Current Assets',      account_type: 'Asset', normal_balance: 'Debit',  is_posting: false },

        // 111000  Cash & Cash Equivalents
        { code: '111000', name: 'Cash & Cash Equivalents',       account_type: 'Asset', normal_balance: 'Debit', is_posting: false },
        { code: '111101', name: 'Cash in Hand',                   account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '111201', name: 'Cash at Bank — Current Account', account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '111301', name: 'Cash at Bank — Savings Account', account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '111401', name: 'Petty Cash',                     account_type: 'Asset', normal_balance: 'Debit', is_posting: true },

        // 112000  Accounts Receivable
        { code: '112000', name: 'Accounts Receivable',            account_type: 'Asset', normal_balance: 'Debit', is_posting: false },
        { code: '112101', name: 'Trade Debtors',                  account_type: 'Asset', normal_balance: 'Debit', is_posting: true, is_system: true },
        { code: '112201', name: 'Notes Receivable',               account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '112301', name: 'Advance to Employees',           account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '112401', name: 'PDC Receivable',                 account_type: 'Asset', normal_balance: 'Debit', is_posting: true, is_system: true },
        { code: '112501', name: 'Other Receivables',              account_type: 'Asset', normal_balance: 'Debit', is_posting: true },

        // 113000  Inventory
        { code: '113000', name: 'Inventory',                      account_type: 'Asset', normal_balance: 'Debit', is_posting: false },
        { code: '113101', name: 'Merchandise Inventory',          account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '113201', name: 'Raw Materials',                  account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '113301', name: 'Work in Progress',               account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '113401', name: 'Finished Goods',                 account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '113501', name: 'Goods in Transit',               account_type: 'Asset', normal_balance: 'Debit', is_posting: true },

        // 114000  Prepaid & Other Current Assets
        { code: '114000', name: 'Prepaid & Other Current Assets', account_type: 'Asset', normal_balance: 'Debit', is_posting: false },
        { code: '114101', name: 'Prepaid Insurance',              account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '114201', name: 'Prepaid Rent',                   account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '114301', name: 'Prepaid Expenses — Other',       account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '114401', name: 'Input VAT Recoverable',          account_type: 'Asset', normal_balance: 'Debit', is_posting: true, is_system: true },
        { code: '114501', name: 'Advance Payments to Suppliers',  account_type: 'Asset', normal_balance: 'Debit', is_posting: true },

      // 120000  Non-Current Assets
      { code: '120000', name: 'Non-Current Assets',  account_type: 'Asset', normal_balance: 'Debit',  is_posting: false },

        // 121000  Property, Plant & Equipment (cost)
        { code: '121000', name: 'Property, Plant & Equipment',    account_type: 'Asset', normal_balance: 'Debit', is_posting: false },
        { code: '121101', name: 'Land',                           account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '121201', name: 'Buildings',                      account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '121301', name: 'Office Equipment',               account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '121401', name: 'Furniture & Fixtures',           account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '121501', name: 'Motor Vehicles',                 account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '121601', name: 'Computer & IT Equipment',        account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '121701', name: 'Machinery & Equipment',          account_type: 'Asset', normal_balance: 'Debit', is_posting: true },

        // 122000  Accumulated Depreciation (contra-asset → Credit balance)
        { code: '122000', name: 'Accumulated Depreciation',       account_type: 'Asset', normal_balance: 'Credit', is_posting: false,
          description: 'Contra-asset accounts. Credit balance reduces the carrying value of PPE.' },
        { code: '122101', name: 'Accum. Dep. — Buildings',        account_type: 'Asset', normal_balance: 'Credit', is_posting: true },
        { code: '122201', name: 'Accum. Dep. — Office Equipment', account_type: 'Asset', normal_balance: 'Credit', is_posting: true },
        { code: '122301', name: 'Accum. Dep. — Furniture',        account_type: 'Asset', normal_balance: 'Credit', is_posting: true },
        { code: '122401', name: 'Accum. Dep. — Motor Vehicles',   account_type: 'Asset', normal_balance: 'Credit', is_posting: true },
        { code: '122501', name: 'Accum. Dep. — IT Equipment',     account_type: 'Asset', normal_balance: 'Credit', is_posting: true },
        { code: '122601', name: 'Accum. Dep. — Machinery',        account_type: 'Asset', normal_balance: 'Credit', is_posting: true },

        // 123000  Intangible Assets
        { code: '123000', name: 'Intangible Assets',              account_type: 'Asset', normal_balance: 'Debit', is_posting: false },
        { code: '123101', name: 'Goodwill',                       account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '123201', name: 'Software & Licences',            account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '123301', name: 'Patents & Trademarks',           account_type: 'Asset', normal_balance: 'Debit', is_posting: true },

        // 124000  Long-Term Investments
        { code: '124000', name: 'Long-Term Investments',          account_type: 'Asset', normal_balance: 'Debit', is_posting: false },
        { code: '124101', name: 'Investment in Subsidiaries',     account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '124201', name: 'Investment in Associates',       account_type: 'Asset', normal_balance: 'Debit', is_posting: true },
        { code: '124301', name: 'Investment Securities',          account_type: 'Asset', normal_balance: 'Debit', is_posting: true },

      // ================================================================
      // 200000  LIABILITIES
      // ================================================================
      { code: '200000', name: 'Liabilities',         account_type: 'Liability', normal_balance: 'Credit', is_posting: false },

      // 210000  Current Liabilities
      { code: '210000', name: 'Current Liabilities', account_type: 'Liability', normal_balance: 'Credit', is_posting: false },

        // 211000  Accounts Payable
        { code: '211000', name: 'Accounts Payable',               account_type: 'Liability', normal_balance: 'Credit', is_posting: false },
        { code: '211101', name: 'Trade Creditors',                account_type: 'Liability', normal_balance: 'Credit', is_posting: true, is_system: true },
        { code: '211201', name: 'Accrued Expenses',               account_type: 'Liability', normal_balance: 'Credit', is_posting: true },
        { code: '211301', name: 'PDC Payable',                    account_type: 'Liability', normal_balance: 'Credit', is_posting: true, is_system: true },
        { code: '211401', name: 'Advance from Customers',         account_type: 'Liability', normal_balance: 'Credit', is_posting: true },

        // 212000  Tax Liabilities
        { code: '212000', name: 'Tax Liabilities',                account_type: 'Liability', normal_balance: 'Credit', is_posting: false },
        { code: '212101', name: 'Output VAT Payable',             account_type: 'Liability', normal_balance: 'Credit', is_posting: true, is_system: true },
        { code: '212201', name: 'Income Tax Payable',             account_type: 'Liability', normal_balance: 'Credit', is_posting: true },
        { code: '212301', name: 'Withholding Tax Payable',        account_type: 'Liability', normal_balance: 'Credit', is_posting: true },
        { code: '212401', name: 'Sales Tax Payable',              account_type: 'Liability', normal_balance: 'Credit', is_posting: true },

        // 213000  Short-Term Borrowings
        { code: '213000', name: 'Short-Term Borrowings',          account_type: 'Liability', normal_balance: 'Credit', is_posting: false },
        { code: '213101', name: 'Bank Overdraft',                 account_type: 'Liability', normal_balance: 'Credit', is_posting: true },
        { code: '213201', name: 'Short-Term Bank Loan',           account_type: 'Liability', normal_balance: 'Credit', is_posting: true },
        { code: '213301', name: 'Current Portion — Long-Term Debt', account_type: 'Liability', normal_balance: 'Credit', is_posting: true },

        // 214000  Other Current Liabilities
        { code: '214000', name: 'Other Current Liabilities',      account_type: 'Liability', normal_balance: 'Credit', is_posting: false },
        { code: '214101', name: 'Salaries Payable',               account_type: 'Liability', normal_balance: 'Credit', is_posting: true },
        { code: '214201', name: 'Deferred Revenue',               account_type: 'Liability', normal_balance: 'Credit', is_posting: true },
        { code: '214301', name: 'Customer Deposits',              account_type: 'Liability', normal_balance: 'Credit', is_posting: true },
        { code: '214401', name: 'Other Payables',                 account_type: 'Liability', normal_balance: 'Credit', is_posting: true },

      // 220000  Non-Current Liabilities
      { code: '220000', name: 'Non-Current Liabilities', account_type: 'Liability', normal_balance: 'Credit', is_posting: false },

        // 221000  Long-Term Borrowings
        { code: '221000', name: 'Long-Term Borrowings',           account_type: 'Liability', normal_balance: 'Credit', is_posting: false },
        { code: '221101', name: 'Long-Term Bank Loan',            account_type: 'Liability', normal_balance: 'Credit', is_posting: true },
        { code: '221201', name: 'Finance Lease Liability',        account_type: 'Liability', normal_balance: 'Credit', is_posting: true },
        { code: '221301', name: 'Shareholder Loans',              account_type: 'Liability', normal_balance: 'Credit', is_posting: true },

        // 222000  Deferred Liabilities
        { code: '222000', name: 'Deferred Liabilities',          account_type: 'Liability', normal_balance: 'Credit', is_posting: false },
        { code: '222101', name: 'Deferred Tax Liability',        account_type: 'Liability', normal_balance: 'Credit', is_posting: true },
        { code: '222201', name: 'Provision for Gratuity',        account_type: 'Liability', normal_balance: 'Credit', is_posting: true },

      // ================================================================
      // 300000  EQUITY
      // ================================================================
      { code: '300000', name: 'Equity',              account_type: 'Equity', normal_balance: 'Credit', is_posting: false },

      // 310000  Share Capital
      { code: '310000', name: 'Share Capital',       account_type: 'Equity', normal_balance: 'Credit', is_posting: false },

        { code: '311000', name: 'Issued Capital',                 account_type: 'Equity', normal_balance: 'Credit', is_posting: false },
        { code: '311101', name: 'Paid-Up Capital',                account_type: 'Equity', normal_balance: 'Credit', is_posting: true },
        { code: '311201', name: 'Share Premium Reserve',          account_type: 'Equity', normal_balance: 'Credit', is_posting: true },
        { code: '311301', name: "Proprietor's Capital",           account_type: 'Equity', normal_balance: 'Credit', is_posting: true },

      // 320000  Retained Earnings & Reserves
      { code: '320000', name: 'Retained Earnings & Reserves', account_type: 'Equity', normal_balance: 'Credit', is_posting: false },

        { code: '321000', name: 'Retained Earnings',              account_type: 'Equity', normal_balance: 'Credit', is_posting: false },
        { code: '321101', name: 'Retained Earnings — Prior Years', account_type: 'Equity', normal_balance: 'Credit', is_posting: true },
        { code: '321201', name: 'Current Year Profit / Loss',     account_type: 'Equity', normal_balance: 'Credit', is_posting: true, is_system: true },

        { code: '322000', name: 'Reserves',                       account_type: 'Equity', normal_balance: 'Credit', is_posting: false },
        { code: '322101', name: 'General Reserve',                account_type: 'Equity', normal_balance: 'Credit', is_posting: true },
        { code: '322201', name: 'Capital Reserve',                account_type: 'Equity', normal_balance: 'Credit', is_posting: true },

      // 330000  Drawings & Distributions
      { code: '330000', name: 'Drawings & Distributions', account_type: 'Equity', normal_balance: 'Debit', is_posting: false },

        { code: '331000', name: 'Drawings',                       account_type: 'Equity', normal_balance: 'Debit', is_posting: false },
        { code: '331101', name: "Proprietor's Drawings",          account_type: 'Equity', normal_balance: 'Debit', is_posting: true },
        { code: '331201', name: 'Dividends Paid',                 account_type: 'Equity', normal_balance: 'Debit', is_posting: true },

      // ================================================================
      // 400000  REVENUE
      // ================================================================
      { code: '400000', name: 'Revenue',             account_type: 'Revenue', normal_balance: 'Credit', is_posting: false },

      // 410000  Trading Revenue
      { code: '410000', name: 'Trading Revenue',     account_type: 'Revenue', normal_balance: 'Credit', is_posting: false },

        // 411000  Sales
        { code: '411000', name: 'Sales',                          account_type: 'Revenue', normal_balance: 'Credit', is_posting: false },
        { code: '411101', name: 'Local Sales',                    account_type: 'Revenue', normal_balance: 'Credit', is_posting: true },
        { code: '411201', name: 'Export Sales',                   account_type: 'Revenue', normal_balance: 'Credit', is_posting: true },
        { code: '411301', name: 'Sales — Services',               account_type: 'Revenue', normal_balance: 'Credit', is_posting: true },

        // 412000  Sales Contra (debit-normal contra-revenue)
        { code: '412000', name: 'Sales Deductions',               account_type: 'Revenue', normal_balance: 'Debit', is_posting: false },
        { code: '412101', name: 'Sales Returns',                  account_type: 'Revenue', normal_balance: 'Debit', is_posting: true },
        { code: '412201', name: 'Sales Allowances',               account_type: 'Revenue', normal_balance: 'Debit', is_posting: true },
        { code: '412301', name: 'Sales Discounts',                account_type: 'Revenue', normal_balance: 'Debit', is_posting: true },

      // 420000  Other Income
      { code: '420000', name: 'Other Income',        account_type: 'Revenue', normal_balance: 'Credit', is_posting: false },

        { code: '421000', name: 'Non-Operating Income',           account_type: 'Revenue', normal_balance: 'Credit', is_posting: false },
        { code: '421101', name: 'Interest Income',                account_type: 'Revenue', normal_balance: 'Credit', is_posting: true },
        { code: '421201', name: 'Rental Income',                  account_type: 'Revenue', normal_balance: 'Credit', is_posting: true },
        { code: '421301', name: 'Dividend Income',                account_type: 'Revenue', normal_balance: 'Credit', is_posting: true },
        { code: '421401', name: 'Gain on Disposal of Assets',     account_type: 'Revenue', normal_balance: 'Credit', is_posting: true },
        { code: '421501', name: 'Foreign Exchange Gain',          account_type: 'Revenue', normal_balance: 'Credit', is_posting: true },
        { code: '421601', name: 'Miscellaneous Income',           account_type: 'Revenue', normal_balance: 'Credit', is_posting: true },

      // ================================================================
      // 500000  EXPENSES  (COGS + Operating Expenses + Finance + Tax)
      //
      // All sub-categories use account_type = 'Expense' so that the
      // income statement rolls them up correctly under a single type.
      // ================================================================
      { code: '500000', name: 'Expenses',            account_type: 'Expense', normal_balance: 'Debit', is_posting: false },

      // 510000  Cost of Goods Sold
      { code: '510000', name: 'Cost of Goods Sold',  account_type: 'Expense', normal_balance: 'Debit', is_posting: false,
        description: 'Direct costs of trading stock: purchases, freight, and related deductions.' },

        { code: '511000', name: 'Purchases',                      account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '511101', name: 'Purchases — Local',              account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '511201', name: 'Purchases — Import',             account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '511301', name: 'Purchase Returns',               account_type: 'Expense', normal_balance: 'Credit', is_posting: true },
        { code: '511401', name: 'Purchase Discounts',             account_type: 'Expense', normal_balance: 'Credit', is_posting: true },

        { code: '512000', name: 'Direct Cost of Production',      account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '512101', name: 'Raw Material Consumed',          account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '512201', name: 'Direct Labour',                  account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '512301', name: 'Manufacturing Overhead',         account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '512401', name: 'Freight Inward',                 account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '512501', name: 'Customs & Import Duties',        account_type: 'Expense', normal_balance: 'Debit', is_posting: true },

      // 520000  Gross Profit Adjustments
      { code: '520000', name: 'Gross Profit Adjustments', account_type: 'Expense', normal_balance: 'Debit', is_posting: false },

        { code: '521000', name: 'Inventory Adjustments',          account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '521101', name: 'Opening Stock',                  account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '521201', name: 'Closing Stock',                  account_type: 'Expense', normal_balance: 'Credit', is_posting: true },
        { code: '521301', name: 'Inventory Write-Down',           account_type: 'Expense', normal_balance: 'Debit', is_posting: true },

      // 530000  Selling & Distribution Expenses
      { code: '530000', name: 'Selling & Distribution',  account_type: 'Expense', normal_balance: 'Debit', is_posting: false },

        { code: '531000', name: 'Sales & Marketing',              account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '531101', name: 'Sales Staff Salaries',           account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '531201', name: 'Advertising & Promotion',        account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '531301', name: 'Commission Expense',             account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '531401', name: 'Delivery & Distribution',        account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '531501', name: 'Packaging Expense',              account_type: 'Expense', normal_balance: 'Debit', is_posting: true },

      // 540000  Administrative Expenses
      { code: '540000', name: 'Administrative Expenses', account_type: 'Expense', normal_balance: 'Debit', is_posting: false },

        { code: '541000', name: 'Staff Costs',                    account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '541101', name: 'Admin Staff Salaries',           account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '541201', name: 'Staff Benefits & Allowances',    account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '541301', name: 'Employee Gratuity',              account_type: 'Expense', normal_balance: 'Debit', is_posting: true },

        { code: '542000', name: 'Office & Occupancy',             account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '542101', name: 'Office Rent',                    account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '542201', name: 'Utilities (Electricity, Water)',  account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '542301', name: 'Office Supplies',                account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '542401', name: 'Repairs & Maintenance',          account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '542501', name: 'Insurance Expense',              account_type: 'Expense', normal_balance: 'Debit', is_posting: true },

        { code: '543000', name: 'Professional & IT Services',     account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '543101', name: 'Legal & Professional Fees',      account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '543201', name: 'Audit & Accounting Fees',        account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '543301', name: 'IT & Software Expenses',         account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '543401', name: 'Consulting Fees',                account_type: 'Expense', normal_balance: 'Debit', is_posting: true },

        { code: '544000', name: 'Travel & Communications',        account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '544101', name: 'Travel & Accommodation',         account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '544201', name: 'Vehicle Running Expenses',       account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '544301', name: 'Telephone & Internet',           account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '544401', name: 'Postage & Courier',              account_type: 'Expense', normal_balance: 'Debit', is_posting: true },

      // 550000  Depreciation & Amortisation
      { code: '550000', name: 'Depreciation & Amortisation', account_type: 'Expense', normal_balance: 'Debit', is_posting: false,
        description: 'Periodic charge for using fixed and intangible assets.' },

        { code: '551000', name: 'Depreciation',                   account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '551101', name: 'Dep. — Buildings',               account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '551201', name: 'Dep. — Office Equipment',        account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '551301', name: 'Dep. — Furniture & Fixtures',    account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '551401', name: 'Dep. — Motor Vehicles',          account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '551501', name: 'Dep. — IT Equipment',            account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '551601', name: 'Dep. — Machinery',               account_type: 'Expense', normal_balance: 'Debit', is_posting: true },

        { code: '552000', name: 'Amortisation',                   account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '552101', name: 'Amort. — Software & Licences',   account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '552201', name: 'Amort. — Patents & Trademarks',  account_type: 'Expense', normal_balance: 'Debit', is_posting: true },

      // 560000  Finance Costs
      { code: '560000', name: 'Finance Costs',        account_type: 'Expense', normal_balance: 'Debit', is_posting: false },

        { code: '561000', name: 'Interest & Bank Charges',        account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '561101', name: 'Bank Charges',                   account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '561201', name: 'Interest on Bank Loans',         account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '561301', name: 'Interest on Finance Leases',     account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '561401', name: 'Foreign Exchange Loss',          account_type: 'Expense', normal_balance: 'Debit', is_posting: true },

      // 570000  Tax Expense
      { code: '570000', name: 'Tax Expense',          account_type: 'Expense', normal_balance: 'Debit', is_posting: false,
        description: 'Income tax charges recognised in profit or loss (not tax liabilities in the balance sheet).' },

        { code: '571000', name: 'Income Tax',                     account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '571101', name: 'Corporate Income Tax',           account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '571201', name: 'Deferred Tax Expense',           account_type: 'Expense', normal_balance: 'Debit', is_posting: true },

      // 580000  Other Expenses
      { code: '580000', name: 'Other Expenses',       account_type: 'Expense', normal_balance: 'Debit', is_posting: false },

        { code: '581000', name: 'Miscellaneous Expenses',         account_type: 'Expense', normal_balance: 'Debit', is_posting: false },
        { code: '581101', name: 'Loss on Disposal of Assets',     account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '581201', name: 'Bad Debt Expense',               account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '581301', name: 'Provision for Doubtful Debts',   account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '581401', name: 'Donations & Charity',            account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '581501', name: 'Penalties & Fines',              account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
        { code: '581601', name: 'Miscellaneous Expenses',         account_type: 'Expense', normal_balance: 'Debit', is_posting: true },
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
