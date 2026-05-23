import { describe, expect, it, beforeEach } from 'vitest'
import { taskExecuteCancelHandler } from '../../handlers/taskExecuteCancel.js'
import { AppError } from '../../errors.js'
import { MockFamilyRepository } from '../mocks/MockFamilyRepository.js'

const CTX = { familyId: 'family-1', cognitoSub: 'sub-1' }

function makeReq(body: object) {
  return { pathParams: {}, queryParams: {}, body }
}

describe('taskExecuteCancelHandler', () => {
  let repo: MockFamilyRepository

  beforeEach(() => {
    repo = new MockFamilyRepository()
  })

  it('家事履歴を取り消して 200 を返す', async () => {
    const timestamp = '2024-06-15T10:00:00.000Z'
    const res = await taskExecuteCancelHandler(
      CTX,
      makeReq({ taskExecutionId: 'exec-1', timestamp, points: 10 }),
      { familyRepo: repo },
    )

    expect(res.statusCode).toBe(200)
    expect(repo.deleteTaskHistoryCalls).toHaveLength(1)
    const [fid, sub, input] = repo.deleteTaskHistoryCalls[0]!
    expect(fid).toBe('family-1')
    expect(sub).toBe('sub-1')
    expect(input.taskExecutionId).toBe('exec-1')
    expect(input.timestamp).toBe(timestamp)
    expect(input.points).toBe(10)
    // タイムスタンプ 2024-06-15T10:00:00.000Z は JST では 2024-06-15（UTC+9）
    expect(input.dailyDate).toBe('2024-06-15')
  })

  it('JST 日付の境界を正しく扱う（UTC 前日が JST 翌日）', async () => {
    // UTC 2024-06-14T15:00:00Z → JST 2024-06-15T00:00:00
    const timestamp = '2024-06-14T15:00:00.000Z'
    await taskExecuteCancelHandler(
      CTX,
      makeReq({ taskExecutionId: 'exec-2', timestamp, points: 5 }),
      { familyRepo: repo },
    )
    expect(repo.deleteTaskHistoryCalls[0]![2].dailyDate).toBe('2024-06-15')
  })

  it('必須フィールドが欠けている場合 400 を投げる', async () => {
    await expect(
      taskExecuteCancelHandler(CTX, makeReq({ taskExecutionId: 'e', timestamp: 't' }), { familyRepo: repo }),
    ).rejects.toThrow()
  })

  it('points が負の場合 400 を投げる', async () => {
    await expect(
      taskExecuteCancelHandler(
        CTX,
        makeReq({ taskExecutionId: 'e', timestamp: '2024-01-01T00:00:00Z', points: -1 }),
        { familyRepo: repo },
      ),
    ).rejects.toThrow(new AppError(400, 'points は0以上である必要があります'))
  })
})
