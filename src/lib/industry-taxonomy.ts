/**
 * MarketingOS — Industry taxonomy + Country reference data (Requirement 2).
 *
 * Provides a dynamic, non-hardcoded industry taxonomy and a maintained country
 * reference dataset. Both are seeded into the database (Industry / Country /
 * Region tables) so admins can add custom industries, sub-industries, and
 * geographic markets without code rewrites.
 *
 * The industry list covers the 15 categories named in the spec plus a rich
 * sub-industry tree. Countries are seeded with ISO 3166-1 alpha-2 codes and
 * privacy-law guidance notes (guidance only — not legal advice).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Industry catalog (Requirement 2 — 15 categories + sub-industries) ──────
interface IndustryDef {
  name: string;
  slug: string;
  description: string;
  icon?: string;
  children?: { name: string; slug: string; description: string }[];
}

export const INDUSTRY_CATALOG: IndustryDef[] = [
  {
    name: 'Education and Study Abroad',
    slug: 'education',
    description: 'Schools, universities, training, study-abroad consultancies, e-learning.',
    icon: 'graduation-cap',
    children: [
      { name: 'K-12 Schools', slug: 'education-k12', description: 'Primary and secondary schools.' },
      { name: 'Higher Education', slug: 'education-higher', description: 'Universities and colleges.' },
      { name: 'Study Abroad Consultancy', slug: 'education-study-abroad', description: 'Agencies placing students overseas.' },
      { name: 'E-Learning Platforms', slug: 'education-elearning', description: 'Online course providers and MOOCs.' },
      { name: 'Vocational Training', slug: 'education-vocational', description: 'Trade and skills training.' },
      { name: 'Language Learning', slug: 'education-language', description: 'Language schools and apps.' },
    ],
  },
  {
    name: 'Healthcare and Wellness',
    slug: 'healthcare',
    description: 'Clinics, hospitals, dental, mental health, fitness, wellness centers.',
    icon: 'heart-pulse',
    children: [
      { name: 'Hospitals', slug: 'healthcare-hospitals', description: 'General and specialty hospitals.' },
      { name: 'Clinics and Practices', slug: 'healthcare-clinics', description: 'Private clinics and group practices.' },
      { name: 'Dental', slug: 'healthcare-dental', description: 'Dental clinics and orthodontics.' },
      { name: 'Mental Health', slug: 'healthcare-mental', description: 'Therapy, counseling, psychiatry.' },
      { name: 'Fitness and Gyms', slug: 'healthcare-fitness', description: 'Gyms, studios, personal training.' },
      { name: 'Wellness and Spa', slug: 'healthcare-wellness', description: 'Spas, wellness retreats, alternative medicine.' },
      { name: 'Pharmaceutical', slug: 'healthcare-pharma', description: 'Pharmacies and pharma companies.' },
    ],
  },
  {
    name: 'Real Estate and Construction',
    slug: 'real-estate',
    description: 'Property development, agencies, construction firms, materials.',
    icon: 'building-2',
    children: [
      { name: 'Property Development', slug: 'realestate-development', description: 'Residential and commercial developers.' },
      { name: 'Real Estate Agencies', slug: 'realestate-agencies', description: 'Sales and letting agents.' },
      { name: 'Construction Firms', slug: 'realestate-construction', description: 'General contractors and builders.' },
      { name: 'Architecture and Design', slug: 'realestate-architecture', description: 'Architects and interior designers.' },
      { name: 'Building Materials', slug: 'realestate-materials', description: 'Suppliers of construction materials.' },
      { name: 'Property Management', slug: 'realestate-management', description: 'Facility and property management.' },
    ],
  },
  {
    name: 'Software and Technology',
    slug: 'technology',
    description: 'SaaS, IT services, software dev, hardware, cybersecurity.',
    icon: 'cpu',
    children: [
      { name: 'SaaS Products', slug: 'tech-saas', description: 'Software-as-a-Service companies.' },
      { name: 'IT Services', slug: 'tech-it-services', description: 'Managed IT and consulting.' },
      { name: 'Software Development', slug: 'tech-software-dev', description: 'Custom software and app dev agencies.' },
      { name: 'Cybersecurity', slug: 'tech-cybersecurity', description: 'Security software and services.' },
      { name: 'Cloud and DevOps', slug: 'tech-cloud', description: 'Cloud infrastructure and DevOps tools.' },
      { name: 'AI and ML', slug: 'tech-ai-ml', description: 'AI/ML platforms and consultancies.' },
      { name: 'Hardware and IoT', slug: 'tech-hardware', description: 'Device manufacturers and IoT.' },
    ],
  },
  {
    name: 'E-commerce and Retail',
    slug: 'ecommerce',
    description: 'Online stores, marketplaces, brick-and-mortar retail, D2C.',
    icon: 'shopping-cart',
    children: [
      { name: 'Online Stores', slug: 'ecommerce-stores', description: 'D2C and multi-brand e-commerce.' },
      { name: 'Marketplaces', slug: 'ecommerce-marketplaces', description: 'Multi-vendor platforms.' },
      { name: 'Retail Chains', slug: 'ecommerce-retail', description: 'Brick-and-mortar retail.' },
      { name: 'Fashion and Apparel', slug: 'ecommerce-fashion', description: 'Clothing and accessories.' },
      { name: 'Grocery and FMCG', slug: 'ecommerce-grocery', description: 'Food and fast-moving consumer goods.' },
      { name: 'Electronics Retail', slug: 'ecommerce-electronics', description: 'Consumer electronics.' },
    ],
  },
  {
    name: 'Finance and Professional Services',
    slug: 'finance',
    description: 'Banking, insurance, accounting, legal, consulting.',
    icon: 'landmark',
    children: [
      { name: 'Banking', slug: 'finance-banking', description: 'Banks and credit unions.' },
      { name: 'Insurance', slug: 'finance-insurance', description: 'Insurance carriers and brokers.' },
      { name: 'Accounting', slug: 'finance-accounting', description: 'CPA firms and bookkeeping.' },
      { name: 'Investment and Wealth', slug: 'finance-investment', description: 'Wealth management and funds.' },
      { name: 'Consulting', slug: 'finance-consulting', description: 'Management and strategy consulting.' },
      { name: 'Fintech', slug: 'finance-fintech', description: 'Payments, lending, and blockchain.' },
    ],
  },
  {
    name: 'Travel and Hospitality',
    slug: 'travel',
    description: 'Hotels, restaurants, tour operators, airlines, events.',
    icon: 'plane',
    children: [
      { name: 'Hotels and Lodging', slug: 'travel-hotels', description: 'Hotels, resorts, B&Bs.' },
      { name: 'Restaurants', slug: 'travel-restaurants', description: 'Restaurants and food service.' },
      { name: 'Tour Operators', slug: 'travel-tours', description: 'Travel agencies and tour companies.' },
      { name: 'Airlines and Transport', slug: 'travel-airlines', description: 'Airlines and ground transport.' },
      { name: 'Events and Venues', slug: 'travel-events', description: 'Event venues and planners.' },
    ],
  },
  {
    name: 'Manufacturing and Wholesale',
    slug: 'manufacturing',
    description: 'Factories, wholesalers, industrial supplies, distribution.',
    icon: 'factory',
    children: [
      { name: 'Heavy Manufacturing', slug: 'mfg-heavy', description: 'Industrial and heavy machinery.' },
      { name: 'Light Manufacturing', slug: 'mfg-light', description: 'Consumer goods manufacturing.' },
      { name: 'Wholesale Distribution', slug: 'mfg-wholesale', description: 'Wholesalers and distributors.' },
      { name: 'Industrial Supplies', slug: 'mfg-supplies', description: 'Industrial equipment and supplies.' },
      { name: 'Packaging', slug: 'mfg-packaging', description: 'Packaging materials and services.' },
    ],
  },
  {
    name: 'Logistics and Transportation',
    slug: 'logistics',
    description: 'Freight, shipping, warehousing, last-mile, supply chain.',
    icon: 'truck',
    children: [
      { name: 'Freight and Shipping', slug: 'logistics-freight', description: 'Ocean, air, and land freight.' },
      { name: 'Warehousing', slug: 'logistics-warehousing', description: 'Warehousing and fulfillment.' },
      { name: 'Last-Mile Delivery', slug: 'logistics-last-mile', description: 'Local and last-mile delivery.' },
      { name: 'Supply Chain Consulting', slug: 'logistics-supply-chain', description: 'Supply chain optimization.' },
      { name: 'Cold Chain', slug: 'logistics-cold-chain', description: 'Refrigerated transport and storage.' },
    ],
  },
  {
    name: 'Legal and Consulting',
    slug: 'legal',
    description: 'Law firms, IP, compliance, specialized consulting.',
    icon: 'scale',
    children: [
      { name: 'Law Firms', slug: 'legal-firms', description: 'General practice law firms.' },
      { name: 'IP and Patents', slug: 'legal-ip', description: 'Intellectual property specialists.' },
      { name: 'Compliance', slug: 'legal-compliance', description: 'Regulatory and compliance consulting.' },
      { name: 'HR Consulting', slug: 'legal-hr', description: 'Human resources consulting.' },
    ],
  },
  {
    name: 'Agriculture and Food',
    slug: 'agriculture',
    description: 'Farming, agribusiness, food processing, fisheries.',
    icon: 'wheat',
    children: [
      { name: 'Crop Farming', slug: 'agri-crops', description: 'Field crops and horticulture.' },
      { name: 'Livestock', slug: 'agri-livestock', description: 'Animal husbandry.' },
      { name: 'Food Processing', slug: 'agri-food-processing', description: 'Food and beverage processing.' },
      { name: 'Fisheries and Aquaculture', slug: 'agri-fisheries', description: 'Fishing and fish farming.' },
      { name: 'Agri-Tech', slug: 'agri-tech', description: 'Agricultural technology.' },
    ],
  },
  {
    name: 'Automotive',
    slug: 'automotive',
    description: 'Dealerships, repair, parts, EV, fleet services.',
    icon: 'car',
    children: [
      { name: 'Dealerships', slug: 'auto-dealers', description: 'New and used car dealers.' },
      { name: 'Repair and Service', slug: 'auto-repair', description: 'Auto repair shops.' },
      { name: 'Parts and Accessories', slug: 'auto-parts', description: 'Auto parts suppliers.' },
      { name: 'Electric Vehicles', slug: 'auto-ev', description: 'EV sales and charging.' },
      { name: 'Fleet Services', slug: 'auto-fleet', description: 'Fleet management and leasing.' },
    ],
  },
  {
    name: 'Beauty and Lifestyle',
    slug: 'beauty',
    description: 'Salons, cosmetics, personal care, lifestyle brands.',
    icon: 'sparkles',
    children: [
      { name: 'Salons and Spas', slug: 'beauty-salons', description: 'Hair, nail, and beauty salons.' },
      { name: 'Cosmetics', slug: 'beauty-cosmetics', description: 'Cosmetics brands and retailers.' },
      { name: 'Personal Care', slug: 'beauty-personal-care', description: 'Skincare and personal care.' },
      { name: 'Lifestyle Brands', slug: 'beauty-lifestyle', description: 'Lifestyle and wellness brands.' },
    ],
  },
  {
    name: 'Non-profit and Community Organizations',
    slug: 'nonprofit',
    description: 'Charities, NGOs, community groups, religious orgs.',
    icon: 'heart-handshake',
    children: [
      { name: 'Charities', slug: 'nonprofit-charities', description: 'Charitable foundations.' },
      { name: 'NGOs', slug: 'nonprofit-ngos', description: 'Non-governmental organizations.' },
      { name: 'Community Groups', slug: 'nonprofit-community', description: 'Local community organizations.' },
      { name: 'Religious Organizations', slug: 'nonprofit-religious', description: 'Religious institutions.' },
    ],
  },
  {
    name: 'Other / Custom Industry',
    slug: 'other',
    description: 'Industries not listed above — admins can add custom sub-industries here.',
    icon: 'more-horizontal',
    children: [
      { name: 'Energy and Utilities', slug: 'other-energy', description: 'Power, water, gas utilities.' },
      { name: 'Media and Entertainment', slug: 'other-media', description: 'Publishing, broadcasting, streaming.' },
      { name: 'Telecommunications', slug: 'other-telecom', description: 'Telecom carriers and services.' },
      { name: 'Government and Public Sector', slug: 'other-government', description: 'Government agencies.' },
      { name: 'Custom — Add Your Own', slug: 'other-custom', description: 'Placeholder for admin-added custom industries.' },
    ],
  },
];

// ── Country catalog (ISO 3166-1 + privacy-law guidance) ───────────────────
export interface CountryDef {
  isoCode: string;
  name: string;
  region: string;
  subRegion: string;
  currencyCode: string;
  currencySymbol: string;
  defaultLanguage: string;
  privacyLawNote: string;
  flagEmoji: string;
}

export const COUNTRY_CATALOG: CountryDef[] = [
  { isoCode: 'US', name: 'United States', region: 'Americas', subRegion: 'Northern America', currencyCode: 'USD', currencySymbol: '$', defaultLanguage: 'en', privacyLawNote: 'CCPA/CPRA may apply for California residents; state laws vary. Federal CAN-SPAM for email marketing.', flagEmoji: '🇺🇸' },
  { isoCode: 'CA', name: 'Canada', region: 'Americas', subRegion: 'Northern America', currencyCode: 'CAD', currencySymbol: 'C$', defaultLanguage: 'en', privacyLawNote: 'PIPEDA applies federally; Quebec Law 25 and other provincial laws may add requirements.', flagEmoji: '🇨🇦' },
  { isoCode: 'GB', name: 'United Kingdom', region: 'Europe', subRegion: 'Northern Europe', currencyCode: 'GBP', currencySymbol: '£', defaultLanguage: 'en', privacyLawNote: 'UK GDPR + Data Protection Act 2018. PECR for electronic marketing.', flagEmoji: '🇬🇧' },
  { isoCode: 'AU', name: 'Australia', region: 'Oceania', subRegion: 'Australia and New Zealand', currencyCode: 'AUD', currencySymbol: 'A$', defaultLanguage: 'en', privacyLawNote: 'Privacy Act 1988 + Australian Privacy Principles. Spam Act 2003 for commercial messages.', flagEmoji: '🇦🇺' },
  { isoCode: 'BD', name: 'Bangladesh', region: 'Asia', subRegion: 'South Asia', currencyCode: 'BDT', currencySymbol: '৳', defaultLanguage: 'bn', privacyLawNote: 'Data Protection Act 2022 (draft). ICT Act 2006. Verify current status before processing.', flagEmoji: '🇧🇩' },
  { isoCode: 'IN', name: 'India', region: 'Asia', subRegion: 'South Asia', currencyCode: 'INR', currencySymbol: '₹', defaultLanguage: 'hi', privacyLawNote: 'Digital Personal Data Protection Act 2023. TRAI regulations for commercial communications.', flagEmoji: '🇮🇳' },
  { isoCode: 'DE', name: 'Germany', region: 'Europe', subRegion: 'Western Europe', currencyCode: 'EUR', currencySymbol: '€', defaultLanguage: 'de', privacyLawNote: 'EU GDPR + German BDSG. Double opt-in required for marketing email.', flagEmoji: '🇩🇪' },
  { isoCode: 'FR', name: 'France', region: 'Europe', subRegion: 'Western Europe', currencyCode: 'EUR', currencySymbol: '€', defaultLanguage: 'fr', privacyLawNote: 'EU GDPR + French Data Protection Act (CNIL guidance).', flagEmoji: '🇫🇷' },
  { isoCode: 'AE', name: 'United Arab Emirates', region: 'Asia', subRegion: 'Western Asia', currencyCode: 'AED', currencySymbol: 'د.إ', defaultLanguage: 'ar', privacyLawNote: 'Federal Data Protection Law 2021. Verify sector-specific rules.', flagEmoji: '🇦🇪' },
  { isoCode: 'SG', name: 'Singapore', region: 'Asia', subRegion: 'South-Eastern Asia', currencyCode: 'SGD', currencySymbol: 'S$', defaultLanguage: 'en', privacyLawNote: 'PDPA 2012. DNC Registry for telemarketing.', flagEmoji: '🇸🇬' },
  { isoCode: 'JP', name: 'Japan', region: 'Asia', subRegion: 'Eastern Asia', currencyCode: 'JPY', currencySymbol: '¥', defaultLanguage: 'ja', privacyLawNote: 'APPI (Act on Protection of Personal Information).', flagEmoji: '🇯🇵' },
  { isoCode: 'BR', name: 'Brazil', region: 'Americas', subRegion: 'South America', currencyCode: 'BRL', currencySymbol: 'R$', defaultLanguage: 'pt', privacyLawNote: 'LGPD (Lei Geral de Proteção de Dados).', flagEmoji: '🇧🇷' },
  { isoCode: 'NG', name: 'Nigeria', region: 'Africa', subRegion: 'Western Africa', currencyCode: 'NGN', currencySymbol: '₦', defaultLanguage: 'en', privacyLawNote: 'NDPA 2023 (Nigeria Data Protection Act).', flagEmoji: '🇳🇬' },
  { isoCode: 'ZA', name: 'South Africa', region: 'Africa', subRegion: 'Southern Africa', currencyCode: 'ZAR', currencySymbol: 'R', defaultLanguage: 'en', privacyLawNote: 'POPIA (Protection of Personal Information Act).', flagEmoji: '🇿🇦' },
  { isoCode: 'MY', name: 'Malaysia', region: 'Asia', subRegion: 'South-Eastern Asia', currencyCode: 'MYR', currencySymbol: 'RM', defaultLanguage: 'ms', privacyLawNote: 'PDPA 2010 (Personal Data Protection Act).', flagEmoji: '🇲🇾' },
  { isoCode: 'PK', name: 'Pakistan', region: 'Asia', subRegion: 'South Asia', currencyCode: 'PKR', currencySymbol: '₨', defaultLanguage: 'ur', privacyLawNote: 'Personal Data Protection Bill (pending). PECA 2016 for electronic communication.', flagEmoji: '🇵🇰' },
];

/**
 * Seed the Industry and Country/Region tables (idempotent).
 * Safe to re-run — existing records are skipped.
 */
