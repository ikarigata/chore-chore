import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AppProvider } from '../context'
import Calendar from '../pages/Calendar'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { currentMonthKey, prevMonth, nextMonth } from '../lib/calendar'

const thisMonth = currentMonthKey()
const lastMonth = prevMonth(thisMonth)
const futureMonth = nextMonth(thisMonth)

const requestedMonths: string[] = []

const server = setupServer(
  http.get('*/family/init', () =>
    HttpResponse.json({
      users: [
        { cognitoSub: 'user1', displayName: 'パパ', totalPoints: 100 },
        { cognitoSub: 'user2', displayName: 'ママ', totalPoints: 120 },
      ],
      taskMasters: [],
    }),
  ),
  http.get('*/summary/daily', () => HttpResponse.json({ date: '2026-06-01', summaries: [] })),
  http.get('*/summary/weekly', () =>
    HttpResponse.json({ from: '2026-05-18', to: '2026-06-01', summaries: [] }),
  ),
  http.get('*/histories', () => HttpResponse.json({ taskHistories: [] })),
  http.get('*/negurai', () => HttpResponse.json({ negurai: [] })),
  http.get('*/memos', () => HttpResponse.json({ memos: [] })),
  http.get('*/summary/monthly', ({ request }) => {
    const url = new URL(request.url)
    const month = url.searchParams.get('month') ?? thisMonth
    requestedMonths.push(month)
    const day = `${month}-15`
    return HttpResponse.json({
      month,
      from: `${month}-01`,
      to: `${month}-28`,
      summaries: [
        { cognitoSub: 'user1', date: day, dailyPoints: 10 },
        { cognitoSub: 'user2', date: day, dailyPoints: 20 },
      ],
    })
  }),
)

beforeAll(() => server.listen())
beforeEach(() => {
  requestedMonths.length = 0
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({
    tokens: {
      idToken: { payload: { sub: 'user1' }, toString: () => 'mock-token' },
    },
  }),
}))

describe('Calendar Page', () => {
  it('初期表示で今月のサマリを取得し、両メンバー分のバッジが描画される', async () => {
    render(
      <AppProvider>
        <Calendar />
      </AppProvider>,
    )

    await waitFor(() => expect(requestedMonths).toContain(thisMonth))

    const day15 = await screen.findByText('15')
    const cell = day15.parentElement!
    const badges = cell.querySelectorAll('span.rounded-full')
    expect(badges.length).toBeGreaterThanOrEqual(2)
  })

  it('次月ボタンは無効（今月より先には進めない）', async () => {
    render(
      <AppProvider>
        <Calendar />
      </AppProvider>,
    )
    await waitFor(() => expect(requestedMonths).toContain(thisMonth))
    const nextBtn = screen.getByLabelText('次月') as HTMLButtonElement
    expect(nextBtn.disabled).toBe(true)
    expect(requestedMonths).not.toContain(futureMonth)
  })

  it('前月ボタンで先月のサマリを取得する', async () => {
    render(
      <AppProvider>
        <Calendar />
      </AppProvider>,
    )
    await waitFor(() => expect(requestedMonths).toContain(thisMonth))

    fireEvent.click(screen.getByLabelText('前月'))

    await waitFor(() => expect(requestedMonths).toContain(lastMonth))
  })

  it('先月まで遡ったら前月ボタンが無効になる（2 ヶ月制約）', async () => {
    render(
      <AppProvider>
        <Calendar />
      </AppProvider>,
    )
    await waitFor(() => expect(requestedMonths).toContain(thisMonth))

    fireEvent.click(screen.getByLabelText('前月'))
    await waitFor(() => expect(requestedMonths).toContain(lastMonth))

    const prevBtn = screen.getByLabelText('前月') as HTMLButtonElement
    expect(prevBtn.disabled).toBe(true)
  })
})
