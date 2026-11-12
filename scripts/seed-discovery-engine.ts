/**
 * MarketingOS — Seed the Universal Lead Discovery Engine taxonomy + provider registry.
 *
 * Seeds:
 *   - 15 industry categories + ~80 sub-industries (Industry table)
 *   - 16 countries with privacy-law guidance (Country table)
 *   - 16 data providers for the free-first discovery registry (DataProvider table)
 *
 * Idempotent — existing records are skipped. Safe to re-run.
 */
import { PrismaClient } from '@prisma/client';
import { seedTaxonomy } from '../src/lib/industry-taxonomy';
import { seedDataProviders } from '../src/lib/data-providers';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Seeding Universal Lead Discovery Engine taxonomy + providers...\n');

  console.log('📍 Industries + Countries...');
  const taxonomyResult = await seedTaxonomy();
  console.log(`  ✅ Industries inserted: ${taxonomyResult.industries}`);
  console.log(`  ✅ Countries inserted: ${taxonomyResult.countries}\n`);

  console.log('🔗 Data Providers (free-first registry)...');
  const providersResult = await seedDataProviders();
  console.log(`  ✅ Data providers inserted: ${providersResult}\n`);

  // Verify counts
  const [industryCount, countryCount, providerCount] = await Promise.all([
    prisma.industry.count(),
    prisma.country.count(),
    prisma.dataProvider.count(),
  ]);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Seed complete — verified counts:');
  console.log(`    Industries:      ${industryCount}`);
  console.log(`    Countries:       ${countryCount}`);
  console.log(`    Data providers:  ${providerCount}`);
  console.log('═══════════════════════════════════════════════════════════');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    console.error(e.stack);
    await prisma.$disconnect();
    process.exit(1);
  });
