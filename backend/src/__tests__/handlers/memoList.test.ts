import { describe, expect, it, beforeEach } from 'vitest'
import { memoListHandler } from '../../handlers/memoList.js'
import { MockFamilyRepository } from '../mocks/MockFamilyRepository.js'

const CTX = { familyId: 'family-1', cognitoSub: 'sub-1' }
const REQ = { pathParams: {}, queryParams: {}, body: {} }

describe('memoListHandler', () => {
  let repo: MockFamilyRepository

  beforeEach(() => {
    repo = new MockFamilyRepository()
  })

  it('メモ一覧を 200 で返す', async () => {
    repo.memoList = [
      {
        memoId: 'memo-uuid-1',
        authorSub: 'sub-1',
        content: '牛乳買う',
        timestamp: '2026-05-25T10:00:00.000Z',
        expiresAt: 9999999999,
      },
    ]

    const res = await memoListHandler(CTX, REQ, { familyRepo: repo })

    expect(res.statusCode).toBe(200)
    expect((res.body as { memos: unknown[] }).memos).toHaveLength(1)
    expect((res.body as { memos: { content: string }[] }).memos[0]!.content).toBe('牛乳買う')
  })

  it('メモが0件でも 200 で空配列を返す', async () => {
    const res = await memoListHandler(CTX, REQ, { familyRepo: repo })

    expect(res.statusCode).toBe(200)
    expect((res.body as { memos: unknown[] }).memos).toHaveLength(0)
  })
})
