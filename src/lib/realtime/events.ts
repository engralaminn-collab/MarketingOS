/**
 * Realtime Event Types — defines all event names and their payload shapes
 * for the MarketingOS realtime system.
 *
 * Events are emitted by the server (via WebSocket or SSE) and consumed by
 * the client-side realtime hooks (useRealtime, useRealtimeConnection).
 */

// ─── Business Event Types ─────────────────────────────────────────────────────
export type RealtimeEventType =
  | 'lead:created'
  | 'lead:updated'
  | 'lead:deleted'
  | 'contact:created'
  | 'contact:updated'
  | 'deal:created'
  | 'deal:updated'
  | 'deal:won'
  | 'deal:lost'
  | 'ticket:created'
  | 'ticket:updated'
  | 'message:new'
  | 'message:read'
  | 'notification:new'
  | 'campaign:started'
  | 'campaign:completed'
  | 'content:published'
  | 'content:scheduled'
  | 'ai:task_started'
  | 'ai:task_completed'
  | 'ai:task_failed'
  | 'workflow:started'
  | 'workflow:completed'
  | 'workflow:failed'
  | 'employee:task_completed'
  | 'activity:new';

// ─── System Event Types ───────────────────────────────────────────────────────
export type RealtimeSystemEventType =
  | 'system:connected'
  | 'system:disconnected'
  | 'system:error'
  | 'system:reconnecting';

// ─── Event Payload Map ────────────────────────────────────────────────────────
export interface RealtimeEventDataMap {
  'lead:created': { id: string; name: string; companyId: string };
  'lead:updated': { id: string; name: string; companyId: string };
  'lead:deleted': { id: string; companyId: string };
  'contact:created': { id: string; name: string; companyId: string };
  'contact:updated': { id: string; name: string; companyId: string };
  'deal:created': { id: string; name: string; value: number; companyId: string };
  'deal:updated': { id: string; name: string; stage: string; companyId: string };
  'deal:won': { id: string; name: string; value: number; companyId: string };
  'deal:lost': { id: string; name: string; companyId: string };
  'ticket:created': { id: string; subject: string; priority: string; companyId: string };
  'ticket:updated': { id: string; status: string; companyId: string };
  'message:new': { id: string; content: string; senderId: string; companyId: string };
  'message:read': { id: string; readBy: string };
  'notification:new': { id: string; title: string; message: string; link?: string };
  'campaign:started': { id: string; name: string; companyId: string };
  'campaign:completed': { id: string; name: string; companyId: string };
  'content:published': { id: string; title: string; platform: string; companyId: string };
  'content:scheduled': { id: string; title: string; scheduledAt: string; companyId: string };
  'ai:task_started': { taskId: string; agentId: string; companyId: string };
  'ai:task_completed': { taskId: string; agentId: string; output: string; companyId: string };
  'ai:task_failed': { taskId: string; agentId: string; error: string; companyId: string };
  'workflow:started': { workflowId: string; runId: string; companyId: string };
  'workflow:completed': { workflowId: string; runId: string; companyId: string };
  'workflow:failed': { workflowId: string; runId: string; error: string; companyId: string };
  'employee:task_completed': { employeeId: string; taskId: string; companyId: string };
  'activity:new': { id: string; type: string; description: string; companyId: string };
  'system:connected': { socketId: string };
  'system:disconnected': { reason: string };
  'system:error': { error: string };
  'system:reconnecting': { attempt: number };
}

export type AllRealtimeEvents = RealtimeEventType | RealtimeSystemEventType;
