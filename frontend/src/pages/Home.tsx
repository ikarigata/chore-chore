import { useState } from 'react';
import { Check, ArrowLeft, Flame, Loader2, Calendar, ChevronDown } from 'lucide-react';
import { useApp } from '../context';
import { CATEGORIES } from '../constants';
import UserScore from '../components/UserScore';
import DateChipSheet from '../components/DateChipSheet';
import { getJSTDateString } from '../lib/time';
import { springStyle, bounceClass, flatBorder } from '../styles';

const TZ = 'Asia/Tokyo';

function dateBadgeLabel(dateKey: string): string {
  const todayKey = getJSTDateString(new Date());
  const yesterdayKey = getJSTDateString(new Date(Date.now() - 86_400_000));
  if (dateKey === todayKey) return '今日';
  if (dateKey === yesterdayKey) return '昨日';
  const d = new Date(`${dateKey}T00:00:00+09:00`);
  return new Intl.DateTimeFormat('ja-JP', { timeZone: TZ, month: 'numeric', day: 'numeric' }).format(d);
}

export default function Home() {
  const { members, taskMasters, createTaskHistory, processingId, todaySummaries, weeklySummaries } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => getJSTDateString(new Date()));
  const [showDateSheet, setShowDateSheet] = useState(false);

  // 過去14日分の日付配列（古い順、13日前〜今日）
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
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
      {/* メンバー別サマリ（横並びカード） */}
      <div className="flex gap-3">
        {members.map(m => {
          const daily = todaySummaries.find(s => s.cognitoSub === m.cognitoSub)?.dailyPoints ?? 0;
          const weekly = dates.reduce((sum, date) =>
            sum + (weeklySummaries.find(s => s.cognitoSub === m.cognitoSub && s.date === date)?.dailyPoints ?? 0)
          , 0);
          return <UserScore key={m.cognitoSub} user={m} dailyPoints={daily} weeklyPoints={weekly} />;
        })}
      </div>

      {/* 週間グラフカード */}
      <section className={`bg-white rounded-2xl p-4 ${flatBorder} shadow-[4px_4px_0px_#292524]`}>
        <div>
          {/*
           * チャート全体
           * -ml-4 w-[calc(100%+1rem)] でカード左パディング（p-4 = 1rem）にはみ出すことで
           * Y軸ラベル分の余計な右ズレを最小化（32px → 12px）しつつ右端は保持。
           */}
          <div className="relative -ml-4 w-[calc(100%+1rem)]">
            {/* チャート行（Y軸ラベル列 + バーエリアを横並び） */}
            <div className="flex h-24">
              {/* Y軸ラベル（固定幅カラム — カード左パディング内に収まる） */}
              <div className="relative w-7 flex-shrink-0 pointer-events-none">
                <span className="absolute top-0 right-0 -translate-y-1/2 text-[8px] font-bold text-stone-400 leading-none whitespace-nowrap">
                  {maxWeeklyPoints}pt
                </span>
                <span className="absolute top-1/2 right-0 -translate-y-1/2 text-[8px] font-bold text-stone-400 leading-none whitespace-nowrap">
                  {Math.round(maxWeeklyPoints / 2)}pt
                </span>
              </div>

              {/* バーエリア（グリッド線はバー高さに正確に対応） */}
              <div className="relative flex-1">
                <div className="absolute top-0 inset-x-0 border-b border-dashed border-stone-200 z-0" />
                <div className="absolute top-1/2 inset-x-0 border-b border-dashed border-stone-200 z-0" />
                <div className="flex items-end justify-between h-full relative z-10">
                  {dates.map(date => (
                    <div key={date} className="w-3 h-full flex flex-col-reverse justify-start">
                      {members.map(m => {
                        const daily = weeklySummaries?.find(s => s.cognitoSub === m.cognitoSub && s.date === date)?.dailyPoints ?? 0;
                        if (daily === 0) return null;
                        return (
                          <div
                            key={m.cognitoSub}
                            className={`w-full ${m.color} border-x-2 border-t-2 border-stone-800 transition-all duration-500 ease-out first:border-b-2 first:rounded-b-md last:rounded-t-md`}
                            style={{ height: `${(daily / maxWeeklyPoints) * 100}%`, ...springStyle }}
                          />
                        );
                      })}
                      {members.every(m => (weeklySummaries?.find(s => s.cognitoSub === m.cognitoSub && s.date === date)?.dailyPoints ?? 0) === 0) && (
                        <div className="w-full h-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 日付ラベル（Y軸カラム幅 w-7 分インデントしてバーと揃える） */}
            <div className="flex justify-between mt-1 pl-7">
              {dates.map((date, i) => {
                const isToday = i === 13;
                const displayDate = new Date(date).getDate();
                return (
                  <div key={date} className="w-3 flex flex-col items-center">
                    <span className={`text-[8px] font-bold ${isToday ? 'text-brand-teal' : 'text-stone-400'}`}>
                      {isToday ? '今日' : displayDate}
                    </span>
                    {!isToday && (
                      <span className="text-[7px] font-bold leading-none text-stone-400">
                        {new Intl.DateTimeFormat('ja-JP', { weekday: 'narrow', timeZone: 'Asia/Tokyo' }).format(new Date(`${date}T00:00:00+09:00`))}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 家事メニュー */}
      <section>
        {!selectedCategory ? (
          <>
            <h2 className="text-lg font-black mb-3 flex items-center gap-2">
              <Check className="w-5 h-5 text-brand-teal" />
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
              <button
                onClick={() => setShowDateSheet(true)}
                aria-label="実績日を選ぶ"
                className={`ml-auto flex items-center gap-1 px-3 py-1.5 rounded-full bg-white ${flatBorder} ${bounceClass} text-xs font-black shadow-[2px_2px_0px_#292524]`}
                style={springStyle}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{dateBadgeLabel(selectedDateKey)}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            {taskMasters.filter(t => t.categoryId === selectedCategory).map(task => (
              <div key={task.taskId} className={`bg-white p-3 rounded-2xl ${flatBorder} flex items-center justify-between shadow-[2px_2px_0px_#292524]`}>
                <div>
                  <div className="font-bold">{task.taskName}</div>
                  <div className="text-sm font-black text-brand-yellow flex items-center gap-1">
                    <Flame className="w-4 h-4" /> {task.points} pt
                  </div>
                </div>
                <button
                  onClick={() => createTaskHistory(task, { dateKey: selectedDateKey })}
                  disabled={processingId !== null}
                  className={`bg-brand-teal text-white px-4 py-2 rounded-full font-bold ${flatBorder} flex items-center gap-1 transition-all ${processingId === task.taskId ? 'opacity-80 scale-95' : bounceClass}`}
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

      {showDateSheet && (
        <DateChipSheet
          value={selectedDateKey}
          onSelect={setSelectedDateKey}
          onClose={() => setShowDateSheet(false)}
          title="実績日を選ぶ"
        />
      )}
    </div>
  );
}
