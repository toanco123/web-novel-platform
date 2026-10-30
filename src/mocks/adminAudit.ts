// Nhật ký thao tác admin của bản giả (features/admin/api.mock.ts), lưu localStorage. Bản thật ghi
// ở DB (private.admin_log, migration admin_audit_log).
import { readMock, writeMock } from '@/lib/mockStorage'

export type StoredAuditEntry = {
  id: string
  actorId: string
  actorName: string
  action: string
  targetType: string
  targetId: string
  targetLabel: string
  details: Record<string, unknown>
  createdAt: string
}

const AUDIT_KEY = 'mock-admin-audit'

/** Mới nhất trước */
export const loadAuditLog = () => readMock<StoredAuditEntry[]>(AUDIT_KEY, [])

export function appendAudit(entry: Omit<StoredAuditEntry, 'id' | 'createdAt'>) {
  const log = loadAuditLog()
  const next = Math.max(0, ...log.map((e) => Number(e.id))) + 1
  writeMock(AUDIT_KEY, [
    { ...entry, id: String(next), createdAt: new Date().toISOString() },
    ...log,
  ])
}
