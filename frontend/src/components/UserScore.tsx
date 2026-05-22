import type { User } from '../types';
import { flatBorder } from '../styles';

export default function UserScore({ user, dailyPoints }: { user: User; dailyPoints: number }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <div className={`w-3 h-3 rounded-full ${user.color} ${flatBorder}`}></div>
        <span className="text-sm font-bold">{user.displayName}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-black leading-none">{dailyPoints}</span>
        <span className="text-xs font-bold text-stone-500">pt</span>
      </div>
      <div className="text-[10px] font-bold text-stone-400 mt-0.5">
        累計: {user.totalPoints} pt
      </div>
    </div>
  );
}
