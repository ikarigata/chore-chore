import { useState } from 'react';
import { Check, ArrowLeft, Flame, Loader2 } from 'lucide-react';
import { useApp } from '../context';
import { CATEGORIES } from '../constants';
import UserScore from '../components/UserScore';
import { springStyle, bounceClass, flatBorder } from '../styles';

export default function Home() {
  const { members, taskMasters, createTaskHistory, processingId, todaySummaries, weeklySummaries } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // 過去7日分の日付配列（古い順）
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(d);
  });

  // 日ごとの合計ポイントの最大値（Y軸のスケール用、最小100）
  const maxWeeklyPoints = Math.max(
    ...dates.map(date => 
      members.reduce((sum, m) => 
        sum + (weeklySummaries?.find(s => s.cognitoSub === m.cognitoSub && s.date === date)?.dailyPoints ?? 0)
      , 0)
    ),
    100
  );

  return (
    <div className="p-4 space-y-6">
      {/* ダッシュボード */}
      <section className={`bg-white rounded-2xl p-4 ${flatBorder} shadow-[4px_4px_0px_#292524]`}>
        <div className="flex justify-between items-end mb-4">
          <div className="flex gap-4">
            {members.map(m => {
              const daily = todaySummaries.find(s => s.cognitoSub === m.cognitoSub)?.dailyPoints ?? 0;
              return <UserScore key={m.cognitoSub} user={m} dailyPoints={daily} />;
            })}
          </div>
        </div>

        <div className="h-32 relative flex items-end justify-between pt-4 border-t-2 border-stone-100">
          <div className="absolute top-0 w-full border-b border-dashed border-stone-200"></div>
          <div className="absolute top-1/2 w-full border-b border-dashed border-stone-200"></div>

          {dates.map((date, i) => {
            const isToday = i === 6;
            const displayDate = new Date(date).getDate(); // 日にちだけ表示
            return (
              <div key={date} className="flex flex-col items-center gap-1 flex-1 z-10">
                <div className="flex flex-col-reverse w-4 h-24 justify-start">
                  {members.map(m => {
                    const daily = weeklySummaries?.find(s => s.cognitoSub === m.cognitoSub && s.date === date)?.dailyPoints ?? 0;
                    if (daily === 0) return null;
                    return (
                      <div
                        key={m.cognitoSub}
                        className={`w-full ${m.color} border-x border-t border-stone-800 transition-all duration-500 ease-out first:rounded-b-sm last:rounded-t-sm`}
                        style={{ height: `${(daily / maxWeeklyPoints) * 100}%`, ...springStyle }}
                      />
                    );
                  })}
                  {members.every(m => (weeklySummaries?.find(s => s.cognitoSub === m.cognitoSub && s.date === date)?.dailyPoints ?? 0) === 0) && (
                    <div className="w-full h-0" />
                  )}
                </div>
                <span className={`text-[10px] font-bold ${isToday ? 'text-teal-600' : 'text-stone-400'}`}>
                  {isToday ? '今日' : displayDate}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 家事メニュー */}
      <section>
        {!selectedCategory ? (
          <>
            <h2 className="text-lg font-black mb-3 flex items-center gap-2">
              <Check className="w-5 h-5 text-teal-500" />
              家事を記録する
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex flex-col items-center p-3 rounded-2xl ${flatBorder} bg-white ${bounceClass} shadow-[2px_2px_0px_#292524]`}
                  style={springStyle}
                >
                  <div className={`w-10 h-10 rounded-full ${cat.color} ${flatBorder} flex items-center justify-center mb-2`}>
                    <cat.icon className="w-5 h-5 text-stone-800" />
                  </div>
                  <span className="font-bold text-xs">{cat.name}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`p-2 bg-white rounded-full ${flatBorder} ${bounceClass}`}
                style={springStyle}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-black">
                {CATEGORIES.find(c => c.id === selectedCategory)?.name}の家事
              </h2>
            </div>

            {taskMasters.filter(t => t.categoryId === selectedCategory).map(task => (
              <div key={task.taskId} className={`bg-white p-3 rounded-2xl ${flatBorder} flex items-center justify-between shadow-[2px_2px_0px_#292524]`}>
                <div>
                  <div className="font-bold">{task.taskName}</div>
                  <div className="text-sm font-black text-yellow-600 flex items-center gap-1">
                    <Flame className="w-4 h-4" /> {task.points} pt
                  </div>
                </div>
                <button
                  onClick={() => createTaskHistory(task)}
                  disabled={processingId !== null}
                  className={`bg-teal-200 px-4 py-2 rounded-full font-bold ${flatBorder} flex items-center gap-1 transition-all ${processingId === task.taskId ? 'opacity-80 scale-95' : bounceClass}`}
                  style={springStyle}
                >
                  {processingId === task.taskId ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      やった！
                    </>
                  )}
                </button>
              </div>
            ))}

            {taskMasters.filter(t => t.categoryId === selectedCategory).length === 0 && (
              <div className="text-center py-8 text-stone-500 font-bold border-2 border-dashed border-stone-300 rounded-2xl">
                このカテゴリの家事はありません
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
