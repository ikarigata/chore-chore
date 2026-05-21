import { describe, expect, it, beforeEach } from 'vitest'
import { route } from '../router.js'
import { AppError } from '../errors.js'
import { MockFamilyRepository } from './mocks/MockFamilyRepository.js'

const CTX = { familyId: 'family-1', cognitoSub: 'sub-1' }

function makeReq(overrides: Partial<{ pathParams: Record<string, string>; queryParams: Record<string, string>; body: unknown }> = {}) {
  return { pathParams: {}, queryParams: {}, body: {}, ...overrides }
}

describe('route', () => {
  let repo: MockFamilyRepository
  let deps: { familyRepo: MockFamilyRepository; cognitoService: { setFamilyId: () => Promise<void> } }

  beforeEach(() => {
    repo = new MockFamilyRepository()
    repo.taskMasterMap.set('task-1', { taskId: 'task-1', taskName: 'test', points: 5 })
    deps = { familyRepo: repo, cognitoService: { setFamilyId: async () => {} } }
  })

  it('GET /family/init → 200', async () => {
    const res = await route('GET', '/family/init', CTX, makeReq(), deps)
    expect(res.statusCode).toBe(200)
  })

  it('GET /summary/daily → 200', async () => {
    const res = await route('GET', '/summary/daily', CTX, makeReq(), deps)
    expect(res.statusCode).toBe(200)
  })

  it('GET /histories → 200', async () => {
    const res = await route('GET', '/histories', CTX, makeReq(), deps)
    expect(res.statusCode).toBe(200)
  })

  it('PUT /tasks → 200', async () => {
    const body = { taskId: 't', taskName: '名前', points: 10 }
    const res = await route('PUT', '/tasks', CTX, makeReq({ body }), deps)
    expect(res.statusCode).toBe(200)
  })

  it('POST /tasks/execute → 200', async () => {
    const body = { taskId: 'task-1', taskExecutionId: 'exec-1' }
    const res = await route('POST', '/tasks/execute', CTX, makeReq({ body }), deps)
    expect(res.statusCode).toBe(200)
  })

  it('DELETE /tasks/execute → 200', async () => {
    const body = { taskExecutionId: 'exec-1', timestamp: '2024-01-01T00:00:00Z', points: 5 }
    const res = await route('DELETE', '/tasks/execute', CTX, makeReq({ body }), deps)
    expect(res.statusCode).toBe(200)
  })

  it('DELETE /tasks/{taskId} → 200', async () => {
    const res = await route('DELETE', '/tasks/task-uuid-123', CTX, makeReq(), deps)
    expect(res.statusCode).toBe(200)
    expect(repo.deleteTaskMasterCalls).toEqual([['family-1', 'task-uuid-123']])
  })

  it('未定義のパスは 404 を投げる', async () => {
    await expect(route('GET', '/unknown', CTX, makeReq(), deps)).rejects.toThrow(
      new AppError(404, 'エンドポイントが見つかりません'),
    )
  })

  it('未定義のメソッドは 404 を投げる', async () => {
    await expect(route('PATCH', '/family/init', CTX, makeReq(), deps)).rejects.toThrow(
      new AppError(404, 'エンドポイントが見つかりません'),
    )
  })
})
