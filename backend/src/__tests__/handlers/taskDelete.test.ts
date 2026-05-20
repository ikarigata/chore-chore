import { describe, expect, it, beforeEach } from 'vitest'
import { taskDeleteHandler } from '../../handlers/taskDelete.js'
import { AppError } from '../../errors.js'
import { MockFamilyRepository } from '../mocks/MockFamilyRepository.js'

const CTX = { familyId: 'family-1', cognitoSub: 'sub-1' }

describe('taskDeleteHandler', () => {
  let repo: MockFamilyRepository

  beforeEach(() => {
    repo = new MockFamilyRepository()
  })

  it('家事設定を削除して 200 を返す', async () => {
    const req = { pathParams: { taskId: 'task-1' }, queryParams: {}, body: {} }
    const res = await taskDeleteHandler(CTX, req, { familyRepo: repo })

    expect(res.statusCode).toBe(200)
    expect(repo.deleteTaskMasterCalls).toEqual([['family-1', 'task-1']])
  })

  it('pathParams に taskId がない場合 400 を投げる', async () => {
    const req = { pathParams: {}, queryParams: {}, body: {} }
    await expect(taskDeleteHandler(CTX, req, { familyRepo: repo })).rejects.toThrow(
      new AppError(400, 'taskId は必須です'),
    )
  })
})