export async function seedTaxonomy(): Promise<{ industries: number; countries: number }> {
  let industriesInserted = 0;
  let countriesInserted = 0;

  // Industries
  for (const def of INDUSTRY_CATALOG) {
    const existing = await prisma.industry.findUnique({ where: { slug: def.slug } });
    if (existing) {
      // Ensure children exist
      if (def.children) {
        const parent = existing;
        for (const child of def.children) {
          const childExisting = await prisma.industry.findUnique({ where: { slug: child.slug } });
          if (!childExisting) {
            await prisma.industry.create({
              data: {
                name: child.name,
                slug: child.slug,
                description: child.description,
                parentId: parent.id,
                isActive: true,
                isCustom: false,
              },
            });
            industriesInserted++;
          }
        }
      }
      continue;
    }
    const parent = await prisma.industry.create({
      data: {
        name: def.name,
        slug: def.slug,
        description: def.description,
        icon: def.icon || null,
        isActive: true,
        isCustom: false,
      },
    });
    industriesInserted++;
    if (def.children) {
      for (const child of def.children) {
        const childExisting = await prisma.industry.findUnique({ where: { slug: child.slug } });
        if (!childExisting) {
          await prisma.industry.create({
            data: {
              name: child.name,
              slug: child.slug,
              description: child.description,
              parentId: parent.id,
              isActive: true,
              isCustom: false,
            },
          });
          industriesInserted++;
        }
      }
    }
  }

  // Countries
  for (const def of COUNTRY_CATALOG) {
    const existing = await prisma.country.findUnique({ where: { isoCode: def.isoCode } });
    if (existing) continue;
    await prisma.country.create({
      data: {
        isoCode: def.isoCode,
        name: def.name,
        slug: def.isoCode.toLowerCase(),
        region: def.region,
        subRegion: def.subRegion,
        currencyCode: def.currencyCode,
        currencySymbol: def.currencySymbol,
        defaultLanguage: def.defaultLanguage,
        privacyLawNote: def.privacyLawNote,
        flagEmoji: def.flagEmoji,
        isActive: true,
      },
    });
    countriesInserted++;
  }

  return { industries: industriesInserted, countries: countriesInserted };
}

