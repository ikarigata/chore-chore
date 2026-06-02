import type { DailySummary, User } from '../types'
import { buildMonthGrid, isInMonth } from '../lib/calendar'
import { getJSTDateString } from '../lib/time'
import DayCell from './DayCell'

interface Props {
  monthKey: string
  members: User[]
  summaries: DailySummary[]
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function buildActivityMap(summaries: DailySummary[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const s of summaries) {
    if (s.dailyPoints <= 0) continue
    let set = map.get(s.date)
    if (!set) {
      set = new Set()
      map.set(s.date, set)
    }
    set.add(s.cognitoSub)
  }
  return map
}

export default function MonthGrid({ monthKey, members, summaries }: Props) {
  const grid = buildMonthGrid(monthKey)
  const activity = buildActivityMap(summaries)
  const todayKey = getJSTDateString(new Date())

  return (
    <div className="grid grid-cols-7 gap-1">
      {WEEKDAYS.map((w, i) => (
        <div
          key={w}
          className={`text-center text-[10px] font-black pb-1 ${
            i === 0 ? 'text-rose-500' : i === 6 ? 'text-sky-500' : 'text-stone-500'
          }`}
        >
          {w}
        </div>
      ))}
      {grid.map(dateKey => {
        const inMonth = isInMonth(dateKey, monthKey)
        const subs = activity.get(dateKey) ?? new Set<string>()
        const dayNumber = Number(dateKey.split('-')[2])
        return (
          <DayCell
            key={dateKey}
            dayNumber={dayNumber}
            isCurrentMonth={inMonth}
            isToday={inMonth && dateKey === todayKey}
            members={members}
            activeSubs={subs}
          />
        )
      })}
    </div>
  )
}
