import { describe, expect, it, beforeEach } from 'vitest'
import { memoDeleteHandler } from '../../handlers/memoDelete.js'
import { AppError } from '../../errors.js'
import { MockFamilyRepository } from '../mocks/MockFamilyRepository.js'

const CTX = { familyId: 'family-1', cognitoSub: 'sub-1' }

function makeReq(body: object) {
  return { pathParams: {}, queryParams: {}, body }
}

describe('memoDeleteHandler', () => {
  let repo: MockFamilyRepository

  beforeEach(() => {
    repo = new MockFamilyRepository()
  })

  it('メモを削除して 200 を返す', async () => {
    const res = await memoDeleteHandler(
      CTX,
      makeReq({
        memoId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        timestamp: '2026-05-25T10:00:00.000Z',
      }),
      { familyRepo: repo },
    )

    expect(res.statusCode).toBe(200)
    expect(repo.deleteMemoCalls).toHaveLength(1)
    const [fid, input] = repo.deleteMemoCalls[0]!
    expect(fid).toBe('family-1')
    expect(input.memoId).toBe('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
    expect(input.timestamp).toBe('2026-05-25T10:00:00.000Z')
  })

  it('memoId がない場合 400 を投げる', async () => {
    await expect(
      memoDeleteHandler(
        CTX,
        makeReq({ timestamp: '2026-05-25T10:00:00.000Z' }),
        { familyRepo: repo },
      ),
    ).rejects.toThrow()
  })

  it('timestamp がない場合 400 を投げる', async () => {
    await expect(
      memoDeleteHandler(
        CTX,
        makeReq({ memoId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' }),
        { familyRepo: repo },
      ),
    ).rejects.toThrow()
  })

  it('リポジトリが AppError を投げた場合そのまま伝播する', async () => {
    repo.deleteMemoError = new AppError(404, '対象のメモが見つかりません')

    await expect(
      memoDeleteHandler(
        CTX,
        makeReq({
          memoId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          timestamp: '2026-05-25T10:00:00.000Z',
        }),
        { familyRepo: repo },
      ),
    ).rejects.toThrow(new AppError(404, '対象のメモが見つかりません'))
  })
})
