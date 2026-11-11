import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

(async () => {
  const company = await p.company.findFirst({ where: { slug: 'demo-agency' } });
  if (!company) { console.log('No company'); process.exit(1); }
  
  const [d, e, s, pr, sop, ap, td, kn] = await Promise.all([
    p.department.count({ where: { companyId: company.id } }),
    p.employee.count({ where: { companyId: company.id } }),
    p.skill.count(),
    p.prompt.count(),
    p.sop.count(),
    p.agentProfile.count({ where: { companyId: company.id } }),
    p.toolDefinition.count(),
    p.knowledgeNode.count({ where: { companyId: company.id } }),
  ]);
  
  console.log('Company:', company.name, '(', company.id, ')');
  console.log('Departments:', d);
  console.log('Employees:', e);
  console.log('Skills:', s);
  console.log('Prompts:', pr);
  console.log('SOPs:', sop);
  console.log('AgentProfiles:', ap);
  console.log('ToolDefinitions:', td);
  console.log('KnowledgeNodes:', kn);
})().catch(e => console.error(e?.message?.slice(0,200))).finally(() => p.$disconnect());
