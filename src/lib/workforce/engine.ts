// ============================================================================
// AI WORKFORCE ENGINE — Core Orchestration System for 2,000 AI Employees
// MarketingOS — The single most critical module in the system
// ============================================================================

import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { generateChatCompletion, getAiProviderConfig } from '@/lib/ai-provider';

// ============================================================================
// TYPES
// ============================================================================

export interface EmployeeWithRelations {
  id: string;
  employeeId: string;
  name: string;
  title: string;
  level: string;
  status: string;
  avatar: string | null;
  mission: string;
  constitution: string | null;
  authority: string;
  permissions: string;
  departmentId: string;
  department: {
    id: string;
    name: string;
    code: string;
    description: string | null;
    parentId: string | null;
    level: number;
    icon: string | null;
    color: string | null;
  };
  reportsToId: string | null;
  reportsTo: {
    id: string;
    employeeId: string;
    name: string;
    title: string;
  } | null;
  skills: string;
  capabilities: string;
  tools: string;
  preferredModel: string | null;
  modelTier: string;
  modelConfig: string;
  kpis: string;
  currentKpis: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  successRate: number;
  avgLatencyMs: number;
  lastActiveAt: Date | null;
  canDelegate: boolean;
  canConsult: boolean;
  canReview: boolean;
  canEscalate: boolean;
  collaborationRules: string;
  escalationRules: string;
  escalationPath: string;
  isEnabled: boolean;
  isAvailable: boolean;
  companyId: string;
}

export interface KnowledgeNodeResult {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  nodeType: string;
  tags: string[];
  category: string | null;
  departmentId: string | null;
  accessLevel: string;
  relevanceScore: number;
}

export interface MemoryResult {
  id: string;
  memoryType: string;
  category: string | null;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  relevance: number;
  accessCount: number;
  lastAccessedAt: Date | null;
}

export interface SopResult {
  id: string;
  name: string;
  description: string | null;
  version: number;
  category: string;
  steps: SopStep[];
  preconditions: unknown[];
  applicableRoles: string[];
  applicableTasks: string[];
}

export interface SopStep {
  order: number;
  title: string;
  description: string;
  decisionPoints: Array<{ condition: string; ifTrue: string; ifFalse: string }>;
  validations: Array<{ type: string; criteria: string }>;
}

export interface ModelConfigResult {
  id: string;
  name: string;
  provider: string;
  tier: string;
  capabilities: string[];
  maxTokens: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  avgLatencyMs: number;
  qualityScore: number;
  isFallback: boolean;
  config: Record<string, unknown>;
}

export interface RouteTaskInput {
  title: string;
  description: string;
  type: string;
  complexity?: string;
  companyId: string;
  userId: string;
}

export interface RouteTaskOutput {
  executionId: string;
  taskId: string;
  status: string;
  result: string;
  employeeName: string;
  employeeId: string;
  departmentName: string;
  modelUsed: string;
  modelTier: string;
  latencyMs: number;
  skillsUsed: string[];
  sopsUsed: string[];
  knowledgeUsed: string[];
  memoryUsed: string[];
}

export interface ConversationMessage {
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp?: string;
}

export interface EmployeeStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  successRate: number;
  avgLatencyMs: number;
  totalConversations: number;
  totalMemories: number;
  lastActiveAt: Date | null;
  recentExecutions: Array<{
    id: string;
    title: string;
    status: string;
    modelUsed: string | null;
    latencyMs: number;
    completedAt: Date | null;
  }>;
}

export interface DepartmentTreeNode {
  id: string;
  name: string;
  code: string;
  description: string | null;
  level: number;
  icon: string | null;
  color: string | null;
  employeeCount: number;
  children: DepartmentTreeNode[];
}

// ============================================================================
// HELPER — Safe JSON parse
// ============================================================================

function safeJsonParse<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

// ============================================================================
// 1. AGENT REGISTRY
// ============================================================================

export async function getEmployee(
  employeeId: string
): Promise<EmployeeWithRelations | null> {
  try {
    const employee = await db.employee.findUnique({
      where: { employeeId },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            description: true,
            parentId: true,
            level: true,
            icon: true,
            color: true,
          },
        },
        reportsTo: {
          select: {
            id: true,
            employeeId: true,
            name: true,
            title: true,
          },
        },
      },
    });
    return employee as EmployeeWithRelations | null;
  } catch (error) {
    console.error('[AgentRegistry.getEmployee] Error:', error);
    return null;
  }
}

export async function getEmployeeById(
  id: string
): Promise<EmployeeWithRelations | null> {
  try {
    const employee = await db.employee.findUnique({
      where: { id },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            description: true,
            parentId: true,
            level: true,
            icon: true,
            color: true,
          },
        },
        reportsTo: {
          select: {
            id: true,
            employeeId: true,
            name: true,
            title: true,
          },
        },
      },
    });
    return employee as EmployeeWithRelations | null;
  } catch (error) {
    console.error('[AgentRegistry.getEmployeeById] Error:', error);
    return null;
  }
}

export async function findBestAgent(
  taskType: string,
  complexity: string,
  companyId: string
): Promise<EmployeeWithRelations | null> {
  try {
    // Fetch all enabled & available employees in this company with their department
    const employees = await db.employee.findMany({
      where: {
        companyId,
        isEnabled: true,
        isAvailable: true,
        status: { in: ['idle', 'working'] },
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            description: true,
            parentId: true,
            level: true,
            icon: true,
            color: true,
          },
        },
        reportsTo: {
          select: {
            id: true,
            employeeId: true,
            name: true,
            title: true,
          },
        },
      },
    });

    if (employees.length === 0) return null;

    // Score each employee for this task
    const scored = employees.map((emp) => {
      const capabilities = safeJsonParse<string[]>(emp.capabilities, []);
      const skills = safeJsonParse<string[]>(emp.skills, []);

      let score = 0;

      // --- Capability matching (highest weight) ---
      const taskKeywords = taskType
        .toLowerCase()
        .split(/[_\s-]+/)
        .filter((k) => k.length > 2);

      const allCapabilities = [...capabilities, ...skills].map((c) =>
        c.toLowerCase()
      );

      for (const keyword of taskKeywords) {
        for (const cap of allCapabilities) {
          if (cap.includes(keyword) || keyword.includes(cap)) {
            score += 30;
          }
        }
      }

      // --- Department relevance ---
      const deptCode = (emp.department?.code || '').toLowerCase();
      const deptName = (emp.department?.name || '').toLowerCase();
      for (const keyword of taskKeywords) {
        if (
          deptCode.includes(keyword) ||
          deptName.includes(keyword) ||
          keyword.includes(deptCode) ||
          keyword.includes(deptName)
        ) {
          score += 20;
        }
      }

      // --- Title relevance ---
      const titleLower = emp.title.toLowerCase();
      for (const keyword of taskKeywords) {
        if (titleLower.includes(keyword)) {
          score += 15;
        }
      }

      // --- Level / complexity match ---
      const levelHierarchy: Record<string, number> = {
        worker: 10,
        specialist: 20,
        supervisor: 30,
        manager: 40,
        director: 50,
        executive: 60,
      };
      const complexityRequirement: Record<string, number> = {
        simple: 10,
        standard: 20,
        complex: 35,
        enterprise: 50,
      };
      const empLevel = levelHierarchy[emp.level] || 20;
      const required = complexityRequirement[complexity] || 20;
      // Prefer employees whose level >= requirement, penalize overkill
      if (empLevel >= required) {
        score += 10;
      } else {
        score -= 15;
      }

      // --- Performance bonus ---
      if (emp.successRate > 0) {
        score += emp.successRate * 0.2;
      }

      // --- Availability bonus (idle > working) ---
      if (emp.status === 'idle') {
        score += 5;
      }

      // --- Latency penalty ---
      if (emp.avgLatencyMs > 10000) {
        score -= 5;
      }

      return { employee: emp, score };
    });

    // Sort descending by score, return best
    scored.sort((a, b) => b.score - a.score);

    if (scored.length === 0 || scored[0].score < 0) {
      // Fallback: return any available employee
      return employees[0] as EmployeeWithRelations | null;
    }

    return scored[0].employee as EmployeeWithRelations;
  } catch (error) {
    console.error('[AgentRegistry.findBestAgent] Error:', error);
    return null;
  }
}