/**
 * Add a custom industry (admin-added, tenant-scoped).
 */
export async function addCustomIndustry(
  companyId: string,
  name: string,
  parentId?: string,
  description?: string,
) {
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-custom-${Date.now()}`;
  return prisma.industry.create({
    data: {
      name,
      slug,
      description: description || `Custom industry added by tenant ${companyId}`,
      parentId: parentId || null,
      isActive: true,
      isCustom: true,
      companyId,
    },
  });
}

/**
 * List industries (global catalog + tenant-custom), as a tree.
 */
export async function listIndustryTree(companyId?: string) {
  const industries = await prisma.industry.findMany({
    where: {
      OR: [{ companyId: null }, ...(companyId ? [{ companyId }] : [])],
      isActive: true,
    },
    orderBy: [{ name: 'asc' }],
  });
  // Build tree
  const byParent = new Map<string | null, typeof industries>();
  for (const ind of industries) {
    const key = ind.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(ind);
  }
  const buildTree = (parentId: string | null): any[] => {
    const children = byParent.get(parentId) || [];
    return children.map((ind) => ({
      ...ind,
      children: buildTree(ind.id),
    }));
  };
  return buildTree(null);
}

/**
 * List countries (optionally filtered by region).
 */
export async function listCountries(region?: string) {
  return prisma.country.findMany({
    where: {
      isActive: true,
      ...(region ? { region } : {}),
    },
    orderBy: [{ name: 'asc' }],
  });
}
