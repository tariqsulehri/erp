import { router, publicProcedure } from '@/server/trpc';
import { accountsRouter }   from './accounts.router';
import { fiscalYearRouter } from './fiscal-year.router';
import { settingsRouter }   from './settings.router';
import { vouchersRouter }   from './vouchers.router';
import { dashboardRouter }  from './dashboard.router';
import { productsRouter }   from './products.router';
import { customersRouter }  from './customers.router';
import { suppliersRouter }  from './suppliers.router';
import { transactionSupportRouter } from './transaction-support.router';

/**
 * ============================================================================
 * Root Router (_app.ts)
 * ============================================================================
 *
 * Central hub of all tRPC routes.
 *
 * Purpose:
 * 1. Combine all domain routers (accounts, fiscal-year, vouchers, etc.)
 * 2. Provide type-safe API surface for frontend
 * 3. Enable incremental router addition as modules are built
 *
 * Pattern:
 * - Each domain has its own router file (accounts.router.ts, fiscal-year.router.ts)
 * - Import each router here
 * - Add to appRouter object
 * - Update type exports for frontend
 *
 * Type Safety:
 * - Export AppRouter type so frontend knows available procedures
 * - tRPC client auto-completes based on this type definition
 *
 * ============================================================================
 */

/**
 * Health check router
 *
 * Simple endpoint to verify API is running.
 * Used for:
 * - Monitoring/health checks
 * - Smoke testing API availability
 * - Demo/debugging purposes
 *
 * Endpoint: GET /trpc/health.ping
 * Returns: { message, timestamp, version }
 */
const healthRouter = router({
  /**
   * Simple ping endpoint
   *
   * Purpose: Verify API is responding
   * Authorization: Public (no authentication required)
   *
   * @returns Object with message, timestamp, version
   */
  ping: publicProcedure.query(() => {
    return {
      message: 'ERP Financial Module API is running',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    };
  }),
});

/**
 * Main application router
 *
 * Combines all domain routers into single API surface.
 *
 * Structure:
 * - health: System health checks
 * - accounts: Chart of Accounts CRUD
 * - fiscalYear: Fiscal year and period management
 *
 * Added later:
 * - vouchers: Journal vouchers (CPV, CRV, JV, BPV, BRV)
 * - bank: Bank accounts, cheques, PDC, reconciliation
 * - reports: Trial balance, P&L, balance sheet, ledger
 * - companies: Company configuration, COA templates
 * - inventory: Phase 2 - inventory and costing
 */
export const appRouter = router({
  // System routes
  health: healthRouter,

  // Phase 1: Financial Core
  accounts:   accountsRouter,
  fiscalYear: fiscalYearRouter,
  settings:   settingsRouter,

  vouchers:  vouchersRouter,
  dashboard: dashboardRouter,

  // Phase 2: Inventory
  products: productsRouter,

  // Phase 3: AR / AP Sub-ledger Masters
  customers: customersRouter,
  suppliers: suppliersRouter,

  // Shared transaction support
  transactionSupport: transactionSupportRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;
