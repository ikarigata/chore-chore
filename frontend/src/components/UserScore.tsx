import type { User } from '../types';
import { flatBorder } from '../styles';

interface Props {
  user: User;
  dailyPoints: number;
  weeklyPoints: number;
}

export default function UserScore({ user, dailyPoints, weeklyPoints }: Props) {
  return (
    <div className={`flex-1 rounded-xl p-3 bg-white ${flatBorder}`}>
      {/* ユーザー名 */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <div className={`w-2.5 h-2.5 rounded-full ${user.color} ${flatBorder}`} />
        <span className="text-xs font-black truncate">{user.displayName}</span>
      </div>

      {/* 今日の獲得 — 最も目立つ */}
      <div className="mb-2.5">
        <div className="text-[10px] font-bold text-brand-teal mb-0.5">今日の獲得</div>
        <div className="flex items-baseline gap-0.5 leading-none">
          <span className="text-3xl font-black text-stone-900">{dailyPoints}</span>
          <span className="text-xs font-bold text-stone-400">pt</span>
        </div>
      </div>

      {/* 区切り線 */}
      <div className="border-t-2 border-stone-100 mb-2" />

      {/* 今週の合計 */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold text-stone-400">今週の合計</span>
        <div className="flex items-baseline gap-0.5">
          <span className="text-sm font-black text-stone-700">{weeklyPoints.toLocaleString()}</span>
          <span className="text-[10px] font-bold text-stone-400">pt</span>
        </div>
      </div>

      {/* 累計 */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-stone-400">累計</span>
        <div className="flex items-baseline gap-0.5">
          <span className="text-sm font-black text-stone-700">{user.totalPoints.toLocaleString()}</span>
          <span className="text-[10px] font-bold text-stone-400">pt</span>
        </div>
      </div>
    </div>
  );
}
