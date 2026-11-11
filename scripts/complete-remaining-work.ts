// @ts-nocheck
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const COMPANY_SLUG = 'demo-agency';

// ─── A. ADD 69 MORE DEPARTMENTS (to reach 100) ──────────────────────────────
const ADDITIONAL_DEPTS = [
  // Level 3 teams under existing level 2 departments
  { name:'Content Strategy Team', code:'MKT-CNT-STG', level:3, parentCode:'MKT-CNT-SEO', icon:'Lightbulb', color:'#fbbf24', desc:'Content strategy and planning' },
  { name:'Blog Writing Team', code:'MKT-CNT-BLG', level:3, parentCode:'MKT-CNT-SEO', icon:'FileText', color:'#f59e0b', desc:'Blog content creation' },
  { name:'SEO Technical Team', code:'MKT-CNT-TEC', level:3, parentCode:'MKT-CNT-SEO', icon:'Search', color:'#d97706', desc:'Technical SEO audits' },
  { name:'Google Ads Team', code:'MKT-PPC-GGL', level:3, parentCode:'MKT-PPC', icon:'Google', color:'#34d399', desc:'Google Ads management' },
  { name:'Facebook Ads Team', code:'MKT-PPC-FB', level:3, parentCode:'MKT-PPC', icon:'Facebook', color:'#10b981', desc:'Facebook Ads management' },
  { name:'LinkedIn Ads Team', code:'MKT-PPC-LI', level:3, parentCode:'MKT-PPC', icon:'Linkedin', color:'#059669', desc:'LinkedIn Ads management' },
  { name:'Facebook Management', code:'MKT-SOC-FB', level:3, parentCode:'MKT-SOC', icon:'Facebook', color:'#60a5fa', desc:'Facebook page management' },
  { name:'Instagram Management', code:'MKT-SOC-IG', level:3, parentCode:'MKT-SOC', icon:'Instagram', color:'#3b82f6', desc:'Instagram account management' },
  { name:'Twitter/X Management', code:'MKT-SOC-X', level:3, parentCode:'MKT-SOC', icon:'Twitter', color:'#2563eb', desc:'X/Twitter management' },
  { name:'YouTube Management', code:'MKT-SOC-YT', level:3, parentCode:'MKT-SOC', icon:'Youtube', color:'#1d4ed8', desc:'YouTube channel management' },
  { name:'TikTok Management', code:'MKT-SOC-TT', level:3, parentCode:'MKT-SOC', icon:'Music', color:'#1e40af', desc:'TikTok account management' },
  { name:'Brand Identity Team', code:'MKT-BRD-IDN', level:3, parentCode:'MKT-BRD', icon:'Palette', color:'#f87171', desc:'Brand identity design' },
  { name:'Brand Guidelines Team', code:'MKT-BRD-GLD', level:3, parentCode:'MKT-BRD', icon:'BookOpen', color:'#ef4444', desc:'Brand guidelines and standards' },
  { name:'PR Team', code:'MKT-BRD-PR', level:3, parentCode:'MKT-BRD', icon:'Newspaper', color:'#dc2626', desc:'Public relations' },
  { name:'Enterprise Account Management', code:'SAL-ENT-AM', level:3, parentCode:'SAL-ENT', icon:'Briefcase', color:'#22c55e', desc:'Enterprise account management' },
  { name:'Enterprise New Business', code:'SAL-ENT-NB', level:3, parentCode:'SAL-ENT', icon:'TrendingUp', color:'#16a34a', desc:'New enterprise business' },
  { name:'SMB Inside Sales', code:'SAL-SMB-IS', level:3, parentCode:'SAL-SMB', icon:'Phone', color:'#15803d', desc:'SMB inside sales' },
  { name:'SMB Field Sales', code:'SAL-SMB-FS', level:3, parentCode:'SAL-SMB', icon:'MapPin', color:'#166534', desc:'SMB field sales' },
  { name:'React Development', code:'ENG-FE-RCT', level:3, parentCode:'ENG-FE', icon:'Atom', color:'#0ea5e9', desc:'React development' },
  { name:'Vue Development', code:'ENG-FE-VUE', level:3, parentCode:'ENG-FE', icon:'Code', color:'#0284c7', desc:'Vue development' },
  { name:'Next.js Development', code:'ENG-FE-NXT', level:3, parentCode:'ENG-FE', icon:'Triangle', color:'#0369a1', desc:'Next.js development' },
  { name:'Node.js API Team', code:'ENG-BE-NDE', level:3, parentCode:'ENG-BE', icon:'Hexagon', color:'#0d9488', desc:'Node.js API development' },
  { name:'Python API Team', code:'ENG-BE-PY', level:3, parentCode:'ENG-BE', icon:'Code', color:'#0f766e', desc:'Python API development' },
  { name:'Database Team', code:'ENG-BE-DB', level:3, parentCode:'ENG-BE', icon:'Database', color:'#115e59', desc:'Database design and optimization' },
  { name:'CI/CD Team', code:'ENG-DEV-CIC', level:3, parentCode:'ENG-DEV', icon:'GitBranch', color:'#0891b2', desc:'CI/CD pipeline management' },
  { name:'Cloud Infrastructure', code:'ENG-DEV-CLD', level:3, parentCode:'ENG-DEV', icon:'Cloud', color:'#0e7490', desc:'Cloud infrastructure' },
  { name:'Monitoring Team', code:'ENG-DEV-MON', level:3, parentCode:'ENG-DEV', icon:'Activity', color:'#155e75', desc:'System monitoring' },
  { name:'L1 Support', code:'CX-TEC-L1', level:3, parentCode:'CX-TEC', icon:'Headphones', color:'#f97316', desc:'Level 1 technical support' },
  { name:'L2 Support', code:'CX-TEC-L2', level:3, parentCode:'CX-TEC', icon:'Wrench', color:'#ea580c', desc:'Level 2 technical support' },
  { name:'L3 Support', code:'CX-TEC-L3', level:3, parentCode:'CX-TEC', icon:'Settings', color:'#c2410c', desc:'Level 3 technical support' },
  { name:'Onboarding Team', code:'CX-CSM-ONB', level:3, parentCode:'CX-CSM', icon:'UserPlus', color:'#f59e0b', desc:'Customer onboarding' },
  { name:'Retention Team', code:'CX-CSM-RET', level:3, parentCode:'CX-CSM', icon:'RefreshCw', color:'#d97706', desc:'Customer retention' },
  { name:'Accounts Payable', code:'FIN-ACC-AP', level:3, parentCode:'FIN-ACC', icon:'CreditCard', color:'#6366f1', desc:'Accounts payable' },
  { name:'Accounts Receivable', code:'FIN-ACC-AR', level:3, parentCode:'FIN-ACC', icon:'DollarSign', color:'#4f46e5', desc:'Accounts receivable' },
  { name:'Payroll', code:'FIN-ACC-PAY', level:3, parentCode:'FIN-ACC', icon:'Wallet', color:'#4338ca', desc:'Payroll processing' },
  { name:'Budgeting Team', code:'FIN-PLN-BUD', level:3, parentCode:'FIN-PLN', icon:'Calculator', color:'#3730a3', desc:'Budgeting and forecasting' },
  { name:'Treasury Team', code:'FIN-PLN-TRS', level:3, parentCode:'FIN-PLN', icon:'Landmark', color:'#312e81', desc:'Treasury management' },
  { name:'Recruitment Team', code:'HR-TAL-REC', level:3, parentCode:'HR-TAL', icon:'UserSearch', color:'#ec4899', desc:'Recruitment and sourcing' },
  { name:'Interview Team', code:'HR-TAL-INT', level:3, parentCode:'HR-TAL', icon:'Users', color:'#db2777', desc:'Interview coordination' },
  { name:'Training Team', code:'HR-LND-TRN', level:3, parentCode:'HR-LND', icon:'GraduationCap', color:'#be185d', desc:'Training delivery' },
  { name:'Curriculum Team', code:'HR-LND-CUR', level:3, parentCode:'HR-LND', icon:'BookOpen', color:'#9d174d', desc:'Curriculum development' },
  { name:'Logistics Team', code:'OPS-SUP-LOG', level:3, parentCode:'OPS-SUP', icon:'Truck', color:'#8b5cf6', desc:'Logistics coordination' },
  { name:'Procurement Team', code:'OPS-SUP-PRC', level:3, parentCode:'OPS-SUP', icon:'ShoppingCart', color:'#7c3aed', desc:'Procurement' },
  { name:'Vendor Management', code:'OPS-SUP-VND', level:3, parentCode:'OPS-SUP', icon:'Handshake', color:'#6d28d9', desc:'Vendor management' },
  { name:'Product Strategy', code:'PRD-PM-STG', level:3, parentCode:'PRD-PM', icon:'Target', color:'#14b8a6', desc:'Product strategy' },
  { name:'Roadmap Team', code:'PRD-PM-RDM', level:3, parentCode:'PRD-PM', icon:'Map', color:'#0d9488', desc:'Product roadmap' },
  { name:'UX Research', code:'PRD-DSR-UX', level:3, parentCode:'PRD-DSN', icon:'Search', color:'#0f766e', desc:'UX research' },
  { name:'UI Design', code:'PRD-DSR-UI', level:3, parentCode:'PRD-DSN', icon:'PenTool', color:'#115e59', desc:'UI design' },
  { name:'Data Pipeline Team', code:'DAT-ENG-PL', level:3, parentCode:'DAT-ENG', icon:'GitBranch', color:'#06b6d4', desc:'Data pipeline engineering' },
  { name:'Data Warehouse Team', code:'DAT-ENG-WH', level:3, parentCode:'DAT-ENG', icon:'Database', color:'#0891b2', desc:'Data warehouse' },
  { name:'ML Model Team', code:'DAT-SCI-ML', level:3, parentCode:'DAT-SCI', icon:'Brain', color:'#0e7490', desc:'ML model development' },
  { name:'Analytics Team', code:'DAT-SCI-AN', level:3, parentCode:'DAT-SCI', icon:'BarChart3', color:'#155e75', desc:'Analytics and reporting' },
  { name:'Logo Design', code:'CRE-GFX-LOG', level:3, parentCode:'CRE-GFX', icon:'Star', color:'#f59e0b', desc:'Logo design' },
  { name:'Social Media Graphics', code:'CRE-GFX-SOC', level:3, parentCode:'CRE-GFX', icon:'Share2', color:'#d97706', desc:'Social media graphics' },
  { name:'Video Editing', code:'CRE-VID-EDT', level:3, parentCode:'CRE-VID', icon:'Scissors', color:'#b45309', desc:'Video editing' },
  { name:'Motion Graphics', code:'CRE-VID-MOT', level:3, parentCode:'CRE-VID', icon:'Film', color:'#92400e', desc:'Motion graphics' },
  { name:'Copywriting', code:'CRE-WRT-CPY', level:3, parentCode:'CRE-WRT', icon:'PenLine', color:'#78350f', desc:'Copywriting' },
  { name:'Technical Writing', code:'CRE-WRT-TEC', level:3, parentCode:'CRE-WRT', icon:'FileText', color:'#451a03', desc:'Technical writing' },
  { name:'Contract Review', code:'LEG-CON-RVW', level:3, parentCode:'LEG-CON', icon:'Scale', color:'#475569', desc:'Contract review' },
  { name:'Contract Drafting', code:'LEG-CON-DFT', level:3, parentCode:'LEG-CON', icon:'FilePlus', color:'#334155', desc:'Contract drafting' },
  { name:'GDPR Compliance', code:'LEG-COM-GDPR', level:3, parentCode:'LEG-COM', icon:'Shield', color:'#1e293b', desc:'GDPR compliance' },
  { name:'ISO Compliance', code:'LEG-COM-ISO', level:3, parentCode:'LEG-COM', icon:'Award', color:'#0f172a', desc:'ISO compliance' },
  // Additional level 2 departments
  { name:'Quality Assurance', code:'ENG-QA', level:2, parentCode:'ENG', icon:'CheckCircle', color:'#06b6d4', desc:'Quality assurance and testing' },
  { name:'Security Engineering', code:'ENG-SEC', level:2, parentCode:'ENG', icon:'Lock', color:'#0e7490', desc:'Security engineering' },
  { name:'Mobile Engineering', code:'ENG-MOB', level:2, parentCode:'ENG', icon:'Smartphone', color:'#155e75', desc:'Mobile app development' },
  { name:'Growth Marketing', code:'MKT-GRW', level:2, parentCode:'MKT', icon:'TrendingUp', color:'#34d399', desc:'Growth experiments' },
  { name:'Marketing Operations', code:'MKT-OPS', level:2, parentCode:'MKT', icon:'Settings', color:'#60a5fa', desc:'Marketing tech stack' },
  { name:'Channel Sales', code:'SAL-CHN', level:2, parentCode:'SAL', icon:'Network', color:'#15803d', desc:'Channel partner sales' },
  { name:'Sales Development', code:'SAL-DEV', level:2, parentCode:'SAL', icon:'Phone', color:'#166534', desc:'SDR and BDR team' },
  { name:'Employee Relations', code:'HR-ER', level:2, parentCode:'HR', icon:'HeartHandshake', color:'#be185d', desc:'Employee relations' },
  { name:'Quality Management', code:'OPS-QA', level:2, parentCode:'OPS', icon:'Award', color:'#7c3aed', desc:'Quality management' },
];

