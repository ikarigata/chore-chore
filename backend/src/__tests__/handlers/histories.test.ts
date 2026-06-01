import { describe, expect, it, beforeEach } from 'vitest'
import { historiesHandler } from '../../handlers/histories.js'
import { MockFamilyRepository } from '../mocks/MockFamilyRepository.js'

const CTX = { familyId: 'family-1', cognitoSub: 'sub-1' }
const REQ = { pathParams: {}, queryParams: {}, body: {} }

describe('historiesHandler', () => {
  let repo: MockFamilyRepository

  beforeEach(() => {
    repo = new MockFamilyRepository()
  })

  it('履歴リストを返して 200 を返す', async () => {
    repo.histories = [
      {
        taskExecutionId: 'exec-1',
        cognitoSub: 'sub-1',
        taskId: 'task-1',
        points: 10,
        timestamp: '2024-06-15T10:00:00.000Z',
        expiresAt: 1718445600,
      },
    ]

    const res = await historiesHandler(CTX, REQ, { familyRepo: repo })

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ taskHistories: repo.histories })
  })

  it('履歴がない場合も 200 を返す', async () => {
    const res = await historiesHandler(CTX, REQ, { familyRepo: repo })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ taskHistories: [] })
  })
})