export async function getDepartmentEmployees(
  departmentCode: string
): Promise<EmployeeWithRelations[]> {
  try {
    const department = await db.department.findUnique({
      where: { code: departmentCode },
    });
    if (!department) return [];

    // Get all sub-department IDs recursively
    const allDeptIds = await collectDepartmentIds(department.id);

    const employees = await db.employee.findMany({
      where: {
        departmentId: { in: allDeptIds },
        isEnabled: true,
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            code: true,
            description: true,
            parentId: true,
            level: true,
            icon: true,
            color: true,
          },
        },
        reportsTo: {
          select: {
            id: true,
            employeeId: true,
            name: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return employees as EmployeeWithRelations[];
  } catch (error) {
    console.error('[AgentRegistry.getDepartmentEmployees] Error:', error);
    return [];
  }
}

export async function getDepartmentTree(
  companyId: string
): Promise<DepartmentTreeNode[]> {
  try {
    const departments = await db.department.findMany({
      where: { companyId, parentId: null },
      include: {
        children: {
          include: {
            children: {
              include: {
                children: {
                  include: {
                    _count: { select: { employees: true } },
                  },
                },
                _count: { select: { employees: true } },
              },
            },
            _count: { select: { employees: true } },
          },
        },
        _count: { select: { employees: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });

    function buildNode(
      dept: any
    ): DepartmentTreeNode {
      const childNodes = (dept.children || []).map((child: any) =>
        buildNode(child)
      );
      return {
        id: dept.id,
        name: dept.name,
        code: dept.code,
        description: dept.description,
        level: dept.level,
        icon: dept.icon,
        color: dept.color,
        employeeCount: dept._count.employees,
        children: childNodes,
      };
    }

    return departments.map((d) => buildNode(d));
  } catch (error) {
    console.error('[AgentRegistry.getDepartmentTree] Error:', error);
    return [];
  }
}

export async function getEmployeeStats(
  employeeId: string
): Promise<EmployeeStats | null> {
  try {
    const emp = await db.employee.findUnique({
      where: { employeeId },
      select: {
        totalTasks: true,
        completedTasks: true,
        failedTasks: true,
        successRate: true,
        avgLatencyMs: true,
        lastActiveAt: true,
        id: true,
      },
    });
    if (!emp) return null;

    const [conversationCount, memoryCount, recentExecutions] = await Promise.all([
      db.workforceConversation.count({
        where: { employeeId: emp.id },
      }),
      db.employeeMemory.count({
        where: { employeeId: emp.id },
      }),
      db.taskExecution.findMany({
        where: { assignedEmployeeId: emp.id },
        select: {
          id: true,
          title: true,
          status: true,
          modelUsed: true,
          latencyMs: true,
          completedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      totalTasks: emp.totalTasks,
      completedTasks: emp.completedTasks,
      failedTasks: emp.failedTasks,
      successRate: emp.successRate,
      avgLatencyMs: emp.avgLatencyMs,
      totalConversations: conversationCount,
      totalMemories: memoryCount,
      lastActiveAt: emp.lastActiveAt,
      recentExecutions: recentExecutions.map((e) => ({
        id: e.id,
        title: e.title,
        status: e.status,
        modelUsed: e.modelUsed,
        latencyMs: e.latencyMs,
        completedAt: e.completedAt,
      })),
    };
  } catch (error) {
    console.error('[AgentRegistry.getEmployeeStats] Error:', error);
    return null;
  }
}

// Helper: recursively collect department IDs (self + all children)
async function collectDepartmentIds(departmentId: string): Promise<string[]> {
  const ids: string[] = [departmentId];
  const children = await db.department.findMany({
    where: { parentId: departmentId },
    select: { id: true },
  });
  for (const child of children) {
    const childIds = await collectDepartmentIds(child.id);
    ids.push(...childIds);
  }
  return ids;
}

// ============================================================================
// 2. MODEL ROUTER
// ============================================================================

const COMPLEXITY_TO_TIER: Record<string, string> = {
  simple: 'fast',
  standard: 'balanced',
  complex: 'reasoning',
  enterprise: 'reasoning',
  coding: 'coding',
  vision: 'vision',
};

export async function selectModel(
  tier: string,
  capabilities: string[] = []
): Promise<ModelConfigResult | null> {
  try {
    const models = await db.modelConfig.findMany({
      where: {
        tier,
        isEnabled: true,
        isFallback: false,
      },
      orderBy: [
        { qualityScore: 'desc' },
        { sortOrder: 'asc' },
      ],
    });

    if (models.length === 0) {
      // Fallback to any enabled model
      const anyModel = await db.modelConfig.findFirst({
        where: { isEnabled: true },
        orderBy: { qualityScore: 'desc' },
      });
      if (!anyModel) return null;
      return mapModelConfig(anyModel);
    }

    // If specific capabilities needed, try to find a model with those capabilities
    if (capabilities.length > 0) {
      for (const model of models) {
        const modelCaps = safeJsonParse<string[]>(model.capabilities, []);
        const hasAll = capabilities.every((c) =>
      modelCaps.some((mc) => mc.toLowerCase().includes(c.toLowerCase()))
        );
        if (hasAll) return mapModelConfig(model);
      }
    }

    return mapModelConfig(models[0]);
  } catch (error) {
    console.error('[ModelRouter.selectModel] Error:', error);
    return null;
  }
}

export async function getModelConfig(
  modelName: string
): Promise<ModelConfigResult | null> {
  try {
    const model = await db.modelConfig.findFirst({
      where: { name: modelName },
    });
    if (!model) return null;
    return mapModelConfig(model);
  } catch (error) {
    console.error('[ModelRouter.getModelConfig] Error:', error);
    return null;
  }
}

export async function getModelsByTier(
  tier: string
): Promise<ModelConfigResult[]> {
  try {
    const models = await db.modelConfig.findMany({
      where: { tier, isEnabled: true },
      orderBy: [{ qualityScore: 'desc' }, { sortOrder: 'asc' }],
    });
    return models.map(mapModelConfig);
  } catch (error) {
    console.error('[ModelRouter.getModelsByTier] Error:', error);
    return [];
  }
}

export function resolveTier(complexity: string): string {
  return COMPLEXITY_TO_TIER[complexity] || 'balanced';
}

function mapModelConfig(model: any): ModelConfigResult {
  return {
    id: model.id,
    name: model.name,
    provider: model.provider,
    tier: model.tier,
    capabilities: safeJsonParse<string[]>(model.capabilities, []),
    maxTokens: model.maxTokens,
    costPer1kInput: model.costPer1kInput,
    costPer1kOutput: model.costPer1kOutput,
    avgLatencyMs: model.avgLatencyMs,
    qualityScore: model.qualityScore,
    isFallback: model.isFallback,
    config: safeJsonParse<Record<string, unknown>>(model.config, {}),
  };
}

// ============================================================================
// 3. KNOWLEDGE MANAGER
// ============================================================================

export async function retrieveKnowledge(
  query: string,
  departmentId?: string,
  accessRoles?: string[],
  limit: number = 5
): Promise<KnowledgeNodeResult[]> {
  try {
    const queryLower = query.toLowerCase();
    const queryKeywords = queryLower
      .split(/[^a-z0-9]+/)
      .filter((k) => k.length > 2);

    // Build the base where clause
    const where: Record<string, unknown> = { companyId: { not: '' } };

    if (departmentId) {
      where.OR = [
        { departmentId },
        { accessLevel: 'public' },
        { accessLevel: 'company' },
      ];
    } else {
      where.OR = [
        { accessLevel: 'public' },
        { accessLevel: 'company' },
      ];
    }

    // Fetch all candidate knowledge nodes
    const candidates = await db.knowledgeNode.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
      take: 50, // Limit candidates for scoring
    });

    // Score each candidate via tag/title/summary/keyword matching
    const scored = candidates.map((node) => {
      const tags = safeJsonParse<string[]>(node.tags, []);
      const titleLower = (node.title || '').toLowerCase();
      const summaryLower = (node.summary || '').toLowerCase();
      const contentLower = (node.content || '').toLowerCase();
      const tagLower = tags.map((t) => t.toLowerCase());

      let score = 0;

      // Exact tag match is highest value
      for (const keyword of queryKeywords) {
        for (const tag of tagLower) {
          if (tag === keyword) score += 10;
          else if (tag.includes(keyword) || keyword.includes(tag)) score += 5;
        }
        // Title match
        if (titleLower.includes(keyword)) score += 4;
        // Summary match
        if (summaryLower.includes(keyword)) score += 2;
        // Content match (lower weight to avoid noise)
        if (contentLower.includes(keyword)) score += 1;
      }

      // Access control bonus: department match
      if (departmentId && node.departmentId === departmentId) {
        score += 3;
      }

      // Quality bonus
      if (node.rating > 0) {
        score += node.rating * 0.5;
      }

      // Access role check
      if (accessRoles && accessRoles.length > 0 && node.accessRoles) {
        const nodeRoles = safeJsonParse<string[]>(node.accessRoles, []);
        const hasRole = accessRoles.some((r) => nodeRoles.includes(r));
        if (node.accessLevel === 'role' && !hasRole) {
          score = -1; // Exclude
        }
      }

      return { node, score };
    });

    // Filter out excluded and sort
    scored.sort((a, b) => b.score - a.score);

    return scored
      .filter((s) => s.score > 0)
      .slice(0, limit)
      .map((s) => ({
        id: s.node.id,
        title: s.node.title,
        content: s.node.content,
        summary: s.node.summary,
        nodeType: s.node.nodeType,
        tags: safeJsonParse<string[]>(s.node.tags, []),
        category: s.node.category,
        departmentId: s.node.departmentId,
        accessLevel: s.node.accessLevel,
        relevanceScore: s.score,
      }));
  } catch (error) {
    console.error('[KnowledgeManager.retrieveKnowledge] Error:', error);
    return [];
  }
}

export async function addKnowledge(
  data: {
    title: string;
    content: string;
    summary?: string;
    nodeType?: string;
    tags?: string[];
    category?: string;
    departmentId?: string;
    accessLevel?: string;
    accessRoles?: string[];
    sourceUrl?: string;
    sourceType?: string;
    companyId: string;
  },
  companyId: string
): Promise<string | null> {
  try {
    const node = await db.knowledgeNode.create({
      data: {
        title: data.title,
        content: data.content,
        summary: data.summary || null,
        nodeType: data.nodeType || 'document',
        tags: JSON.stringify(data.tags || []),
        category: data.category || null,
        departmentId: data.departmentId || null,
        accessLevel: data.accessLevel || 'company',
        accessRoles: JSON.stringify(data.accessRoles || []),
        sourceUrl: data.sourceUrl || null,
        sourceType: data.sourceType || null,
        companyId: data.companyId || companyId,
      },
    });
    return node.id;
  } catch (error) {
    console.error('[KnowledgeManager.addKnowledge] Error:', error);
    return null;
  }
}

// ============================================================================
// 4. MEMORY MANAGER
// ============================================================================

export async function getMemories(
  employeeId: string,
  type?: string,
  limit: number = 20
): Promise<MemoryResult[]> {
  try {
    const emp = await db.employee.findUnique({
      where: { employeeId },
      select: { id: true },
    });
    if (!emp) return [];

    const where: Record<string, unknown> = { employeeId: emp.id };
    if (type) {
      where.memoryType = type;
    }

    const memories = await db.employeeMemory.findMany({
      where,
      orderBy: [{ relevance: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
    });

    return memories.map((m) => ({
      id: m.id,
      memoryType: m.memoryType,
      category: m.category,
      title: m.title,
      content: m.content,
      metadata: safeJsonParse<Record<string, unknown>>(m.metadata, {}),
      relevance: m.relevance,
      accessCount: m.accessCount,
      lastAccessedAt: m.lastAccessedAt,
    }));
  } catch (error) {
    console.error('[MemoryManager.getMemories] Error:', error);
    return [];
  }
}

export async function addMemory(
  employeeId: string,
  memory: {
    memoryType: string;
    title: string;
    content: string;
    category?: string;
    metadata?: Record<string, unknown>;
    relevance?: number;
    sourceType?: string;
    sourceId?: string;
  },
  companyId?: string
): Promise<string | null> {
  try {
    const emp = await db.employee.findUnique({
      where: { employeeId },
      select: { id: true, companyId: true },
    });
    if (!emp) return null;

    const mem = await db.employeeMemory.create({
      data: {
        employeeId: emp.id,
        memoryType: memory.memoryType,
        title: memory.title,
        content: memory.content,
        category: memory.category || null,
        metadata: JSON.stringify(memory.metadata || {}),
        relevance: memory.relevance ?? 1.0,
        sourceType: memory.sourceType || null,
        sourceId: memory.sourceId || null,
        companyId: companyId || emp.companyId,
      },
    });
    return mem.id;
  } catch (error) {
    console.error('[MemoryManager.addMemory] Error:', error);
    return null;
  }
}

export async function getWorkingMemory(
  employeeId: string
): Promise<MemoryResult | null> {
  try {
    const emp = await db.employee.findUnique({
      where: { employeeId },
      select: { id: true },
    });
    if (!emp) return null;

    const mem = await db.employeeMemory.findFirst({
      where: {
        employeeId: emp.id,
        memoryType: 'working',
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (!mem) return null;

    // Update access count
    await db.employeeMemory.update({
      where: { id: mem.id },
      data: {
        accessCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    });

    return {
      id: mem.id,
      memoryType: mem.memoryType,
      category: mem.category,
      title: mem.title,
      content: mem.content,
      metadata: safeJsonParse<Record<string, unknown>>(mem.metadata, {}),
      relevance: mem.relevance,
      accessCount: mem.accessCount + 1,
      lastAccessedAt: new Date(),
    };
  } catch (error) {
    console.error('[MemoryManager.getWorkingMemory] Error:', error);
    return null;
  }
}

export async function getRelevantMemories(
  employeeId: string,
  taskContext: string
): Promise<MemoryResult[]> {
  try {
    const emp = await db.employee.findUnique({
      where: { employeeId },
      select: { id: true },
    });
    if (!emp) return [];

    // Get all non-expired memories for this employee
    const now = new Date();
    const memories = await db.employeeMemory.findMany({
      where: {
        employeeId: emp.id,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } },
        ],
      },
      orderBy: { relevance: 'desc' },
      take: 30,
    });

    if (memories.length === 0) return [];

    // Score relevance using keyword matching
    const contextKeywords = taskContext
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((k) => k.length > 2);

    const scored = memories.map((mem) => {
      const titleLower = (mem.title || '').toLowerCase();
      const contentLower = (mem.content || '').toLowerCase();
      let score = mem.relevance; // Base relevance

      for (const keyword of contextKeywords) {
        if (titleLower.includes(keyword)) score += 3;
        if (contentLower.includes(keyword)) score += 1;
      }

      // Prioritize episodic and procedural memories for task execution
      if (mem.memoryType === 'episodic') score += 0.5;
      if (mem.memoryType === 'procedural') score += 0.3;

      return { mem, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const topMemories = scored.slice(0, 5);

    // Update access counts for retrieved memories
    for (const item of topMemories) {
      await db.employeeMemory.update({
        where: { id: item.mem.id },
        data: {
          accessCount: { increment: 1 },
          lastAccessedAt: new Date(),
        },
      });
    }

    return topMemories.map((item) => ({
      id: item.mem.id,
      memoryType: item.mem.memoryType,
      category: item.mem.category,
      title: item.mem.title,
      content: item.mem.content,
      metadata: safeJsonParse<Record<string, unknown>>(item.mem.metadata, {}),
      relevance: item.score,
      accessCount: item.mem.accessCount + 1,
      lastAccessedAt: new Date(),
    }));
  } catch (error) {
    console.error('[MemoryManager.getRelevantMemories] Error:', error);
    return [];
  }
}

// ============================================================================
// 5. SOP ENGINE
// ============================================================================

export async function findApplicableSops(
  taskType: string,
  employeeLevel: string,
  departmentId?: string
): Promise<SopResult[]> {
  try {
    const where: Record<string, unknown> = { isActive: true };

    if (departmentId) {
      where.OR = [
        { departmentId },
        { departmentId: null },
      ];
    }

    const sops = await db.sop.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
      take: 30,
    });

    // Score and filter applicable SOPs
    const taskTypeLower = taskType.toLowerCase();
    const scored = sops.map((sop) => {
      const applicableTasks = safeJsonParse<string[]>(
        sop.applicableTasks,
        []
      );
      const applicableRoles = safeJsonParse<string[]>(
        sop.applicableRoles,
        []
      );
      const triggerConditions = safeJsonParse<string[]>(
        sop.triggerConditions,
        []
      );
      const sopCategory = (sop.category || '').toLowerCase();

      let score = 0;
      let isApplicable = false;

      // Check if task type matches applicable tasks
      for (const at of applicableTasks) {
        if (
          taskTypeLower.includes(at.toLowerCase()) ||
          at.toLowerCase().includes(taskTypeLower)
        ) {
          score += 10;
          isApplicable = true;
        }
      }

      // Check if category matches
      if (
        sopCategory.includes(taskTypeLower) ||
        taskTypeLower.includes(sopCategory)
      ) {
        score += 5;
        isApplicable = true;
      }

      // Check trigger conditions
      for (const tc of triggerConditions) {
        if (taskTypeLower.includes(tc.toLowerCase())) {
          score += 3;
          isApplicable = true;
        }
      }

      // Check role applicability
      if (applicableRoles.length > 0) {
        if (applicableRoles.includes(employeeLevel)) {
          score += 5;
        } else {
          // SOP doesn't apply to this level
          isApplicable = false;
        }
      } else {
        // No role restriction means it applies to all
        isApplicable = true;
      }

      // Department match bonus
      if (departmentId && sop.departmentId === departmentId) {
        score += 3;
      }

      return { sop, score, isApplicable };
    });

    return scored
      .filter((s) => s.isApplicable && s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((s) => ({
        id: s.sop.id,
        name: s.sop.name,
        description: s.sop.description,
        version: s.sop.version,
        category: s.sop.category,
        steps: safeJsonParse<SopStep[]>(s.sop.steps, []),
        preconditions: safeJsonParse<unknown[]>(s.sop.preconditions, []),
        applicableRoles: safeJsonParse<string[]>(s.sop.applicableRoles, []),
        applicableTasks: safeJsonParse<string[]>(s.sop.applicableTasks, []),
      }));
  } catch (error) {
    console.error('[SopEngine.findApplicableSops] Error:', error);
    return [];
  }
}

export async function executeSop(
  sopId: string,
  context: Record<string, unknown>
): Promise<SopResult | null> {
  try {
    const sop = await db.sop.findUnique({
      where: { id: sopId },
    });
    if (!sop) return null;

    // Update usage count
    await db.sop.update({
      where: { id: sopId },
      data: { usageCount: { increment: 1 } },
    });

    const steps = safeJsonParse<SopStep[]>(sop.steps, []);

    // Evaluate decision points in steps based on context
    const evaluatedSteps = steps.map((step) => {
      const evaluatedDecisionPoints = step.decisionPoints.map((dp) => {
        let conditionMet = false;
        try {
          // Simple evaluation: check if any context key/value matches the condition
          const conditionStr = dp.condition.toLowerCase();
          for (const [key, value] of Object.entries(context)) {
            if (
              conditionStr.includes(key.toLowerCase()) &&
              conditionStr.includes(String(value).toLowerCase())
            ) {
              conditionMet = true;
              break;
            }
          }
        } catch {
          // Default: condition not met
        }
        return {
          ...dp,
          evaluated: conditionMet,
          outcome: conditionMet ? dp.ifTrue : dp.ifFalse,
        };
      });
      return {
        ...step,
        decisionPoints: evaluatedDecisionPoints,
      };
    });

    return {
      id: sop.id,
      name: sop.name,
      description: sop.description,
      version: sop.version,
      category: sop.category,
      steps: evaluatedSteps,
      preconditions: safeJsonParse<unknown[]>(sop.preconditions, []),
      applicableRoles: safeJsonParse<string[]>(sop.applicableRoles, []),
      applicableTasks: safeJsonParse<string[]>(sop.applicableTasks, []),
    };
  } catch (error) {
    console.error('[SopEngine.executeSop] Error:', error);
    return null;
  }
}

// ============================================================================
// 6. ORCHESTRATOR
// ============================================================================

export async function classifyComplexity(
  title: string,
  description: string
): Promise<string> {
  try {
    const response = await generateChatCompletion([
      {
        role: 'system',
        content:
          'You are a task complexity classifier. Respond with ONLY one word: simple, standard, complex, or enterprise.\n\n' +
          '- simple: Quick factual lookups, single-step tasks, basic formatting\n' +
          '- standard: Multi-step tasks, moderate analysis, content creation, standard reports\n' +
          '- complex: Multi-agent coordination, deep analysis, strategy planning, multi-department tasks\n' +
          '- enterprise: Organizational strategy, cross-functional orchestration, executive decisions, large-scale campaigns',
      },
      { role: 'user', content: `Task: ${title}\nDescription: ${description}` },
    ], { temperature: 0 });
    const result = response.content.trim().toLowerCase();
    const validComplexities = ['simple', 'standard', 'complex', 'enterprise'];
    return validComplexities.includes(result) ? result : 'standard';
  } catch (error) {
    console.error('[Orchestrator.classifyComplexity] Error:', error);
    return 'standard';
  }
}

export async function routeTask(
  task: RouteTaskInput
): Promise<RouteTaskOutput> {
  const startTime = Date.now();
  const executionId = `EXEC-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  try {
    // 1. Classify complexity if not provided
    let complexity = task.complexity || 'standard';
    if (!task.complexity) {
      complexity = await classifyComplexity(task.title, task.description);
    }

    // 2. Select execution path based on complexity
    const executionPath =
      complexity === 'enterprise' ? 'enterprise' :
      complexity === 'complex' ? 'complex' :
      complexity === 'simple' ? 'fast' : 'standard';

    // 3. Find best agent
    const employee = await findBestAgent(
      task.type,
      complexity,
      task.companyId
    );

    if (!employee) {
      throw new Error('No suitable AI employee found for this task');
    }

    // 4. Select model via ModelRouter
    const tier = resolveTier(complexity);
    const modelConfig = await selectModel(tier);
    const modelName = getAiProviderConfig().model || 'local-model';

    // 5. Load employee context in parallel
    const [sops, knowledge, memories] = await Promise.all([
      findApplicableSops(task.type, employee.level, employee.departmentId),
      retrieveKnowledge(
        `${task.title} ${task.description}`,
        employee.departmentId,
        safeJsonParse<string[]>(employee.permissions, [])
      ),
      getRelevantMemories(employee.employeeId, `${task.title} ${task.description}`),
    ]);

    const skillsUsed = safeJsonParse<string[]>(employee.skills, []);
    const sopsUsed = sops.map((s) => s.name);
    const knowledgeUsed = knowledge.map((k) => k.title);
    const memoryUsed = memories.map((m) => `${m.memoryType}:${m.title}`);
    const memoryTypes = [...new Set(memories.map((m) => m.memoryType))];

    // 6. Build the employee prompt
    const systemPrompt = await buildEmployeePrompt(employee, {
      title: task.title,
      description: task.description,
      type: task.type,
      complexity,
    });

    // Inject loaded context into the prompt
    let contextSection = '';

    if (sops.length > 0) {
      contextSection += '\n\n## APPLICABLE STANDARD OPERATING PROCEDURES\n';
      for (const sop of sops) {
        contextSection += `### ${sop.name} (v${sop.version})\n`;
        if (sop.description) contextSection += `${sop.description}\n`;
        for (const step of sop.steps) {
          contextSection += `  Step ${step.order}: ${step.title} — ${step.description}\n`;
        }
      }
    }

    if (knowledge.length > 0) {
      contextSection += '\n\n## RELEVANT KNOWLEDGE\n';
      for (const kn of knowledge) {
        contextSection += `### ${kn.title}\n${kn.content}\n`;
      }
    }

    if (memories.length > 0) {
      contextSection += '\n\n## RELEVANT MEMORIES\n';
      for (const mem of memories) {
        contextSection += `- [${mem.memoryType}] ${mem.title}: ${mem.content}\n`;
      }
    }

    const fullSystemPrompt = systemPrompt + contextSection;

    // 7. Create TaskExecution record
    const execution = await db.taskExecution.create({
      data: {
        taskId: executionId,
        title: task.title,
        description: task.description,
        taskType: task.type,
        complexity,
        executionPath,
        assignedEmployeeId: employee.id,
        status: 'running',
        input: JSON.stringify({
          title: task.title,
          description: task.description,
          type: task.type,
          userId: task.userId,
        }),
        modelUsed: modelName,
        modelTier: tier,
        skillsUsed: JSON.stringify(skillsUsed),
        sopsUsed: JSON.stringify(sopsUsed),
        knowledgeUsed: JSON.stringify(knowledgeUsed),
        memoryUsed: JSON.stringify(memoryTypes),
        ragUsed: knowledge.length > 0,
        companyId: task.companyId,
        startedAt: new Date(),
      },
    });

    // 8. Execute via LLM
    const userMessage = `Please complete the following task:\n\n**Task:** ${task.title}\n**Description:** ${task.description}\n**Type:** ${task.type}\n**Complexity:** ${complexity}\n\nProvide a thorough, professional response based on your expertise and the provided context.`;

    const completion = await generateChatCompletion([
      { role: 'system', content: fullSystemPrompt },
      { role: 'user', content: userMessage },
    ]);
    const result = completion.content;
    const latencyMs = Date.now() - startTime;

    // 9. Update TaskExecution with results
    await db.taskExecution.update({
      where: { id: execution.id },
      data: {
        status: 'completed',
        output: JSON.stringify({ result }),
        latencyMs,
        completedAt: new Date(),
      },
    });

    // 10. Update employee performance stats
    await db.employee.update({
      where: { id: employee.id },
      data: {
        totalTasks: { increment: 1 },
        completedTasks: { increment: 1 },
        successRate: employee.totalTasks > 0
          ? ((employee.completedTasks + 1) / (employee.totalTasks + 1)) * 100
          : 100,
        avgLatencyMs: employee.avgLatencyMs > 0
          ? Math.round((employee.avgLatencyMs + latencyMs) / 2)
          : latencyMs,
        lastActiveAt: new Date(),
        status: 'idle',
      },
    });

    // 11. Store lesson learned in memory
    await addMemory(employee.employeeId, {
      memoryType: 'episodic',
      title: `Completed task: ${task.title}`,
      content: `Successfully executed ${task.type} task with complexity ${complexity} using ${modelName}. Latency: ${latencyMs}ms.`,
      category: 'task_execution',
      metadata: {
        taskId: executionId,
        taskType: task.type,
        complexity,
        modelUsed: modelName,
        latencyMs,
      },
      relevance: 0.7,
      sourceType: 'execution',
      sourceId: execution.id,
    }, task.companyId);

    return {
      executionId,
      taskId: execution.id,
      status: 'completed',
      result,
      employeeName: employee.name,
      employeeId: employee.employeeId,
      departmentName: employee.department.name,
      modelUsed: modelName,
      modelTier: tier,
      latencyMs,
      skillsUsed,
      sopsUsed,
      knowledgeUsed,
      memoryUsed,
    };
  } catch (error: unknown) {
    const latencyMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';

    // Try to update execution record if it was created
    try {
      const existingExecution = await db.taskExecution.findUnique({
        where: { taskId: executionId },
      });
      if (existingExecution) {
        await db.taskExecution.update({
          where: { id: existingExecution.id },
          data: {
            status: 'failed',
            output: JSON.stringify({ error: errorMessage }),
            latencyMs,
            completedAt: new Date(),
          },
        });
      }
    } catch {
      // Swallow update error
    }

    // Re-throw for caller to handle
    throw error;
  }
}

export async function executeWithEmployee(
  employeeId: string,
  message: string,
  conversationId?: string,
  companyId?: string
): Promise<{
  response: string;
  conversationId: string;
  employeeName: string;
  employeeTitle: string;
}> {
  try {
    // 1. Get employee
    const employee = await getEmployee(employeeId);
    if (!employee) {
      throw new Error(`Employee ${employeeId} not found`);
    }

    // 2. Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await db.workforceConversation.findUnique({
        where: { id: conversationId },
      });
    }

    if (!conversation) {
      // Need a userId - use a system user or the first company user
      const companyUser = companyId
        ? await db.companyUser.findFirst({
            where: { companyId },
            select: { userId: true },
          })
        : null;

      conversation = await db.workforceConversation.create({
        data: {
          employeeId: employee.id,
          userId: companyUser?.userId || 'system',
          companyId: companyId || employee.companyId,
        },
      });
    }

    // 3. Load conversation history
    const existingMessages = safeJsonParse<ConversationMessage[]>(
      conversation.messages,
      []
    );

    // 4. Load relevant context
    const [knowledge, memories] = await Promise.all([
      retrieveKnowledge(message, employee.departmentId, undefined, 3),
      getRelevantMemories(employee.employeeId, message),
    ]);

    // 5. Build system prompt with employee identity
    const systemPrompt = await buildEmployeePrompt(employee, undefined, {
      messages: existingMessages,
    });

    // Add context
    let contextSection = '';
    if (knowledge.length > 0) {
      contextSection += '\n\n## RELEVANT KNOWLEDGE\n';
      for (const kn of knowledge) {
        contextSection += `### ${kn.title}\n${kn.content}\n`;
      }
    }
    if (memories.length > 0) {
      contextSection += '\n\n## YOUR MEMORIES\n';
      for (const mem of memories) {
        contextSection += `- [${mem.memoryType}] ${mem.title}: ${mem.content}\n`;
      }
    }

    const fullSystemPrompt = systemPrompt + contextSection;

    // 6. Build messages array
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: fullSystemPrompt },
    ];

    // Add conversation history (last 10 messages)
 const recentHistory = existingMessages.slice(-10);
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'agent') {
        messages.push({
          role: msg.role === 'agent' ? 'assistant' : 'user',
          content: msg.content,
        });
      }
    }

    // Add current user message
    messages.push({ role: 'user', content: message });

    // 7. Select model
    // The actual inference model is the configured local/private model.
    const modelName = getAiProviderConfig().model || 'local-model';

    // 8. Execute via the self-hosted AI gateway
    const completion = await generateChatCompletion(messages);
    const aiResponse = completion.content;

    // 9. Update conversation with new messages
    const updatedMessages: ConversationMessage[] = [
      ...existingMessages,
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      {
        role: 'agent',
        content: aiResponse,
        timestamp: new Date().toISOString(),
      },
    ];

    await db.workforceConversation.update({
      where: { id: conversation.id },
      data: {
        messages: JSON.stringify(updatedMessages),
        messageCount: updatedMessages.length,
        knowledgeLoaded: JSON.stringify(knowledge.map((k) => k.id)),
        memoryAccessed: JSON.stringify(memories.map((m) => m.id)),
        updatedAt: new Date(),
      },
    });

    // 10. Update employee last active
    await db.employee.update({
      where: { id: employee.id },
      data: { lastActiveAt: new Date() },
    });

    return {
      response: aiResponse,
      conversationId: conversation.id,
      employeeName: employee.name,
      employeeTitle: employee.title,
    };
  } catch (error) {
    console.error('[Orchestrator.executeWithEmployee] Error:', error);
    throw error;
  }
}

// ============================================================================
// 7. BUILD EMPLOYEE PROMPT — THE MOST IMPORTANT FUNCTION
// ============================================================================

// Department-specific prompt fragments that make each employee unique
const DEPARTMENT_PROMPTS: Record<string, (deptName: string, empTitle: string, empLevel: string) => string> = {
  MKT: (deptName, empTitle, empLevel) => `
You are part of the **${deptName}** department. Your operational domain includes:
- Brand strategy, positioning, and messaging frameworks
- Multi-channel campaign planning and execution (social, email, content, paid media)
- Audience segmentation, persona development, and targeting strategies
- Content marketing, SEO/SEM, and organic growth tactics
- Marketing analytics, attribution modeling, and ROI optimization
- Competitive intelligence and market research
- Customer journey mapping and conversion funnel optimization
- Marketing technology stack evaluation and integration

As a ${empTitle} at the ${empLevel} level, you apply data-driven marketing methodologies and stay current with industry trends. You understand that great marketing balances creativity with measurable business outcomes. You think in terms of campaigns, funnels, A/B tests, and customer lifetime value.`,

  FIN: (deptName, empTitle, empLevel) => `
You are part of the **${deptName}** department. Your operational domain includes:
- Financial planning, budgeting, forecasting, and variance analysis
- Revenue recognition, cost management, and profitability analysis
- Financial reporting, regulatory compliance, and audit preparation
- Cash flow management, working capital optimization
- Investment analysis, capital allocation decisions
- Risk assessment and financial modeling
- Tax planning and compliance strategies
- Financial KPIs: EBITDA, gross margin, operating ratio, ROAS, LTV/CAC

As a ${empTitle} at the ${empLevel} level, you approach every situation with financial rigor. You think in terms of P&L impact, cost-benefit analysis, and financial risk. You ensure all marketing activities demonstrate clear ROI and align with financial targets.`,

  ENG: (deptName, empTitle, empLevel) => `
You are part of the **${deptName}** department. Your operational domain includes:
- Software architecture, system design, and technical planning
- Code quality, testing strategies, and engineering best practices
- DevOps, CI/CD, infrastructure, and deployment automation
- Performance optimization, scalability, and reliability engineering
- Technical documentation and knowledge management
- API design, integration patterns, and data pipeline architecture
- Security best practices and code review
- Technology evaluation and selection

As a ${empTitle} at the ${empLevel} level, you think in systems, algorithms, and trade-offs. You consider edge cases, performance implications, and maintainability. You write clean, well-documented solutions that scale.`,

  OPS: (deptName, empTitle, empLevel) => `
You are part of the **${deptName}** department. Your operational domain includes:
- Process design, optimization, and automation
- Project management, resource allocation, and timeline planning
- Quality assurance, compliance, and risk management
- Vendor management, procurement, and contract negotiations
- Operational metrics, SLAs, and KPI tracking
- Workflow automation and efficiency improvements
- Incident management and post-mortem analysis
- Cross-functional coordination and communication

As a ${empTitle} at the ${empLevel} level, you are process-oriented and detail-focused. You think in terms of workflows, bottlenecks, throughput, and operational excellence. You ensure smooth execution of all business operations.`,

  SAL: (deptName, empTitle, empLevel) => `
You are part of the **${deptName}** department. Your operational domain includes:
- Lead generation, prospecting, and pipeline management
- Sales process design, deal coaching, and closing strategies
- CRM management, sales forecasting, and quota planning
- Customer relationship building and account management
- Negotiation strategies and contract management
- Sales enablement, training, and methodology implementation
- Territory planning and account segmentation
- Revenue operations and sales analytics

As a ${empTitle} at the ${empLevel} level, you are results-driven and customer-focused. You think in terms of pipeline velocity, win rates, deal size, and customer success. You understand the full sales cycle from prospecting to close.`,

  HR: (deptName, empTitle, empLevel) => `
You are part of the **${deptName}** department. Your operational domain includes:
- Talent acquisition, recruitment, and onboarding
- Performance management, reviews, and professional development
- Employee engagement, retention, and satisfaction
- Compensation and benefits administration
- Organizational design and workforce planning
- Training and development program design
- HR compliance, labor law, and policy management
- Diversity, equity, and inclusion initiatives

As a ${empTitle} at the ${empLevel} level, you are people-focused and strategic. You think in terms of talent pipelines, engagement scores, retention metrics, and organizational health. You balance empathy with business needs.`,

  SUP: (deptName, empTitle, empLevel) => `
You are part of the **${deptName}** department. Your operational domain includes:
- Customer support ticket management and resolution
- Support escalation procedures and SLA management
- Knowledge base creation and maintenance
- Customer feedback analysis and satisfaction tracking
- Support team training and quality assurance
- Multi-channel support (email, chat, phone, social)
- Root cause analysis and process improvement
- Customer success and retention strategies

As a ${empTitle} at the ${empLevel} level, you are empathetic and solution-oriented. You think in terms of resolution time, customer satisfaction (CSAT), first response time, and deflection rates. You always prioritize the customer experience.`,

  CX: (deptName, empTitle, empLevel) => `
You are part of the **${deptName}** (Customer Experience) department. Your operational domain includes:
- User experience research, journey mapping, and persona development
- Customer feedback analysis, NPS tracking, and sentiment analysis
- Experience design, usability testing, and optimization
- Customer loyalty programs and retention strategies
- Voice of Customer (VoC) programs and insight generation
- Cross-functional experience improvement initiatives
- Digital experience optimization (website, app, email)
- Customer-centric culture and experience governance

As a ${empTitle} at the ${empLevel} level, you are the voice of the customer within the organization. You think in terms of NPS, CSAT, CES, customer effort, and emotional touchpoints. You advocate for seamless, delightful experiences at every interaction.`,

  PRD: (deptName, empTitle, empLevel) => `
You are part of the **${deptName}** (Product) department. Your operational domain includes:
- Product strategy, roadmap planning, and feature prioritization
- User story creation, requirements gathering, and specification writing
- Market research, competitive analysis, and product positioning
- Product analytics, feature usage, and user behavior analysis
- Agile methodology: sprints, backlogs, standups, retrospectives
- Cross-functional coordination with engineering, design, and marketing
- Product launch planning and go-to-market strategy
- Pricing strategy and packaging decisions

As a ${empTitle} at the ${empLevel} level, you are customer-obsessed and data-informed. You think in terms of user needs, market fit, feature adoption, and product-market fit. You balance user desires with business objectives.`,

  DAT: (deptName, empTitle, empLevel) => `
You are part of the **${deptName}** (Data & Analytics) department. Your operational domain includes:
- Data analysis, statistical modeling, and insights generation
- Business intelligence, dashboarding, and reporting
- Data pipeline design, ETL processes, and data warehousing
- A/B testing design, execution, and analysis
- Predictive modeling, machine learning, and AI integration
- Data governance, quality management, and compliance
- Marketing attribution and multi-touch analysis
- Data visualization and storytelling

As a ${empTitle} at the ${empLevel} level, you are analytical and evidence-driven. You think in terms of statistical significance, confidence intervals, correlations, and causal inference. You turn raw data into actionable business insights.`,

  CRE: (deptName, empTitle, empLevel) => `
You are part of the **${deptName}** (Creative) department. Your operational domain includes:
- Creative strategy development and concept ideation
- Copywriting: headlines, body copy, CTAs, email sequences
- Visual content direction and creative brief creation
- Brand voice, tone, and messaging guidelines
- Content format optimization for different channels
- Creative testing and performance analysis
- Storytelling and narrative development
- Campaign creative development and asset management

As a ${empTitle} at the ${empLevel} level, you are both creative and strategic. You think in terms of attention, engagement, emotional connection, and brand recall. You craft messages that resonate and drive action while maintaining brand consistency.`,

  EXE: (deptName, empTitle, empLevel) => `
You are part of the **${deptName}** (Executive) leadership. Your operational domain spans the entire organization:
- Strategic planning, vision setting, and organizational alignment
- Executive decision-making and priority management
- Board reporting, investor relations, and stakeholder management
- Organizational design and culture development
- M&A evaluation, partnerships, and business development
- Resource allocation and budget approval authority
- Crisis management and risk oversight
- Performance oversight across all departments

As a ${empTitle} at the ${empLevel} level, you think at the highest level of abstraction. You consider market dynamics, competitive landscape, organizational capabilities, and long-term strategy. You make decisions that impact the entire company. You communicate with clarity, authority, and vision.`,
};

// Default prompt for departments without specific configuration
function getDefaultDepartmentPrompt(
  deptName: string,
  deptCode: string,
  empTitle: string,
  empLevel: string
): string {
  return `
You are part of the **${deptName}** department (code: ${deptCode}). You specialize in this department's domain and bring expertise relevant to your role as ${empTitle}. You approach all tasks with the perspective and priorities that your department demands, applying best practices and domain knowledge specific to your area of responsibility. As a ${empLevel}-level employee, you operate with the appropriate scope of authority and decision-making for your position.`;
}

export async function buildEmployeePrompt(
  employee: EmployeeWithRelations,
  task?: {
    title: string;
    description: string;
    type: string;
    complexity: string;
  },
  conversation?: {
    messages: ConversationMessage[];
  }
): Promise<string> {
  // Parse all JSON fields
  const skills = safeJsonParse<string[]>(employee.skills, []);
  const capabilities = safeJsonParse<string[]>(employee.capabilities, []);
  const tools = safeJsonParse<string[]>(employee.tools, []);
  const kpis = safeJsonParse<Record<string, string>>(employee.kpis, {});
  const currentKpis = safeJsonParse<Record<string, unknown>>(employee.currentKpis, {});
  const authority = safeJsonParse<Record<string, unknown>>(employee.authority, {});
  const permissions = safeJsonParse<Record<string, unknown>>(employee.permissions, {});
  const collaborationRules = safeJsonParse<Record<string, unknown>>(
    employee.collaborationRules,
    {}
  );
  const escalationRules = safeJsonParse<unknown[]>(employee.escalationRules, []);
  const escalationPath = safeJsonParse<string[]>(employee.escalationPath, []);

  const dept = employee.department;
  const deptCode = dept.code.toUpperCase();

  // ---- SECTION 1: AGENT IDENTITY ----
  let prompt = `# AGENT IDENTITY
`;
  prompt += `**Name:** ${employee.name}
`;
  prompt += `**Title:** ${employee.title}
`;
  prompt += `**Employee ID:** ${employee.employeeId}
`;
  prompt += `**Department:** ${dept.name} (${dept.code})
`;
  prompt += `**Level:** ${employee.level}
`;
  if (employee.reportsTo) {
    prompt += `**Reports To:** ${employee.reportsTo.name} (${employee.reportsTo.title})\n`;
  }
  prompt += `\n`;

  // ---- SECTION 2: ROLE & DEPARTMENT PROMPT ----
  prompt += `# ROLE & DEPARTMENT\n`;
  const deptPromptFn = DEPARTMENT_PROMPTS[deptCode];
  if (deptPromptFn) {
    prompt += deptPromptFn(dept.name, employee.title, employee.level);
  } else {
    prompt += getDefaultDepartmentPrompt(
      dept.name,
      dept.code,
      employee.title,
      employee.level
    );
  }
  prompt += `\n`;

  // ---- SECTION 3: MISSION ----
  prompt += `# MISSION\n`;
  prompt += `${employee.mission}\n`;
  prompt += `\n`;

  // ---- SECTION 4: AUTHORITY ----
  if (Object.keys(authority).length > 0) {
    prompt += `# AUTHORITY\n`;
    prompt += `You have the following authorization boundaries:\n`;
    for (const [key, value] of Object.entries(authority)) {
      prompt += `- **${key}:** ${typeof value === 'boolean' ? (value ? 'Granted' : 'Denied') : String(value)}\n`;
    }
    prompt += `\n`;
  }

  // ---- SECTION 5: CONSTITUTION ----
  if (employee.constitution) {
    prompt += `# CONSTITUTION (Behavioral Rules)\n`;
    prompt += `${employee.constitution}\n`;
    prompt += `\n`;
  }

  // ---- SECTION 6: SKILLS ----
  if (skills.length > 0) {
    prompt += `# SKILLS\n`;
    prompt += `Your core competencies include:\n`;
    for (const skill of skills) {
      prompt += `- ${skill}\n`;
    }
    prompt += `\n`;
  }

  // ---- SECTION 7: CAPABILITIES ----
  if (capabilities.length > 0) {
    prompt += `# CAPABILITIES\n`;
    prompt += `You are capable of performing the following actions:\n`;
    for (const cap of capabilities) {
      prompt += `- ${cap}\n`;
    }
    prompt += `\n`;
  }

  // ---- SECTION 8: TOOLS ----
  if (tools.length > 0) {
    prompt += `# AVAILABLE TOOLS\n`;
    prompt += `You have access to the following tools and systems:\n`;
    for (const tool of tools) {
      prompt += `- ${tool}\n`;
    }
    prompt += `\n`;
  }

  // ---- SECTION 9: KPIs ----
  if (Object.keys(kpis).length > 0) {
    prompt += `# KEY PERFORMANCE INDICATORS\n`;
    prompt += `You are measured against these KPIs:\n`;
    for (const [key, description] of Object.entries(kpis)) {
      const currentValue = currentKpis[key];
      prompt += `- **${key}:** ${description}`;
      if (currentValue !== undefined) {
        prompt += ` (Current: ${String(currentValue)})`;
      }
      prompt += `\n`;
    }
    prompt += `\n`;
  }

  // ---- SECTION 10: PERMISSIONS ----
  if (Object.keys(permissions).length > 0) {
    prompt += `# PERMISSIONS\n`;
    prompt += `Your access permissions:\n`;
    for (const [key, value] of Object.entries(permissions)) {
      const permValue = typeof value === 'boolean'
        ? (value ? '✓ Allowed' : '✗ Denied')
        : String(value);
      prompt += `- **${key}:** ${permValue}\n`;
    }
    prompt += `\n`;
  }

  // ---- SECTION 11: COLLABORATION RULES ----
  if (Object.keys(collaborationRules).length > 0) {
    prompt += `# COLLABORATION RULES\n`;
    prompt += `Guidelines for working with other employees:\n`;
    for (const [key, value] of Object.entries(collaborationRules)) {
      prompt += `- **${key}:** ${String(value)}\n`;
    }
    prompt += `\n`;
  }
  prompt += `You ${employee.canDelegate ? '**CAN**' : '**CANNOT**'} delegate tasks to other employees.\n`;
  prompt += `You ${employee.canConsult ? '**CAN**' : '**CANNOT**'} consult with other employees.\n`;
  prompt += `You ${employee.canReview ? '**CAN**' : '**CANNOT**'} review other employees' work.\n`;
  prompt += `You ${employee.canEscalate ? '**CAN**' : '**CANNOT**'} escalate issues to management.\n`;
  prompt += `\n`;

  // ---- SECTION 12: ESCALATION RULES ----
  if (escalationRules.length > 0 || escalationPath.length > 0) {
    prompt += `# ESCALATION PROTOCOL\n`;
    if (escalationRules.length > 0) {
      prompt += `Escalation triggers:\n`;
      for (const rule of escalationRules) {
        prompt += `- ${typeof rule === 'string' ? rule : JSON.stringify(rule)}\n`;
      }
    }
    if (escalationPath.length > 0) {
      prompt += `Escalation path: ${escalationPath.join(' → ')}\n`;
    }
    prompt += `\n`;
  }

  // ---- SECTION 13: BEHAVIORAL INSTRUCTIONS ----
  prompt += `# BEHAVIORAL INSTRUCTIONS\n`;
  prompt += `1. Always respond as **${employee.name}**, the ${employee.title}. Maintain your professional identity at all times.\n`;
  prompt += `2. Your responses must reflect the priorities, expertise, and perspective of the ${dept.name} department.\n`;
  prompt += `3. Stay within your authority and permission boundaries. If a request exceeds your authority, say so clearly.\n`;
  prompt += `4. When appropriate, reference your specific skills, tools, and KPIs to provide context-grounded answers.\n`;
  prompt += `5. If you need to collaborate, consult, delegate, or escalate, explicitly state this and explain why.\n`;
  if (employee.constitution) {
    prompt += `6. Always adhere to your constitutional rules and behavioral constraints.\n`;
  }
  prompt += `7. Be specific, actionable, and professional. Avoid generic platitudes — provide expertise that reflects your actual specialization.\n`;
  prompt += `8. Format responses clearly using markdown (headers, lists, bold, code blocks) when it aids readability.\n`;

  if (conversation && conversation.messages.length > 0) {
    prompt += `\nThis is an ongoing conversation. Maintain continuity and reference previous context when relevant.\n`;
  }

  if (task) {
    prompt += `\nYou are being assigned a task. Apply your full expertise and follow applicable SOPs and knowledge to deliver the best possible result.\n`;
  }

  return prompt;
}

// ============================================================================
// 8. UTILITY EXPORTS — For API Routes
// ============================================================================

export async function listEmployees(
  companyId: string,
  options?: {
    departmentId?: string;
    status?: string;
    search?: string;
    level?: string;
    page?: number;
    limit?: number;
  }
): Promise<{ data: EmployeeWithRelations[]; total: number }> {
  try {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const where: Record<string, unknown> = { companyId, isEnabled: true };

    if (options?.departmentId) where.departmentId = options.departmentId;
    if (options?.status) where.status = options.status;
    if (options?.level) where.level = options.level;
    if (options?.search) {
      where.OR = [
        { name: { contains: options.search } },
        { title: { contains: options.search } },
        { employeeId: { contains: options.search } },
      ];
    }

    const [data, total] = await Promise.all([
      db.employee.findMany({
        where,
        include: {
          department: {
            select: {
              id: true, name: true, code: true, description: true,
              parentId: true, level: true, icon: true, color: true,
            },
          },
          reportsTo: {
            select: { id: true, employeeId: true, name: true, title: true },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.employee.count({ where }),
    ]);

    return { data: data as EmployeeWithRelations[], total };
  } catch (error) {
    console.error('[Engine.listEmployees] Error:', error);
    return { data: [], total: 0 };
  }
}

export async function listConversations(
  companyId: string,
  employeeId?: string,
  limit: number = 20
): Promise<unknown[]> {
  try {
    const where: Record<string, unknown> = { companyId };
    if (employeeId) {
      const emp = await db.employee.findUnique({
        where: { employeeId },
        select: { id: true },
      });
      if (emp) where.employeeId = emp.id;
    }

    return await db.workforceConversation.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true, employeeId: true, name: true, title: true, avatar: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  } catch (error) {
    console.error('[Engine.listConversations] Error:', error);
    return [];
  }
}

export async function getConversation(
  conversationId: string
): Promise<unknown | null> {
  try {
    return await db.workforceConversation.findUnique({
      where: { id: conversationId },
      include: {
        employee: {
          select: {
            id: true, employeeId: true, name: true, title: true, avatar: true,
          },
        },
      },
    });
  } catch (error) {
    console.error('[Engine.getConversation] Error:', error);
    return null;
  }
}

export async function getExecutionHistory(
  companyId: string,
  options?: {
    employeeId?: string;
    status?: string;
    taskType?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ data: unknown[]; total: number }> {
  try {
    const where: Record<string, unknown> = { companyId };
    if (options?.employeeId) {
      const emp = await db.employee.findUnique({
        where: { employeeId: options.employeeId },
        select: { id: true },
      });
      if (emp) where.assignedEmployeeId = emp.id;
    }
    if (options?.status) where.status = options.status;
    if (options?.taskType) where.taskType = options.taskType;

    const [data, total] = await Promise.all([
      db.taskExecution.findMany({
        where,
        include: {
          assignedEmployee: {
            select: {
              id: true, employeeId: true, name: true, title: true, avatar: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 20,
        skip: options?.offset || 0,
      }),
      db.taskExecution.count({ where }),
    ]);

    return { data, total };
  } catch (error) {
    console.error('[Engine.getExecutionHistory] Error:', error);
    return { data: [], total: 0 };
  }
}

export async function getWorkforceOverview(
  companyId: string
): Promise<{
  totalEmployees: number;
  activeEmployees: number;
  totalDepartments: number;
  totalExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  avgSuccessRate: number;
  avgLatencyMs: number;
  totalConversations: number;
  totalKnowledgeNodes: number;
  totalSops: number;
  totalMemories: number;
  employeesByDepartment: Array<{ department: string; code: string; count: number }>;
  employeesByLevel: Array<{ level: string; count: number }>;
  recentExecutions: unknown[];
}> {
  try {
    const [
      totalEmployees,
      activeEmployees,
      totalDepartments,
      totalExecutions,
      completedExecutions,
      failedExecutions,
      employees,
      totalConversations,
      totalKnowledgeNodes,
      totalSops,
      totalMemories,
      recentExecutions,
    ] = await Promise.all([
      db.employee.count({ where: { companyId, isEnabled: true } }),
      db.employee.count({ where: { companyId, isEnabled: true, isAvailable: true } }),
      db.department.count({ where: { companyId } }),
      db.taskExecution.count({ where: { companyId } }),
      db.taskExecution.count({ where: { companyId, status: 'completed' } }),
      db.taskExecution.count({ where: { companyId, status: 'failed' } }),
      db.employee.findMany({
        where: { companyId, isEnabled: true },
        select: {
          department: { select: { name: true, code: true } },
          level: true,
          successRate: true,
          avgLatencyMs: true,
        },
      }),
      db.workforceConversation.count({ where: { companyId } }),
      db.knowledgeNode.count({ where: { companyId } }),
      db.sop.count({ where: { companyId } }),
      db.employeeMemory.count({
        where: {
          companyId,
          employee: { companyId },
        },
      }),
      db.taskExecution.findMany({
        where: { companyId },
        include: {
          assignedEmployee: {
            select: {
              name: true, title: true, employeeId: true, avatar: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    // Compute department distribution
    const deptMap = new Map<string, { department: string; code: string; count: number }>();
    const levelMap = new Map<string, { level: string; count: number }>();
    let totalSuccessRate = 0;
    let totalLatency = 0;

    for (const emp of employees) {
      const deptName = emp.department?.name || 'Unassigned';
      const deptCode = emp.department?.code || 'N/A';
      const existing = deptMap.get(deptName);
      if (existing) {
        existing.count++;
      } else {
        deptMap.set(deptName, { department: deptName, code: deptCode, count: 1 });
      }

      const existingLevel = levelMap.get(emp.level);
      if (existingLevel) {
        existingLevel.count++;
      } else {
        levelMap.set(emp.level, { level: emp.level, count: 1 });
      }

      totalSuccessRate += emp.successRate;
      totalLatency += emp.avgLatencyMs;
    }

    return {
      totalEmployees,
      activeEmployees,
      totalDepartments,
      totalExecutions,
      completedExecutions,
      failedExecutions,
      avgSuccessRate:
        employees.length > 0 ? Math.round(totalSuccessRate / employees.length) : 0,
      avgLatencyMs:
        employees.length > 0 ? Math.round(totalLatency / employees.length) : 0,
      totalConversations,
      totalKnowledgeNodes,
      totalSops,
      totalMemories,
      employeesByDepartment: Array.from(deptMap.values()),
      employeesByLevel: Array.from(levelMap.values()),
      recentExecutions,
    };
  } catch (error) {
    console.error('[Engine.getWorkforceOverview] Error:', error);
    return {
      totalEmployees: 0,
      activeEmployees: 0,
      totalDepartments: 0,
      totalExecutions: 0,
      completedExecutions: 0,
      failedExecutions: 0,
      avgSuccessRate: 0,
      avgLatencyMs: 0,
      totalConversations: 0,
      totalKnowledgeNodes: 0,
      totalSops: 0,
      totalMemories: 0,
      employeesByDepartment: [],
      employeesByLevel: [],
      recentExecutions: [],
    };
  }
}