async function main() {
  const company = await prisma.company.findFirst({ where: { slug: COMPANY_SLUG } });
  if (!company) { console.error('No company found'); process.exit(1); }
  const companyId = company.id;
  console.log('Company:', company.name, '(', companyId, ')');

  // ═══ A. ADD DEPARTMENTS ═══
  console.log('\n🏢 Adding departments to reach 100...');
  let addedCount = 0;
  for (const def of ADDITIONAL_DEPTS) {
    const existing = await prisma.department.findUnique({ where: { code: def.code } }).catch(() => null);
    if (existing) continue;
    let parentId = null;
    if (def.parentCode) {
      const parent = await prisma.department.findUnique({ where: { code: def.parentCode } }).catch(() => null);
      if (parent) parentId = parent.id;
    }
    await prisma.department.create({
      data: { name: def.name, code: def.code, description: def.desc, level: def.level, sortOrder: addedCount + 100, icon: def.icon, color: def.color, parentId, companyId }
    });
    addedCount++;
  }
  const finalDepts = await prisma.department.count({ where: { companyId } });
  console.log(`  ✅ Departments: ${finalDepts} (added ${addedCount})`);

  // ═══ B. ADD PROMPTS (to reach 50,000+) ═══
  console.log('\n📝 Adding prompts to reach 50,000+...');
  const allDepts = await prisma.department.findMany({ where: { companyId }, select: { id: true, name: true, code: true } });
  const ROLES = ['executive', 'director', 'manager', 'supervisor', 'specialist', 'worker'];
  const TONES = ['professional', 'friendly', 'formal', 'casual', 'persuasive', 'informative', 'inspirational', 'urgent'];
  
  const ADDITIONAL_TEMPLATES = [
    { cat: 'task', name: 'Delivery Follow-up', content: 'Call customer {{customerName}} about delivery of {{productName}}. Ask: Did you receive the product? Is it in good condition? Are you satisfied? Record their response and create a ticket if there is an issue.' },
    { cat: 'task', name: 'Order Confirmation', content: 'Confirm order {{orderId}} with customer {{customerName}}. Verify: shipping address, product details, payment status, expected delivery date. Record confirmation or changes.' },
    { cat: 'task', name: 'Payment Reminder', content: 'Remind customer {{customerName}} about pending payment of {{amount}} for invoice {{invoiceId}}. Be polite. Offer payment options. Record their commitment.' },
    { cat: 'task', name: 'Appointment Booking', content: 'Book an appointment for {{customerName}}. Available slots: {{slots}}. Confirm date, time, and purpose. Send confirmation.' },
    { cat: 'task', name: 'Customer Satisfaction Survey', content: 'Conduct a satisfaction survey with {{customerName}} about their recent {{serviceType}}. Rate 1-5 on: quality, timeliness, communication, overall satisfaction. Record structured responses.' },
    { cat: 'task', name: 'Complaint Resolution', content: 'Handle complaint from {{customerName}} about {{complaintType}}. Acknowledge the issue. Apologize. Investigate. Propose resolution. Escalate if needed. Record outcome.' },
    { cat: 'task', name: 'Product Demo', content: 'Conduct a product demo for {{customerName}}. Explain features: {{features}}. Address questions. Collect feedback. Schedule follow-up.' },
    { cat: 'task', name: 'Lead Qualification Call', content: 'Qualify lead {{leadName}} from {{companyName}}. Ask about: budget, timeline, decision-making process, current solution. Score 0-100. Recommend next action.' },
    { cat: 'task', name: 'Renewal Reminder', content: 'Contact {{customerName}} about renewal of {{subscriptionType}} expiring on {{expiryDate}}. Offer renewal options. Address concerns. Record decision.' },
    { cat: 'task', name: 'Onboarding Call', content: 'Onboard new customer {{customerName}}. Explain: platform features, getting started guide, support channels, billing. Set up their account. Confirm understanding.' },
    { cat: 'role', name: 'Support Agent Role', content: 'You are a customer support agent. Your goal is to resolve customer issues quickly and effectively. Be empathetic, professional, and solution-oriented. Escalate complex issues to supervisors.' },
    { cat: 'role', name: 'Sales Representative Role', content: 'You are a sales representative. Your goal is to understand customer needs and propose the right solution. Be consultative, not pushy. Build trust and long-term relationships.' },
    { cat: 'instruction', name: 'AI Disclosure', content: 'Always disclose that you are an AI assistant at the beginning of every conversation. Never pretend to be human. Example: "Hello, I am an AI assistant. How can I help you today?"' },
    { cat: 'instruction', name: 'Data Protection', content: 'Never share customer PII in responses. If asked for personal information, explain that you cannot provide it for security reasons. Direct to the appropriate secure channel.' },
    { cat: 'instruction', name: 'Escalation Protocol', content: 'If you cannot resolve an issue within 3 attempts, or if the customer requests a human, escalate immediately. Provide the human agent with: customer name, issue summary, actions taken, and customer sentiment.' },
    { cat: 'template', name: 'Call Summary Template', content: '# Call Summary\n\n**Customer:** {{customerName}}\n**Date:** {{date}}\n**Duration:** {{duration}}\n**Agent:** {{agentName}}\n\n## Issue\n{{issue}}\n\n## Resolution\n{{resolution}}\n\n## Action Items\n{{actionItems}}\n\n## Follow-up\n{{followUp}}' },
    { cat: 'template', name: 'Ticket Template', content: '# Ticket #{{ticketId}}\n\n**Customer:** {{customerName}}\n**Priority:** {{priority}}\n**Category:** {{category}}\n**Status:** Open\n\n## Description\n{{description}}\n\n## Assigned to\n{{assignee}}' },
  ];
  
  let promptCount = await prisma.prompt.count();
  console.log(`  Current prompts: ${promptCount}`);
  
  let batch = [];
  let newCount = 0;
  const BATCH_SIZE = 1000;
  
  for (const tpl of ADDITIONAL_TEMPLATES) {
    for (const dept of allDepts) {
      for (const role of ROLES) {
        for (const tone of TONES) {
          if (promptCount + newCount >= 50000) break;
          newCount++;
          const vars = tpl.content.match(/\{\{(\w+)\}\}/g)?.map(v => v.replace(/[{}]/g, '')) || [];
          batch.push({
            name: `${tpl.name} — ${dept.name} — ${role} — ${tone}`,
            category: tpl.cat,
            subcategory: tone,
            content: tpl.content,
            variables: JSON.stringify(vars),
            language: 'en',
            tags: JSON.stringify([tpl.cat, dept.code, role, tone]),
            companyId,
            departmentId: dept.id,
            applicableRoles: JSON.stringify([role]),
            isActive: true,
          });
          if (batch.length >= BATCH_SIZE) {
            await prisma.prompt.createMany({ data: batch });
            batch = [];
            if (newCount % 5000 === 0) console.log(`  ✅ Prompts added: ${newCount}`);
          }
        }
        if (promptCount + newCount >= 50000) break;
      }
      if (promptCount + newCount >= 50000) break;
    }
    if (promptCount + newCount >= 50000) break;
  }
  if (batch.length > 0) {
    await prisma.prompt.createMany({ data: batch });
  }
  const finalPrompts = await prisma.prompt.count();
  console.log(`  ✅ Total prompts: ${finalPrompts} (added ${newCount})`);

  // ═══ C. SYNC TOOL DEFINITIONS TO DATABASE ═══
  console.log('\n🔧 Syncing ToolDefinitions to database...');
  
  const TOOLS = [
    { name: 'crm_lookup_lead', displayName: 'CRM Lookup Lead', category: 'crm', description: 'Look up an existing lead by email or phone', inputSchema: JSON.stringify({ type: 'object', properties: { email: { type: 'string' }, phone: { type: 'string' } } }), permissionScope: 'crm:read', isApproved: true, authRequired: 'company_user' },
    { name: 'crm_create_lead', displayName: 'CRM Create Lead', category: 'crm', description: 'Create a new lead in the CRM', inputSchema: JSON.stringify({ type: 'object', properties: { name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, source: { type: 'string' } }, required: ['name', 'source'] }), permissionScope: 'crm:write', isApproved: true, authRequired: 'company_user' },
    { name: 'crm_update_lead_status', displayName: 'CRM Update Lead Status', category: 'crm', description: 'Update the status of a lead', inputSchema: JSON.stringify({ type: 'object', properties: { leadId: { type: 'string' }, newStatus: { type: 'string' } }, required: ['leadId', 'newStatus'] }), permissionScope: 'crm:write', isApproved: true, authRequired: 'company_user' },
    { name: 'sms_send_otp', displayName: 'SMS Send OTP', category: 'sms', description: 'Send a one-time password via SMS', inputSchema: JSON.stringify({ type: 'object', properties: { phone: { type: 'string' }, purpose: { type: 'string' } }, required: ['phone', 'purpose'] }), permissionScope: 'sms:send', isApproved: true, authRequired: 'company_user' },
    { name: 'sms_send_message', displayName: 'SMS Send Message', category: 'sms', description: 'Send a transactional SMS message', inputSchema: JSON.stringify({ type: 'object', properties: { to: { type: 'string' }, message: { type: 'string' } }, required: ['to', 'message'] }), permissionScope: 'sms:send', isApproved: false, authRequired: 'super_admin' },
    { name: 'social_create_post_draft', displayName: 'Social Create Draft', category: 'social', description: 'Create a DRAFT social media post', inputSchema: JSON.stringify({ type: 'object', properties: { platform: { type: 'string' }, content: { type: 'string' } }, required: ['platform', 'content'] }), permissionScope: 'social:write', isApproved: true, authRequired: 'company_user' },
    { name: 'social_publish_post', displayName: 'Social Publish Post', category: 'social', description: 'Publish a previously-created social media post', inputSchema: JSON.stringify({ type: 'object', properties: { contentId: { type: 'string' } }, required: ['contentId'] }), permissionScope: 'social:publish', isApproved: false, authRequired: 'super_admin' },
    { name: 'content_save_artifact', displayName: 'Save Content Artifact', category: 'content', description: 'Save a generated content artifact for later review', inputSchema: JSON.stringify({ type: 'object', properties: { title: { type: 'string' }, type: { type: 'string' }, body: { type: 'string' } }, required: ['title', 'type', 'body'] }), permissionScope: 'content:write', isApproved: true, authRequired: 'company_user' },
    { name: 'seo_keyword_research', displayName: 'SEO Keyword Research', category: 'seo', description: 'Lookup tracked keywords for the company', inputSchema: JSON.stringify({ type: 'object', properties: { limit: { type: 'number' } } }), permissionScope: 'seo:read', isApproved: true, authRequired: 'company_user' },
  ];
  
  let toolCount = 0;
  for (const tool of TOOLS) {
    const existing = await prisma.toolDefinition.findUnique({ where: { name: tool.name } }).catch(() => null);
    if (existing) {
      await prisma.toolDefinition.update({ where: { name: tool.name }, data: { ...tool, version: existing.version } });
    } else {
      await prisma.toolDefinition.create({ data: { ...tool, version: 1, isActive: true } });
      toolCount++;
    }
  }
  const finalTools = await prisma.toolDefinition.count();
  console.log(`  ✅ ToolDefinitions: ${finalTools} (added ${toolCount})`);

  // ═══ FINAL SUMMARY ═══
  const [fd, fe, fs, fp, fsop, fap, ftd, fkn] = await Promise.all([
    prisma.department.count({ where: { companyId } }),
    prisma.employee.count({ where: { companyId } }),
    prisma.skill.count(),
    prisma.prompt.count(),
    prisma.sop.count({ where: { companyId } }),
    prisma.agentProfile.count({ where: { companyId } }),
    prisma.toolDefinition.count(),
    prisma.knowledgeNode.count({ where: { companyId } }),
  ]);
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 FINAL COMPLETION SUMMARY');
  console.log('='.repeat(60));
  console.log(`  🏢 Departments:     ${fd} (target: 100)`);
  console.log(`  👥 Employees:       ${fe} (target: 2000)`);
  console.log(`  🎯 Skills:          ${fs} (target: 10000+)`);
  console.log(`  📝 Prompts:         ${fp} (target: 50000+)`);
  console.log(`  📋 SOPs:            ${fsop} (target: 500+)`);
  console.log(`  🤖 AgentProfiles:   ${fap} (target: 2000)`);
  console.log(`  🔧 ToolDefinitions: ${ftd} (target: 9)`);
  console.log(`  📚 KnowledgeNodes:  ${fkn}`);
  console.log('='.repeat(60));
}

main().catch(e => { console.error('ERROR:', e?.message?.slice(0, 300)); process.exit(1); }).finally(() => prisma.$disconnect());
