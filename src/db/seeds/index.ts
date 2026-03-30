import { AppDataSource } from '@/db/data-source';
import { seedCOATemplates } from './coa-templates.seed';

/**
 * Main seed runner
 * Runs all seed functions in order
 * Execute with: npm run db:seed
 */
async function runSeeds(): Promise<void> {
  console.log('🌱 Starting database seed...\n');

  try {
    // Initialize database connection
    if (!AppDataSource.isInitialized) {
      console.log('Initializing database connection...');
      await AppDataSource.initialize();
      console.log('✓ Database connected\n');
    }

    // Run seeds in order
    console.log('1. Seeding Chart of Accounts templates and categories...');
    await seedCOATemplates();
    console.log('✓ COA seed completed\n');

    // Add more seed functions here as needed
    // await seedCompanies();
    // await seedUsers();
    // etc.

    console.log('✅ All seeds completed successfully!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

// Run if executed directly
if (require.main === module) {
  runSeeds()
    .then(() => {
      console.log('\nSeed process completed');
      process.exit(0);
    })
    .catch(err => {
      console.error('Seed process failed:', err);
      process.exit(1);
    });
}

export { runSeeds };
