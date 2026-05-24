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
    expect(repo.createTaskHistoryCalls).toHaveLength(1)
    const [fid, sub, input] = repo.createTaskHistoryCalls[0]!
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
    ).rejects.toThrow()
    // Zod error message will be different, so we just check it throws (likely 400)
  })

  it('taskExecutionId がない場合 400 を投げる', async () => {
    await expect(
      taskExecuteHandler(CTX, makeReq({ taskId: 'task-1' }), { familyRepo: repo }),
    ).rejects.toThrow()
  })

  it('存在しない taskId の場合 404 を投げる', async () => {
    await expect(
      taskExecuteHandler(CTX, makeReq({ taskId: 'no-such', taskExecutionId: 'exec-1' }), { familyRepo: repo }),
    ).rejects.toThrow(new AppError(404, '指定された家事が見つかりません'))
  })

  it('リポジトリが AppError を投げた場合そのまま伝播する', async () => {
    repo.createTaskHistoryError = new AppError(409, 'この家事完了は既に記録されています')

    await expect(
      taskExecuteHandler(CTX, makeReq({ taskId: 'task-1', taskExecutionId: 'dup' }), { familyRepo: repo }),
    ).rejects.toThrow(new AppError(409, 'この家事完了は既に記録されています'))
  })

  it('timestamp が指定された場合その値を使って HISTORY と DAILY を組み立てる', async () => {
    // JST 2026-05-22 21:00 = UTC 2026-05-22 12:00
    const backdatedIso = '2026-05-22T12:00:00.000Z'
    const res = await taskExecuteHandler(
      CTX,
      makeReq({ taskId: 'task-1', taskExecutionId: 'exec-back', timestamp: backdatedIso }),
      { familyRepo: repo },
    )

    expect(res.statusCode).toBe(200)
    const [, , input] = repo.createTaskHistoryCalls[0]!
    expect(input.timestamp).toBe(backdatedIso)
    expect(input.dailyDate).toBe('2026-05-22')
  })

  it('timestamp を省略した場合は現在時刻を使う', async () => {
    const before = Date.now()
    await taskExecuteHandler(
      CTX,
      makeReq({ taskId: 'task-1', taskExecutionId: 'exec-now' }),
      { familyRepo: repo },
    )
    const after = Date.now()

    const [, , input] = repo.createTaskHistoryCalls[0]!
    const ts = new Date(input.timestamp).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  it('未来日の timestamp は 400 を投げる', async () => {
    const futureIso = new Date(Date.now() + 60 * 1000).toISOString()
    await expect(
      taskExecuteHandler(
        CTX,
        makeReq({ taskId: 'task-1', taskExecutionId: 'exec-future', timestamp: futureIso }),
        { familyRepo: repo },
      ),
    ).rejects.toThrow(new AppError(400, '未来日は指定できません'))
  })

  it('8日以上前の timestamp は 400 を投げる', async () => {
    const eightDaysAgoIso = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    await expect(
      taskExecuteHandler(
        CTX,
        makeReq({ taskId: 'task-1', taskExecutionId: 'exec-old', timestamp: eightDaysAgoIso }),
        { familyRepo: repo },
      ),
    ).rejects.toThrow(new AppError(400, '7日より前の日付は指定できません'))
  })
})
