import { describe, expect, it, beforeEach } from 'vitest'
import { taskExecuteHandler } from '../../handlers/taskExecute.js'
import { AppError } from '../../errors.js'
import { MockFamilyRepository } from '../mocks/MockFamilyRepository.js'

const CTX = { familyId: 'family-1', cognitoSub: 'sub-1' }

function makeReq(body: object) {
  return { pathParams: {}, queryParams: {}, body }
}

describe('taskExecuteHandler', () => {
  let repo: MockFamilyRepository

  beforeEach(() => {
    repo = new MockFamilyRepository()
    repo.taskMasterMap.set('task-1', { taskId: 'task-1', taskName: 'お風呂掃除', points: 10 })
  })

  it('家事を記録して 200 を返す', async () => {
    const res = await taskExecuteHandler(
      CTX,
      makeReq({ taskId: 'task-1', taskExecutionId: 'exec-uuid-1' }),
      { familyRepo: repo },
    )

    expect(res.statusCode).toBe(200)
    expect(repo.executeTaskCalls).toHaveLength(1)
    const [fid, sub, input] = repo.executeTaskCalls[0]!
    expect(fid).toBe('family-1')
    expect(sub).toBe('sub-1')
    expect(input.taskId).toBe('task-1')
    expect(input.taskExecutionId).toBe('exec-uuid-1')
    expect(input.points).toBe(10)
    expect(input.dailyDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('taskId がない場合 400 を投げる', async () => {
    await expect(
      taskExecuteHandler(CTX, makeReq({ taskExecutionId: 'exec-1' }), { familyRepo: repo }),
    ).rejects.toThrow(new AppError(400, 'taskId と taskExecutionId は必須です'))
  })

  it('taskExecutionId がない場合 400 を投げる', async () => {
    await expect(
      taskExecuteHandler(CTX, makeReq({ taskId: 'task-1' }), { familyRepo: repo }),
    ).rejects.toThrow(new AppError(400, 'taskId と taskExecutionId は必須です'))
  })

  it('存在しない taskId の場合 404 を投げる', async () => {
    await expect(
      taskExecuteHandler(CTX, makeReq({ taskId: 'no-such', taskExecutionId: 'exec-1' }), { familyRepo: repo }),
    ).rejects.toThrow(new AppError(404, '指定された家事が見つかりません'))
  })

  it('リポジトリが AppError を投げた場合そのまま伝播する', async () => {
    repo.executeTaskError = new AppError(409, 'この家事完了は既に記録されています')

    await expect(
      taskExecuteHandler(CTX, makeReq({ taskId: 'task-1', taskExecutionId: 'dup' }), { familyRepo: repo }),
    ).rejects.toThrow(new AppError(409, 'この家事完了は既に記録されています'))
  })
})
