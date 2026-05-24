import { useState } from 'react';
import { ScrollText, Undo2, Loader2, Calendar } from 'lucide-react';
import { useApp } from '../context';
import { CATEGORIES } from '../constants';
import { flatBorder } from '../styles';
import DateChipSheet from '../components/DateChipSheet';
import type { TaskHistory } from '../types';

const TZ = 'Asia/Tokyo';

/** JST での YYYY-MM-DD 文字列を返す */
function toJstDateKey(timestamp: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(new Date(timestamp));
}

/** 日付ラベル（今日／昨日／M月D日）を返す */
function formatDateLabel(dateKey: string): string {
  const todayKey = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(new Date());
  const yesterdayKey = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(
    new Date(Date.now() - 86_400_000),
  );
  if (dateKey === todayKey) return '今日';
  if (dateKey === yesterdayKey) return '昨日';
  const [, m, d] = dateKey.split('-');
  return `${parseInt(m)}月${parseInt(d)}日`;
}

/** 履歴を JST 日付でグルーピング（新しい順） */
function groupByDate(histories: TaskHistory[]): { dateKey: string; items: TaskHistory[] }[] {
  const map = new Map<string, TaskHistory[]>();
  for (const item of histories) {
    const key = toJstDateKey(item.timestamp);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, items]) => ({ dateKey, items }));
}

export default function History() {
  const { taskHistories, members, taskMasters, mySub, deleteTaskHistory, updateTaskHistoryDate, processingId } = useApp();
  const [actionError, setActionError] = useState('');
  const [editing, setEditing] = useState<TaskHistory | null>(null);

  const handleCancel = async (item: TaskHistory) => {
    setActionError('');
    try {
      await deleteTaskHistory(item);
    } catch (err) {
      setActionError((err as Error).message ?? '取り消しに失敗しました');
    }
  };

  const handleEditDate = async (newDateKey: string) => {
    if (!editing) return;
    const target = editing;
    setActionError('');
    try {
      await updateTaskHistoryDate(target, newDateKey);
    } catch (err) {
      setActionError((err as Error).message ?? '日付変更に失敗しました');
    }
  };

  const groups = groupByDate(taskHistories);

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-black flex items-center gap-2">
        <ScrollText className="w-5 h-5 text-orange-500" />
        みんなの履歴
      </h2>

      {actionError && (
        <p className="text-sm font-bold text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {actionError}
        </p>
      )}

      {taskHistories.length === 0 ? (
        <div className="text-center py-12 text-stone-500 font-bold bg-white rounded-2xl border-2 border-dashed border-stone-300">
          まだ履歴がありません
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ dateKey, items }) => (
            <div key={dateKey}>
              {/* 日付セパレーター */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-black text-stone-500 bg-stone-100 border border-stone-200 rounded-full px-3 py-1 shrink-0">
                  {formatDateLabel(dateKey)}
                </span>
                <div className="flex-1 h-px bg-stone-200" />
              </div>

              {/* その日の履歴一覧 */}
              <div className="space-y-2 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-stone-300 before:to-transparent">
                {items.map(item => {
                  const categoryId = taskMasters.find(t => t.taskId === item.taskId)?.categoryId;
                  const cat = (CATEGORIES.find(c => c.id === categoryId) ?? CATEGORIES.find(c => c.id === 'other'))!;
                  const member = members.find(m => m.cognitoSub === item.cognitoSub);
                  const isMe = item.cognitoSub === mySub;
                  const ts = new Date(item.timestamp);
                  const isProcessing = processingId === item.taskExecutionId;
                  const timeLabel = new Intl.DateTimeFormat('ja-JP', {
                    timeZone: TZ,
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  }).format(ts);
                  return (
                    <div key={item.taskExecutionId} className="relative flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                      {/* カテゴリアイコン（カテゴリ背景色で種類を一目で識別） */}
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 border-stone-800 ${cat.color} shadow shrink-0 z-10`}>
                        <cat.icon className="w-4 h-4 text-stone-700" />
                      </div>

                      {/* カード */}
                      <div className={`flex-1 px-3 py-2 rounded-2xl bg-white ${flatBorder} shadow-[2px_2px_0px_#292524]`}>
                          {/* 上段: 家事名 + ポイントバッジ */}
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-bold text-sm leading-snug flex-1">
                              {taskMasters.find(t => t.taskId === item.taskId)?.taskName ?? item.taskId}
                            </span>
                            <span className="text-xs font-black text-brand-teal bg-brand-teal/10 px-2 py-0.5 rounded-full border border-brand-teal/30 shrink-0">
                              +{item.points}pt
                            </span>
                          </div>
                          {/* 下段: メンバー · 時刻 ｜ 取り消し */}
                          <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-stone-100">
                            {/* 左: メンバーと時刻をひとまとめ */}
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-stone-500">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${member?.color ?? 'bg-stone-300'}`} />
                              <span>{isMe ? 'あなた' : (member?.displayName ?? '不明')}</span>
                              <span className="text-stone-300">·</span>
                              <span className="text-stone-400">{timeLabel}</span>
                            </div>
                            {/* 右: 日付変更・取り消しボタン（自分の実績のみ） */}
                            {isMe && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => setEditing(item)}
                                  disabled={processingId !== null}
                                  title="日付を変更"
                                  className={`p-1.5 rounded-lg text-stone-400 hover:text-brand-teal hover:bg-brand-teal/10 transition-colors disabled:opacity-40 ${flatBorder}`}
                                >
                                  <Calendar className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleCancel(item)}
                                  disabled={processingId !== null}
                                  title="取り消す"
                                  className={`p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 ${flatBorder}`}
                                >
                                  {isProcessing
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <Undo2 className="w-4 h-4" />}
                                </button>
                              </div>
                            )}
                          </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <DateChipSheet
          value={toJstDateKey(editing.timestamp)}
          onSelect={handleEditDate}
          onClose={() => setEditing(null)}
          title="実績日を変更"
        />
      )}
    </div>
  );
}
