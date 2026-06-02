import type { User } from '../types'
import { flatBorder } from '../styles'

interface Props {
  dayNumber: number
  isCurrentMonth: boolean
  isToday: boolean
  members: User[]
  activeSubs: Set<string>
}

const MAX_BADGES = 4

export default function DayCell({ dayNumber, isCurrentMonth, isToday, members, activeSubs }: Props) {
  const slots = members.slice(0, MAX_BADGES)
  const overflow = members.length - slots.length

  return (
    <div
      className={[
        'aspect-[2/3] flex flex-col items-center justify-between p-1 rounded-md',
        isCurrentMonth ? 'bg-white' : 'bg-stone-50 opacity-40',
        isToday ? 'ring-2 ring-brand-teal' : '',
      ].join(' ')}
    >
      <span className={`text-[10px] font-bold leading-none mt-0.5 ${isToday ? 'text-brand-teal' : 'text-stone-600'}`}>
        {dayNumber}
      </span>
      <div className="flex flex-col gap-0.5 items-center min-h-[10px]">
        {slots.map(m => {
          const isActive = activeSubs.has(m.cognitoSub)
          return (
            <span
              key={m.cognitoSub}
              className={`w-3.5 h-3.5 rounded-full ${m.color} ${flatBorder} border ${isActive ? '' : 'invisible'}`}
              title={m.displayName}
              aria-hidden={!isActive}
            />
          )
        })}
        {overflow > 0 && (
          <span className="text-[8px] font-bold leading-none text-stone-500">+{overflow}</span>
        )}
      </div>
    </div>
  )
}
