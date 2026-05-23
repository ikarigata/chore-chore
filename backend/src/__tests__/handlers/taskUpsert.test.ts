import { describe, expect, it, beforeEach } from 'vitest'
import { taskUpsertHandler } from '../../handlers/taskUpsert.js'
import { AppError } from '../../errors.js'
import { MockFamilyRepository } from '../mocks/MockFamilyRepository.js'

const CTX = { familyId: 'family-1', cognitoSub: 'sub-1' }

function makeReq(body: object) {
  return { pathParams: {}, queryParams: {}, body }
}

describe('taskUpsertHandler', () => {
  let repo: MockFamilyRepository

  beforeEach(() => {
    repo = new MockFamilyRepository()
  })

  it('家事設定を保存して 200 を返す', async () => {
    const body = { taskId: 'task-1', taskName: 'ゴミ出し', points: 5 }
    const res = await taskUpsertHandler(CTX, makeReq(body), { familyRepo: repo })

    expect(res.statusCode).toBe(200)
    expect(repo.upsertTaskMasterCalls).toHaveLength(1)
    const [fid, input] = repo.upsertTaskMasterCalls[0]!
    expect(fid).toBe('family-1')
    expect(input).toEqual(body)
  })

  it('points が 0 でも保存できる', async () => {
    const res = await taskUpsertHandler(
      CTX,
      makeReq({ taskId: 't', taskName: '名前', points: 0 }),
      { familyRepo: repo },
    )
    expect(res.statusCode).toBe(200)
  })

  it('必須フィールドが欠けている場合 400 を投げる', async () => {
    await expect(
      taskUpsertHandler(CTX, makeReq({ taskId: 't', taskName: '名前' }), { familyRepo: repo }),
    ).rejects.toThrow(new AppError(400, 'taskId、taskName、points は必須です'))
  })

  it('points が負の場合 400 を投げる', async () => {
    await expect(
      taskUpsertHandler(
        CTX,
        makeReq({ taskId: 't', taskName: '名前', points: -1, icon: 'i' }),
        { familyRepo: repo },
      ),
    ).rejects.toThrow(new AppError(400, 'points は0以上である必要があります'))
  })

  it('categoryId を指定した場合、リポジトリに渡される', async () => {
    const body = { taskId: 'task-1', taskName: 'ゴミ出し', points: 5, categoryId: 'cooking' }
    await taskUpsertHandler(CTX, makeReq(body), { familyRepo: repo })

    const [, input] = repo.upsertTaskMasterCalls[0]!
    expect(input.categoryId).toBe('cooking')
  })

  it('categoryId を省略した場合、リポジトリに categoryId が渡されない', async () => {
    await taskUpsertHandler(
      CTX,
      makeReq({ taskId: 'task-1', taskName: 'ゴミ出し', points: 5 }),
      { familyRepo: repo },
    )

    const [, input] = repo.upsertTaskMasterCalls[0]!
    expect(input.categoryId).toBeUndefined()
  })
})
