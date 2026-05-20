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
    repo.users = [{ cognitoSub: 'sub-1', displayName: '太郎', icon: 'icon1', totalPoints: 100 }]
    repo.taskMasters = [{ taskId: 'task-1', taskName: 'お風呂掃除', points: 10, icon: 'bath' }]

    const res = await familyInitHandler(CTX, REQ, { familyRepo: repo })

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      users: repo.users,
      tasks: repo.taskMasters,
    })
  })

  it('データが空でも 200 を返す', async () => {
    const res = await familyInitHandler(CTX, REQ, { familyRepo: repo })

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ users: [], tasks: [] })
  })
})
