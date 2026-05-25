import { useState } from 'react';
import { StickyNote, Loader2, Trash2, Plus } from 'lucide-react';
import { useApp } from '../context';
import { flatBorder, bounceClass, springStyle } from '../styles';
import type { Memo } from '../types';

const MAX_CONTENT_LENGTH = 500;

export default function MemoPage() {
  const { members, memos, createMemo, deleteMemo, processingId } = useApp();

  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) { setError('内容を入力してください'); return; }
    if (trimmed.length > MAX_CONTENT_LENGTH) { setError(`${MAX_CONTENT_LENGTH}文字以内で入力してください`); return; }

    setError(null);
    setSubmitting(true);
    try {
      await createMemo(trimmed);
      setContent('');
    } catch {
      setError('追加に失敗しました。もう一度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  };

  const getMemberName = (sub: string) =>
    members.find(m => m.cognitoSub === sub)?.displayName ?? sub;

  const getMemberIcon = (sub: string) =>
    members.find(m => m.cognitoSub === sub)?.icon ?? null;

  return (
    <div className="p-4 space-y-6">
      {/* ヘッダー説明 */}
      <section>
        <h2 className="text-lg font-black mb-1 flex items-center gap-2">
          <StickyNote className="w-5 h-5 text-brand-teal" />
          メモ
        </h2>
        <p className="text-xs text-stone-500 leading-relaxed">
          「近いうちにやらなきゃ」「あれ買わなきゃ」などを<br />
          家族と共有できます。
        </p>
      </section>

      {/* 追加フォーム */}
      <form onSubmit={handleSubmit}>
        <div className={`bg-white rounded-2xl p-4 ${flatBorder} shadow-[4px_4px_0px_#292524] space-y-4`}>
          <div>
            <label className="block text-xs font-bold text-stone-600 mb-1">
              メモの内容
              <span className={`ml-2 font-normal ${content.length > MAX_CONTENT_LENGTH ? 'text-red-500' : 'text-stone-400'}`}>
                {content.length}/{MAX_CONTENT_LENGTH}
              </span>
            </label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="例: 牛乳買う、お風呂のカビ取り近いうちにやる"
              rows={2}
              className={`w-full px-3 py-2 text-sm rounded-xl ${flatBorder} bg-amber-50 focus:outline-none focus:ring-2 focus:ring-brand-teal resize-none`}
            />
          </div>

          {error && (
            <p className="text-xs font-bold text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className={`w-full bg-brand-teal text-white py-3 rounded-xl font-black ${flatBorder} flex items-center justify-center gap-2 shadow-[2px_2px_0px_#292524] ${submitting || !content.trim() ? 'opacity-70' : bounceClass}`}
            style={springStyle}
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Plus className="w-5 h-5" />
                追加する
              </>
            )}
          </button>
        </div>
      </form>

      {/* メモ一覧 */}
      <section>
        <h3 className="text-sm font-black text-stone-600 mb-3">共有メモ</h3>
        {memos.length === 0 ? (
          <div className="text-center py-8 text-stone-400 font-bold border-2 border-dashed border-stone-300 rounded-2xl text-sm">
            まだメモがありません
          </div>
        ) : (
          <div className="space-y-3">
            {memos.map((item: Memo) => {
              const icon = getMemberIcon(item.authorSub);
              const name = getMemberName(item.authorSub);
              return (
                <div key={item.memoId} className={`bg-white rounded-2xl p-3 ${flatBorder} shadow-[2px_2px_0px_#292524]`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-stone-400 mb-1 flex items-center gap-1">
                        {icon ? (
                          <span className="text-base leading-none">{icon}</span>
                        ) : null}
                        <span className="font-bold text-stone-600">{name}</span>
                        <span className="mx-1">·</span>
                        <span>{formatTimestamp(item.timestamp)}</span>
                      </div>
                      <p className="text-sm font-bold text-stone-800 whitespace-pre-wrap break-words">{item.content}</p>
                    </div>
                    <button
                      onClick={() => deleteMemo(item)}
                      disabled={processingId === item.memoId}
                      className={`shrink-0 p-1.5 rounded-lg border-2 border-stone-300 text-stone-400 hover:border-red-400 hover:text-red-400 transition-colors ${bounceClass}`}
                      style={springStyle}
                      aria-label="メモを削除"
                    >
                      {processingId === item.memoId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
