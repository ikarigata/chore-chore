import { useState } from 'react';
import { Check, ArrowLeft, Flame, Loader2 } from 'lucide-react';
import { useApp } from '../context';
import { CATEGORIES } from '../constants';
import UserScore from '../components/UserScore';
import { springStyle, bounceClass, flatBorder } from '../styles';

export default function Home() {
  const { members, tasks, executeTask, loadingTaskId, todaySummaries } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const maxPoints = Math.max(
    ...members.map(m => todaySummaries.find(s => s.cognitoSub === m.cognitoSub)?.dailyPoints ?? 0),
    100,
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

        <div className="h-24 relative flex items-end justify-around pt-4 border-t-2 border-stone-100">
          <div className="absolute top-0 w-full border-b border-dashed border-stone-200"></div>
          <div className="absolute top-1/2 w-full border-b border-dashed border-stone-200"></div>

          {members.map(m => {
            const daily = todaySummaries.find(s => s.cognitoSub === m.cognitoSub)?.dailyPoints ?? 0;
            return (
              <div key={m.cognitoSub} className="flex flex-col items-center gap-1 flex-1 z-10">
                <div className="flex gap-1 h-16 items-end">
                  <div
                    className={`w-4 ${m.color} rounded-t-sm border-x border-t border-stone-800 transition-all duration-500 ease-out`}
                    style={{ height: `${(daily / maxPoints) * 100}%`, ...springStyle }}
                  />
                </div>
                <span className="text-[10px] font-bold text-stone-500">{m.displayName}</span>
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

            {tasks.filter(t => t.categoryId === selectedCategory).map(task => (
              <div key={task.taskId} className={`bg-white p-3 rounded-2xl ${flatBorder} flex items-center justify-between shadow-[2px_2px_0px_#292524]`}>
                <div>
                  <div className="font-bold">{task.taskName}</div>
                  <div className="text-sm font-black text-yellow-600 flex items-center gap-1">
                    <Flame className="w-4 h-4" /> {task.points} pt
                  </div>
                </div>
                <button
                  onClick={() => executeTask(task)}
                  disabled={loadingTaskId !== null}
                  className={`bg-teal-200 px-4 py-2 rounded-full font-bold ${flatBorder} flex items-center gap-1 transition-all ${loadingTaskId === task.taskId ? 'opacity-80 scale-95' : bounceClass}`}
                  style={springStyle}
                >
                  {loadingTaskId === task.taskId ? (
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

            {tasks.filter(t => t.categoryId === selectedCategory).length === 0 && (
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
