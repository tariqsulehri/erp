import { AppDataSource } from '@/db/data-source';
import { AccountCategory } from '@/modules/accounts/account.entity';
import { ACCOUNT_CATEGORIES } from '@/modules/accounts/coa-template.entity';
import { COATemplateService } from '@/modules/accounts/coa-template.service';

/**
 * Seed Chart of Accounts templates and categories
 * Run with: npm run db:seed
 */
export async function seedCOATemplates(): Promise<void> {
  console.log('Seeding COA templates and categories...');

  try {
    // Initialize database connection if not already initialized
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    // Seed account categories
    console.log('Seeding account categories...');
    const categoryRepo = AppDataSource.getRepository(AccountCategory);

    const categories = Object.values(ACCOUNT_CATEGORIES).map(cat => ({
      category_code: cat.code,
      name: cat.name,
      normal_balance: cat.normal_balance as "Debit" | "Credit",
      sort_order: parseInt(cat.code),
    }));

    for (const category of categories) {
      const exists = await categoryRepo.findOne({ where: { category_code: category.category_code } });
      if (!exists) {
        await categoryRepo.save(category as any);
        console.log(`  ✓ Created category ${category.category_code} — ${category.name}`);
      } else {
        console.log(`  ⊘ Category ${category.category_code} already exists`);
      }
    }

    // Seed COA templates
    console.log('Seeding COA templates...');
    const templateService = new COATemplateService();
    await templateService.seedDefaultTemplates();

    console.log('✅ COA templates and categories seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding COA templates:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  seedCOATemplates()
    .then(() => {
      console.log('Seed completed');
      process.exit(0);
    })
    .catch(err => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
