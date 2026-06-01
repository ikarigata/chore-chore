import { useEffect, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../context'
import MonthGrid from '../components/MonthGrid'
import { currentMonthKey, nextMonth, prevMonth } from '../lib/calendar'
import { flatBorder } from '../styles'

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-')
  return `${y}年${Number(m)}月`
}

export default function Calendar() {
  const { members, monthlySummaries, fetchMonthlySummaries } = useApp()
  const [thisMonth] = useState(currentMonthKey())
  const [monthKey, setMonthKey] = useState(thisMonth)
  const [error, setError] = useState<string | null>(null)

  const minMonth = prevMonth(thisMonth)
  const maxMonth = thisMonth
  const canPrev = monthKey > minMonth
  const canNext = monthKey < maxMonth

  useEffect(() => {
    if (monthlySummaries[monthKey]) return
    fetchMonthlySummaries(monthKey).catch(e =>
      setError(e instanceof Error ? e.message : 'カレンダーの取得に失敗しました'),
    )
  }, [monthKey, monthlySummaries, fetchMonthlySummaries])

  const summaries = monthlySummaries[monthKey]
  const loading = !summaries && !error

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-black flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-brand-teal" />
        カレンダー
      </h2>

      <div className={`bg-white rounded-2xl p-3 ${flatBorder} shadow-[4px_4px_0px_#292524] space-y-3`}>
        <div className="flex items-center justify-between">
          <button
            onClick={() => setMonthKey(prevMonth(monthKey))}
            disabled={!canPrev}
            aria-label="前月"
            className={`p-1.5 rounded-full ${flatBorder} bg-white disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-black text-base">{monthLabel(monthKey)}</span>
          <button
            onClick={() => setMonthKey(nextMonth(monthKey))}
            disabled={!canNext}
            aria-label="次月"
            className={`p-1.5 rounded-full ${flatBorder} bg-white disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <p className="text-sm font-bold text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-4 border-brand-teal border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <MonthGrid monthKey={monthKey} members={members} summaries={summaries ?? []} />
        )}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-stone-600 px-1">
        {members.map(m => (
          <div key={m.cognitoSub} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${m.color} border border-stone-800`} />
            <span className="font-bold">{m.displayName}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
