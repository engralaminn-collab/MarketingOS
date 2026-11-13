/**
 * MarketingOS — MerlinStacks integration tests.
 *
 * Verifies:
 *   1. All 4 services are in the catalog (socaliseit, overseek, personaliseit, true_video_product_gallery)
 *   2. Connections can be created (upsert) and are tenant-isolated
 *   3. Connection summary shows correct status
 *   4. Adapters are registered for all 4 services
 *   5. Removing a connection works
 *   6. Providers are seeded in the DataProvider table
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

let pass = 0;
let fail = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { console.log(`  ✅ PASS — ${msg}`); pass++; }
  else { console.log(`  ❌ FAIL — ${msg}`); fail++; }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  MerlinStacks Integration Tests');
  console.log('═══════════════════════════════════════════════════════════\n');

  const { MERLINSTACKS_SERVICES, getService, upsertConnection, getConnection, listConnections, removeConnection, getConnectionSummary, adapters } =
    await import('../src/lib/merlinstacks-adapters');

  // Create test company
  const company = await prisma.company.create({
    data: { name: 'MerlinStacks Test Co', slug: 'ms-test-' + Date.now() },
  });
  const companyB = await prisma.company.create({
    data: { name: 'MerlinStacks Test Co B', slug: 'ms-test-b-' + Date.now() },
  });

  try {
    // ── Test 1: Service catalog ────────────────────────────────────────
    console.log('▶ Test 1: Service catalog (4 MerlinStacks services)');
    assert(MERLINSTACKS_SERVICES.length === 4, `Catalog has 4 services (got ${MERLINSTACKS_SERVICES.length})`);
    const slugs = MERLINSTACKS_SERVICES.map(s => s.slug);
    assert(slugs.includes('socaliseit'), 'socaliseit is in catalog');
    assert(slugs.includes('overseek'), 'overseek is in catalog');
    assert(slugs.includes('personaliseit'), 'personaliseit is in catalog');
    assert(slugs.includes('true_video_product_gallery'), 'true_video_product_gallery is in catalog');
    assert(MERLINSTACKS_SERVICES.every(s => s.repoUrl.includes('github.com/MerlinStacks/')), 'All repos point to MerlinStacks GitHub org');
    console.log('');

    // ── Test 2: Adapters registered ────────────────────────────────────
    console.log('▶ Test 2: Adapters registered for all 4 services');
    assert(typeof adapters.socaliseit?.testConnection === 'function', 'socaliseit adapter has testConnection');
    assert(typeof adapters.overseek?.testConnection === 'function', 'overseek adapter has testConnection');
    assert(typeof adapters.personaliseit?.testConnection === 'function', 'personaliseit adapter has testConnection');
    assert(typeof adapters.true_video_product_gallery?.testConnection === 'function', 'true_video_product_gallery adapter has testConnection');
    // Verify each adapter has service-specific methods
    assert(typeof adapters.socaliseit?.publishContent === 'function', 'socaliseit adapter has publishContent');
    assert(typeof adapters.overseek?.syncOrders === 'function', 'overseek adapter has syncOrders');
    assert(typeof adapters.personaliseit?.getPrintQueue === 'function', 'personaliseit adapter has getPrintQueue');
    assert(typeof adapters.true_video_product_gallery?.assignVideo === 'function', 'true_video_product_gallery adapter has assignVideo');
    console.log('');

    // ── Test 3: Create connections ─────────────────────────────────────
    console.log('▶ Test 3: Create/update connections (tenant-scoped)');
    await upsertConnection(company.id, 'socaliseit', {
      baseUrl: 'https://social.example.com',
      apiKey: 'test-key-1',
    });
    await upsertConnection(company.id, 'overseek', {
      baseUrl: 'https://ops.example.com',
      apiKey: 'test-key-2',
    });
    const conn1 = await getConnection(company.id, 'socaliseit');
    assert(!!conn1, 'socaliseit connection created');
    assert(conn1?.baseUrl === 'https://social.example.com', 'Connection stores baseUrl');
    assert(conn1?.status === 'connected', 'Connection status is connected');
    assert(conn1?.apiKey === 'test-key-1', 'Connection stores apiKey');

    const conn2 = await getConnection(company.id, 'overseek');
    assert(!!conn2, 'overseek connection created');
    console.log('');

    // ── Test 4: Update existing connection (upsert) ───────────────────
    console.log('▶ Test 4: Update existing connection (upsert)');
    await upsertConnection(company.id, 'socaliseit', {
      baseUrl: 'https://social-updated.example.com',
      apiKey: 'new-key',
    });
    const updated = await getConnection(company.id, 'socaliseit');
    assert(updated?.baseUrl === 'https://social-updated.example.com', 'Connection baseUrl updated');
    assert(updated?.apiKey === 'new-key', 'Connection apiKey updated');
    const allConns = await listConnections(company.id);
    assert(allConns.length === 2, `Company has 2 connections (got ${allConns.length})`);
    console.log('');

    // ── Test 5: Tenant isolation ───────────────────────────────────────
    console.log('▶ Test 5: Tenant isolation');
    const companyBConns = await listConnections(companyB.id);
    assert(companyBConns.length === 0, 'Company B has no connections (isolation)');
    const companyBConn = await getConnection(companyB.id, 'socaliseit');
    assert(!companyBConn, 'Company B cannot access Company A\'s socaliseit connection');
    console.log('');

    // ── Test 6: Connection summary ─────────────────────────────────────
    console.log('▶ Test 6: Connection summary');
    const summary = await getConnectionSummary(company.id);
    assert(summary.length === 4, `Summary has 4 services (got ${summary.length})`);
    const connected = summary.filter(s => s.connected);
    assert(connected.length === 2, `2 services connected (got ${connected.length})`);
    const socaliseitSummary = summary.find(s => s.slug === 'socaliseit');
    assert(socaliseitSummary?.connected === true, 'socaliseit shows as connected in summary');
    assert(socaliseitSummary?.baseUrl === 'https://social-updated.example.com', 'Summary shows correct baseUrl');
    const unconnected = summary.find(s => s.slug === 'personaliseit');
    assert(unconnected?.connected === false, 'personaliseit shows as not connected');
    assert(unconnected?.repoUrl === 'https://github.com/MerlinStacks/personaliseit', 'Summary includes repo URL for unconnected service');
    console.log('');

    // ── Test 7: Remove connection ──────────────────────────────────────
    console.log('▶ Test 7: Remove connection');
    await removeConnection(company.id, 'overseek');
    const afterRemove = await getConnection(company.id, 'overseek');
    assert(!afterRemove, 'overseek connection removed');
    const afterRemoveList = await listConnections(company.id);
    assert(afterRemoveList.length === 1, `1 connection remains (got ${afterRemoveList.length})`);
    console.log('');

    // ── Test 8: Data providers seeded ──────────────────────────────────
    console.log('▶ Test 8: MerlinStacks services in DataProvider registry');
    const { seedDataProviders } = await import('../src/lib/data-providers');
    await seedDataProviders();
    const dpSocaliseit = await prisma.dataProvider.findUnique({ where: { slug: 'socaliseit' } });
    assert(!!dpSocaliseit, 'socaliseit is in DataProvider table');
    assert(dpSocaliseit?.category === 'social_community', 'socaliseit categorized as social_community');
    const dpOverseek = await prisma.dataProvider.findUnique({ where: { slug: 'overseek' } });
    assert(!!dpOverseek, 'overseek is in DataProvider table');
    const dpPersonaliseit = await prisma.dataProvider.findUnique({ where: { slug: 'personaliseit' } });
    assert(!!dpPersonaliseit, 'personaliseit is in DataProvider table');
    const dpVideoGallery = await prisma.dataProvider.findUnique({ where: { slug: 'true_video_product_gallery' } });
    assert(!!dpVideoGallery, 'true_video_product_gallery is in DataProvider table');
    console.log('');

  } finally {
    // Cleanup
    await prisma.externalServiceConnection.deleteMany({ where: { companyId: company.id } }).catch(() => null);
    await prisma.externalServiceConnection.deleteMany({ where: { companyId: companyB.id } }).catch(() => null);
    await prisma.company.deleteMany({ where: { id: { in: [company.id, companyB.id] } } }).catch(() => null);
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Results: ${pass} passed, ${fail} failed`);
  console.log('═══════════════════════════════════════════════════════════');
  if (fail > 0) process.exit(1);
}

main().catch(e => { console.error('Crashed:', e); process.exit(1); }).finally(() => prisma.$disconnect());
