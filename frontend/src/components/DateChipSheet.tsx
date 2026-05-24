import { X, Check } from 'lucide-react'
import { flatBorder, bounceClass, springStyle } from '../styles'
import { getRecentDateKeys } from '../lib/time'

interface DateChipSheetProps {
  value: string
  onSelect: (dateKey: string) => void
  onClose: () => void
  title?: string
}

const TZ = 'Asia/Tokyo'

function labelFor(dateKey: string, todayKey: string, yesterdayKey: string): string {
  if (dateKey === todayKey) return '今日'
  if (dateKey === yesterdayKey) return '昨日'
  const d = new Date(`${dateKey}T00:00:00+09:00`)
  const md = new Intl.DateTimeFormat('ja-JP', {
    timeZone: TZ,
    month: 'numeric',
    day: 'numeric',
  }).format(d)
  const weekday = new Intl.DateTimeFormat('ja-JP', {
    timeZone: TZ,
    weekday: 'short',
  }).format(d)
  return `${md}（${weekday}）`
}

export default function DateChipSheet({ value, onSelect, onClose, title = '日付を選ぶ' }: DateChipSheetProps) {
  const keys = getRecentDateKeys(7)
  const todayKey = keys[0]!
  const yesterdayKey = keys[1]!

  return (
    <div
      className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`bg-white w-full max-w-sm rounded-3xl p-6 ${flatBorder} shadow-[8px_8px_0px_#292524] relative animate-in zoom-in-95 duration-200`}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className={`absolute top-4 right-4 p-2 bg-stone-100 rounded-full ${flatBorder} ${bounceClass}`}>
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-black mb-5 text-center">{title}</h3>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto px-1 pb-1">
          {keys.map(dateKey => {
            const isSelected = dateKey === value
            return (
              <button
                key={dateKey}
                onClick={() => {
                  onSelect(dateKey)
                  onClose()
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl ${flatBorder} font-bold ${bounceClass} ${
                  isSelected ? 'bg-brand-teal text-white shadow-[2px_2px_0px_#292524]' : 'bg-white'
                }`}
                style={springStyle}
              >
                <span>{labelFor(dateKey, todayKey, yesterdayKey)}</span>
                {isSelected && <Check className="w-5 h-5" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
