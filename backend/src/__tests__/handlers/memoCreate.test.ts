import { describe, expect, it, beforeEach } from 'vitest'
import { memoCreateHandler } from '../../handlers/memoCreate.js'
import { AppError } from '../../errors.js'
import { MockFamilyRepository } from '../mocks/MockFamilyRepository.js'

const CTX = { familyId: 'family-1', cognitoSub: 'sub-1' }

function makeReq(body: object) {
  return { pathParams: {}, queryParams: {}, body }
}

describe('memoCreateHandler', () => {
  let repo: MockFamilyRepository

  beforeEach(() => {
    repo = new MockFamilyRepository()
  })

  it('メモを作成して 200 を返す', async () => {
    const res = await memoCreateHandler(
      CTX,
      makeReq({ memoId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', content: '牛乳買う' }),
      { familyRepo: repo },
    )

    expect(res.statusCode).toBe(200)
    expect(repo.createMemoCalls).toHaveLength(1)
    const [fid, sub, input] = repo.createMemoCalls[0]!
    expect(fid).toBe('family-1')
    expect(sub).toBe('sub-1')
    expect(input.content).toBe('牛乳買う')
    expect(input.memoId).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
    expect(input.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('memoId がない場合 400 を投げる', async () => {
    await expect(
      memoCreateHandler(CTX, makeReq({ content: '牛乳買う' }), { familyRepo: repo }),
    ).rejects.toThrow()
  })

  it('content がない場合 400 を投げる', async () => {
    await expect(
      memoCreateHandler(
        CTX,
        makeReq({ memoId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' }),
        { familyRepo: repo },
      ),
    ).rejects.toThrow()
  })

  it('content が空文字の場合 400 を投げる', async () => {
    await expect(
      memoCreateHandler(
        CTX,
        makeReq({ memoId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', content: '' }),
        { familyRepo: repo },
      ),
    ).rejects.toThrow()
  })

  it('content が 500 文字を超える場合 400 を投げる', async () => {
    await expect(
      memoCreateHandler(
        CTX,
        makeReq({ memoId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', content: 'あ'.repeat(501) }),
        { familyRepo: repo },
      ),
    ).rejects.toThrow()
  })

  it('content が 500 文字ちょうどは通る', async () => {
    const res = await memoCreateHandler(
      CTX,
      makeReq({ memoId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', content: 'あ'.repeat(500) }),
      { familyRepo: repo },
    )
    expect(res.statusCode).toBe(200)
  })

  it('リポジトリが AppError を投げた場合そのまま伝播する', async () => {
    repo.createMemoError = new AppError(409, 'このメモは既に記録されています')

    await expect(
      memoCreateHandler(
        CTX,
        makeReq({ memoId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', content: '牛乳買う' }),
        { familyRepo: repo },
      ),
    ).rejects.toThrow(new AppError(409, 'このメモは既に記録されています'))
  })
})
