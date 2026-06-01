import { describe, expect, it, beforeEach } from 'vitest'
import { familyInitHandler } from '../../handlers/familyInit.js'
import { MockFamilyRepository } from '../mocks/MockFamilyRepository.js'

const CTX = { familyId: 'family-1', cognitoSub: 'sub-1' }
const REQ = { pathParams: {}, queryParams: {}, body: {} }

describe('familyInitHandler', () => {
  let repo: MockFamilyRepository

  beforeEach(() => {
    repo = new MockFamilyRepository()
  })

  it('ユーザーと家事リストを返す', async () => {
    repo.users = [{ cognitoSub: 'sub-1', displayName: '太郎', totalPoints: 100 }]
    repo.taskMasters = [{ taskId: 'task-1', taskName: 'お風呂掃除', points: 10 }]

    const res = await familyInitHandler(CTX, REQ, { familyRepo: repo })

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      users: repo.users,
      taskMasters: repo.taskMasters,
    })
  })

  it('データが空でも 200 を返す', async () => {
    const res = await familyInitHandler(CTX, REQ, { familyRepo: repo })

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ users: [], taskMasters: [] })
  })

  it('家事に categoryId がある場合、レスポンスにそのまま含まれる', async () => {
    repo.taskMasters = [{ taskId: 'task-1', taskName: 'お風呂掃除', points: 10, categoryId: 'water' }]

    const res = await familyInitHandler(CTX, REQ, { familyRepo: repo })

    const body = res.body as { taskMasters: { categoryId?: string }[] }
    expect(body.taskMasters[0]?.categoryId).toBe('water')
  })

  it('家事に categoryId がない場合（旧データ）、taskMasters 要素に categoryId プロパティが含まれない', async () => {
    repo.taskMasters = [{ taskId: 'task-1', taskName: 'お風呂掃除', points: 10 }]

    const res = await familyInitHandler(CTX, REQ, { familyRepo: repo })

    const body = res.body as { taskMasters: object[] }
    expect(body.taskMasters[0]).not.toHaveProperty('categoryId')
  })
})
