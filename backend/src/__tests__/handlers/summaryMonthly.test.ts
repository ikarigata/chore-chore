import { describe, expect, it, beforeEach } from 'vitest'
import { summaryMonthlyHandler } from '../../handlers/summaryMonthly.js'
import { AppError } from '../../errors.js'
import { MockFamilyRepository } from '../mocks/MockFamilyRepository.js'

const CTX = { familyId: 'family-1', cognitoSub: 'sub-1' }

describe('summaryMonthlyHandler', () => {
  let repo: MockFamilyRepository

  beforeEach(() => {
    repo = new MockFamilyRepository()
    repo.dailySummaries = [
      { cognitoSub: 'sub-1', date: '2026-06-15', dailyPoints: 30 },
      { cognitoSub: 'sub-2', date: '2026-06-15', dailyPoints: 20 },
    ]
  })

  it('指定月の from/to/summaries を 200 で返す', async () => {
    const req = { pathParams: {}, queryParams: { month: '2026-06' }, body: {} }
    const res = await summaryMonthlyHandler(CTX, req, { familyRepo: repo })

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      month: '2026-06',
      from: '2026-06-01',
      to: '2026-06-30',
      summaries: repo.dailySummaries,
    })
  })

  it('閏年 2 月は to が 02-29 になる', async () => {
    const req = { pathParams: {}, queryParams: { month: '2024-02' }, body: {} }
    const res = await summaryMonthlyHandler(CTX, req, { familyRepo: repo })

    expect(res.body).toMatchObject({ from: '2024-02-01', to: '2024-02-29' })
  })

  it('平年 2 月は to が 02-28 になる', async () => {
    const req = { pathParams: {}, queryParams: { month: '2026-02' }, body: {} }
    const res = await summaryMonthlyHandler(CTX, req, { familyRepo: repo })

    expect(res.body).toMatchObject({ from: '2026-02-01', to: '2026-02-28' })
  })

  it('31 日まである月は to が 01-31 になる', async () => {
    const req = { pathParams: {}, queryParams: { month: '2026-01' }, body: {} }
    const res = await summaryMonthlyHandler(CTX, req, { familyRepo: repo })

    expect(res.body).toMatchObject({ from: '2026-01-01', to: '2026-01-31' })
  })

  it('month クエリ未指定なら JST の今月キーが採用される', async () => {
    const req = { pathParams: {}, queryParams: {}, body: {} }
    const res = await summaryMonthlyHandler(CTX, req, { familyRepo: repo })

    const body = res.body as { month: string }
    expect(body.month).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/)
  })

  it.each(['2026-13', '2026-00', 'abcd-01', '2026-6', '2026/06', ''])(
    'month の形式が不正なら 400 (%s)',
    async (month) => {
      const req = { pathParams: {}, queryParams: { month }, body: {} }
      await expect(summaryMonthlyHandler(CTX, req, { familyRepo: repo })).rejects.toThrow(AppError)
    },
  )
})
