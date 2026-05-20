import { describe, expect, it, beforeEach } from 'vitest'
import { summaryDailyHandler } from '../../handlers/summaryDaily.js'
import { MockFamilyRepository } from '../mocks/MockFamilyRepository.js'

const CTX = { familyId: 'family-1', cognitoSub: 'sub-1' }

describe('summaryDailyHandler', () => {
  let repo: MockFamilyRepository

  beforeEach(() => {
    repo = new MockFamilyRepository()
    repo.dailySummaries = [
      { cognitoSub: 'sub-1', date: '2024-06-15', dailyPoints: 30 },
      { cognitoSub: 'sub-2', date: '2024-06-15', dailyPoints: 20 },
    ]
  })

  it('サマリを返して 200 を返す', async () => {
    const req = { pathParams: {}, queryParams: { date: '2024-06-15' }, body: {} }
    const res = await summaryDailyHandler(CTX, req, { familyRepo: repo })

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ date: '2024-06-15', summaries: repo.dailySummaries })
  })

  it('date クエリパラメータがない場合は今日の JST 日付を使う', async () => {
    const req = { pathParams: {}, queryParams: {}, body: {} }
    const res = await summaryDailyHandler(CTX, req, { familyRepo: repo })

    expect(res.statusCode).toBe(200)
    const body = res.body as { date: string }
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
