import { describe, expect, it, beforeEach } from 'vitest'
import { userUpdateHandler } from '../../handlers/userUpdate.js'
import { MockFamilyRepository } from '../mocks/MockFamilyRepository.js'

const CTX = { familyId: 'family-1', cognitoSub: 'sub-1' }

function makeReq(body: object) {
  return { pathParams: {}, queryParams: {}, body }
}

describe('userUpdateHandler', () => {
  let repo: MockFamilyRepository

  beforeEach(() => {
    repo = new MockFamilyRepository()
  })

  it('表示名を更新して 200 を返す', async () => {
    const res = await userUpdateHandler(
      CTX,
      makeReq({ displayName: 'パパ改' }),
      { familyRepo: repo },
    )

    expect(res.statusCode).toBe(200)
    expect(repo.updateUserDisplayNameCalls).toHaveLength(1)
    expect(repo.updateUserDisplayNameCalls[0]).toEqual(['family-1', 'sub-1', 'パパ改'])
  })

  it('前後の空白はトリムされて保存される', async () => {
    await userUpdateHandler(
      CTX,
      makeReq({ displayName: '  ママ  ' }),
      { familyRepo: repo },
    )

    expect(repo.updateUserDisplayNameCalls[0]?.[2]).toBe('ママ')
  })

  it('displayName が空文字の場合 400 を投げる', async () => {
    await expect(
      userUpdateHandler(CTX, makeReq({ displayName: '' }), { familyRepo: repo }),
    ).rejects.toThrow()
  })

  it('displayName が空白のみの場合 400 を投げる', async () => {
    await expect(
      userUpdateHandler(CTX, makeReq({ displayName: '   ' }), { familyRepo: repo }),
    ).rejects.toThrow()
  })

  it('displayName が 50 文字超の場合 400 を投げる', async () => {
    await expect(
      userUpdateHandler(
        CTX,
        makeReq({ displayName: 'a'.repeat(51) }),
        { familyRepo: repo },
      ),
    ).rejects.toThrow()
  })

  it('displayName が無い場合 400 を投げる', async () => {
    await expect(
      userUpdateHandler(CTX, makeReq({}), { familyRepo: repo }),
    ).rejects.toThrow()
  })
})
