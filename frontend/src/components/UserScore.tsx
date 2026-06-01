import type { User } from '../types';
import { flatBorder } from '../styles';

interface Props {
  user: User;
  dailyPoints: number;
  weeklyPoints: number;
}

export default function UserScore({ user, dailyPoints, weeklyPoints }: Props) {
  return (
    <div className={`relative flex-1 rounded-2xl p-3 bg-white ${flatBorder} shadow-[4px_4px_0px_#292524]`}>
        {/* アイコンバッジ（カード右上の空きスペースに収める） */}
        {user.icon && (
          <div
            className={`absolute top-3 right-3 w-14 h-14 rounded-full ${user.color} ${flatBorder} shadow-[2px_2px_0px_#292524] flex items-center justify-center text-3xl leading-none pointer-events-none`}
            aria-hidden="true"
          >
            {user.icon}
          </div>
        )}

        {/* ユーザー名 */}
        <div className="flex items-center gap-1.5 mb-2.5 pr-16">
          <div className={`w-2.5 h-2.5 rounded-full ${user.color} ${flatBorder}`} />
          <span className="text-xs font-black truncate">{user.displayName}</span>
        </div>

        {/* 今日の獲得 — 最も目立つ */}
        <div className="mb-2.5 pr-16">
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
          <span className="text-[10px] font-bold text-stone-400">2週間の合計</span>
          <div className="flex items-baseline gap-0.5">
            <span className="text-sm font-black text-stone-700">{weeklyPoints.toLocaleString()}</span>
            <span className="text-[10px] font-bold text-stone-400">pt</span>
          </div>
        </div>

        {/* 家事累計 */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-stone-400">家事累計</span>
          <div className="flex items-baseline gap-0.5">
            <span className="text-sm font-black text-stone-700">{user.totalPoints.toLocaleString()}</span>
            <span className="text-[10px] font-bold text-stone-400">pt</span>
          </div>
        </div>

        {/* ねぎらい累計 */}
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] font-bold text-brand-sky">ねぎらい</span>
          <div className="flex items-baseline gap-0.5">
            <span className="text-sm font-black text-brand-sky">{(user.neguraiPoints ?? 0).toLocaleString()}</span>
            <span className="text-[10px] font-bold text-stone-400">pt</span>
          </div>
        </div>

        {/* トータル */}
        <div className="flex items-center justify-between mt-1 pt-1 border-t border-dashed border-stone-200">
          <span className="text-[10px] font-bold text-stone-600">トータル</span>
          <div className="flex items-baseline gap-0.5">
            <span className="text-sm font-black text-stone-900">{(user.totalPoints + (user.neguraiPoints ?? 0)).toLocaleString()}</span>
            <span className="text-[10px] font-bold text-stone-400">pt</span>
          </div>
        </div>
    </div>
  );
}
