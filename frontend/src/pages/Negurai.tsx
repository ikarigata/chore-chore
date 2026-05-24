import { useState } from 'react';
import { HandHeart, Flame, Loader2, Trash2 } from 'lucide-react';
import { useApp } from '../context';
import { flatBorder, bounceClass, springStyle } from '../styles';

export default function Negurai() {
  const { members, mySub, negurai, createNegurai, deleteNegurai, processingId } = useApp();

  const [description, setDescription] = useState('');
  const [points, setPoints] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 自分以外のメンバー（ねぎらった側 = 感謝を表明した人）
  const partner = members.find(m => m.cognitoSub !== mySub);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partner) return;

    const pts = parseInt(points, 10);
    if (!description.trim()) { setError('内容を入力してください'); return; }
    if (isNaN(pts) || pts <= 0) { setError('ポイントは1以上の整数を入力してください'); return; }

    setError(null);
    setSubmitting(true);
    try {
      // 記録者 = 自分（ねぎらわれた側）、ねぎらった側 = partner
      await createNegurai(partner.cognitoSub, description.trim(), pts);
      setDescription('');
      setPoints('');
    } catch {
      setError('登録に失敗しました。もう一度お試しください。');
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

  return (
    <div className="p-4 space-y-6">
      {/* ヘッダー説明 */}
      <section>
        <h2 className="text-lg font-black mb-1 flex items-center gap-2">
          <HandHeart className="w-5 h-5 text-brand-rose" />
          ねぎらいを記録する
        </h2>
        <p className="text-xs text-stone-500 leading-relaxed">
          相手にしてもらったことを記録します。<br />
          ねぎらってくれた相手がポイントを獲得します。
        </p>
      </section>

      {/* 登録フォーム */}
      <form onSubmit={handleSubmit}>
        <div className={`bg-white rounded-2xl p-4 ${flatBorder} shadow-[4px_4px_0px_#292524] space-y-4`}>
          {partner ? (
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${partner.color} ${flatBorder}`} />
              <span className="text-sm font-black">{partner.displayName}</span>
              <span className="text-xs text-stone-400">がねぎらってくれた</span>
            </div>
          ) : (
            <p className="text-xs text-stone-400">パートナーが見つかりません</p>
          )}

          <div>
            <label className="block text-xs font-bold text-stone-600 mb-1">何をしてもらいましたか？</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="例: コーヒーを買ってきてくれた、マッサージしてくれた"
              rows={2}
              className={`w-full px-3 py-2 text-sm rounded-xl ${flatBorder} bg-amber-50 focus:outline-none focus:ring-2 focus:ring-brand-teal resize-none`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-600 mb-1">ポイント</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={points}
                onChange={e => setPoints(e.target.value)}
                min={1}
                placeholder="10"
                className={`w-24 px-3 py-2 text-sm rounded-xl ${flatBorder} bg-amber-50 focus:outline-none focus:ring-2 focus:ring-brand-teal`}
              />
              <span className="text-xs font-bold text-stone-400">pt</span>
            </div>
          </div>

          {error && (
            <p className="text-xs font-bold text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !partner}
            className={`w-full bg-brand-rose text-white py-3 rounded-xl font-black ${flatBorder} flex items-center justify-center gap-2 shadow-[2px_2px_0px_#292524] ${submitting ? 'opacity-70' : bounceClass}`}
            style={springStyle}
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <HandHeart className="w-5 h-5" />
                ねぎらいを記録
              </>
            )}
          </button>
        </div>
      </form>

      {/* ねぎらい履歴 */}
      <section>
        <h3 className="text-sm font-black text-stone-600 mb-3">ねぎらい履歴</h3>
        {negurai.length === 0 ? (
          <div className="text-center py-8 text-stone-400 font-bold border-2 border-dashed border-stone-300 rounded-2xl text-sm">
            まだねぎらいがありません
          </div>
        ) : (
          <div className="space-y-3">
            {negurai.map(item => {
              const isMyRecord = item.receiverSub === mySub;
              return (
                <div key={item.neguraiId} className={`bg-white rounded-2xl p-3 ${flatBorder} shadow-[2px_2px_0px_#292524]`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-stone-400 mb-0.5">
                        <span className="font-bold text-stone-600">{getMemberName(item.giverSub)}</span>
                        　→
                        <span className="font-bold text-stone-600">{getMemberName(item.receiverSub)}</span>
                        　{formatTimestamp(item.timestamp)}
                      </div>
                      <div className="text-sm font-bold text-stone-800 truncate">{item.description}</div>
                      <div className="flex items-center gap-1 mt-1 text-brand-rose">
                        <Flame className="w-3.5 h-3.5" />
                        <span className="text-xs font-black">{item.points} pt</span>
                      </div>
                    </div>
                    {isMyRecord && (
                      <button
                        onClick={() => deleteNegurai(item)}
                        disabled={processingId === item.neguraiId}
                        className={`p-1.5 rounded-lg border-2 border-stone-300 text-stone-400 hover:border-red-400 hover:text-red-400 transition-colors ${bounceClass}`}
                        style={springStyle}
                        aria-label="ねぎらいを取り消す"
                      >
                        {processingId === item.neguraiId ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
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
