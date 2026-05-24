import { useState } from 'react';
import { QrCode, Plus, Trash2, Loader2, Pencil, X, Check, User as UserIcon } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { useApp } from '../context';
import { CATEGORIES, USER_ICONS } from '../constants';
import { springStyle, bounceClass, flatBorder } from '../styles';
import type { LayoutOutletContext } from '../components/Layout';
import PointInput from '../components/PointInput';

export default function Settings() {
  const { members, mySub, taskMasters, updateMyProfile, upsertTaskMaster, deleteTaskMaster } = useApp();
  const { onOpenQr } = useOutletContext<LayoutOutletContext>();

  const me = members.find(m => m.cognitoSub === mySub);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');

  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [savingIcon, setSavingIcon] = useState<string | null>(null);

  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskPoints, setNewTaskPoints] = useState(10);
  const [newTaskCat, setNewTaskCat] = useState('cooking');
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskName, setEditTaskName] = useState('');
  const [editTaskPoints, setEditTaskPoints] = useState(10);
  const [editTaskCat, setEditTaskCat] = useState('cooking');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleUpdateTaskMaster = async (e: React.FormEvent, taskId: string) => {
    e.preventDefault();
    if (!editTaskName.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      await upsertTaskMaster({
        taskId,
        taskName: editTaskName.trim(),
        points: Number(editTaskPoints),
        categoryId: editTaskCat,
      });
      setEditingTaskId(null);
    } catch (err) {
      setError((err as Error).message ?? '保存に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpsertTaskMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      await upsertTaskMaster({
        taskId: crypto.randomUUID(),
        taskName: newTaskName.trim(),
        points: Number(newTaskPoints),
        categoryId: newTaskCat,
      });
      setNewTaskName('');
      setNewTaskPoints(10);
    } catch (err) {
      setError((err as Error).message ?? '保存に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setNameError('名前を入力してください');
      return;
    }
    if (trimmed.length > 50) {
      setNameError('名前は50文字以内で入力してください');
      return;
    }
    setNameError('');
    setSavingName(true);
    try {
      await updateMyProfile({ displayName: trimmed });
      setEditingName(false);
    } catch (err) {
      setNameError((err as Error).message ?? '保存に失敗しました');
    } finally {
      setSavingName(false);
    }
  };

  const handleSelectIcon = async (icon: string) => {
    if (savingIcon) return;
    setSavingIcon(icon);
    try {
      await updateMyProfile({ icon });
      setIconPickerOpen(false);
    } catch (err) {
      console.error('アイコン保存に失敗しました', err);
    } finally {
      setSavingIcon(null);
    }
  };

  const handleDeleteTaskMaster = async (taskId: string) => {
    setDeletingId(taskId);
    try {
      await deleteTaskMaster(taskId);
    } catch (err) {
      setError((err as Error).message ?? '削除に失敗しました');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* アイコン選択モーダル */}
      {iconPickerOpen && me && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className={`bg-white rounded-2xl ${flatBorder} shadow-[6px_6px_0px_#292524] p-5 w-full max-w-sm`}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-black text-base">アイコンを選ぶ</p>
              <button
                onClick={() => setIconPickerOpen(false)}
                aria-label="閉じる"
                className={`p-1.5 rounded-lg bg-stone-100 ${flatBorder}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {USER_ICONS.map(icon => {
                const isCurrent = me.icon === icon;
                const isSaving = savingIcon === icon;
                return (
                  <button
                    key={icon}
                    onClick={() => handleSelectIcon(icon)}
                    disabled={savingIcon !== null}
                    className={`aspect-square rounded-xl flex items-center justify-center text-2xl ${flatBorder} ${bounceClass} ${isCurrent ? `${me.color} shadow-[2px_2px_0px_#292524]` : 'bg-white'} ${isSaving ? 'opacity-60' : ''}`}
                    style={springStyle}
                    aria-label={`アイコン ${icon}`}
                  >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : icon}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 削除確認ダイアログ */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className={`bg-white rounded-2xl ${flatBorder} shadow-[6px_6px_0px_#292524] p-6 w-full max-w-xs space-y-4`}>
            <p className="font-black text-base text-center">本当に削除しますか？</p>
            <p className="text-xs text-stone-500 text-center font-bold">
              「{taskMasters.find(t => t.taskId === confirmDeleteId)?.taskName}」を削除します。この操作は取り消せません。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className={`flex-1 py-2.5 rounded-xl font-bold text-sm bg-stone-100 ${flatBorder} ${bounceClass}`}
                style={springStyle}
              >
                キャンセル
              </button>
              <button
                onClick={async () => {
                  const id = confirmDeleteId;
                  setConfirmDeleteId(null);
                  await handleDeleteTaskMaster(id);
                }}
                className={`flex-1 py-2.5 rounded-xl font-bold text-sm bg-red-400 text-white ${flatBorder} ${bounceClass}`}
                style={springStyle}
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 自分のプロフィール */}
      {me && (
        <section className={`bg-white p-4 rounded-2xl ${flatBorder} shadow-[4px_4px_0px_#292524]`}>
            {editingName ? (
              <form onSubmit={handleUpdateDisplayName} className="space-y-3">
                <label className="block text-xs font-bold text-stone-500">あなたの表示名</label>
                <input
                  type="text"
                  value={nameDraft}
                  onChange={e => setNameDraft(e.target.value)}
                  maxLength={50}
                  autoFocus
                  className={`w-full p-3 rounded-xl bg-white ${flatBorder} font-bold placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-teal`}
                />
                {nameError && <p className="text-red-500 text-sm font-bold">{nameError}</p>}
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingName(false);
                      setNameError('');
                    }}
                    className={`px-3 py-2 rounded-lg text-stone-500 bg-stone-100 font-bold text-xs ${flatBorder} flex items-center gap-1`}
                  >
                    <X className="w-4 h-4" /> キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={savingName}
                    className={`px-3 py-2 rounded-lg text-stone-900 bg-brand-teal/60 font-bold text-xs ${flatBorder} flex items-center gap-1`}
                  >
                    {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} 保存
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIconPickerOpen(true)}
                    aria-label="アイコンを選ぶ"
                    className={`w-12 h-12 rounded-full ${me.color} ${flatBorder} flex items-center justify-center ${bounceClass} shadow-[2px_2px_0px_#292524]`}
                    style={springStyle}
                  >
                    {me.icon ? (
                      <span className="text-2xl leading-none">{me.icon}</span>
                    ) : (
                      <UserIcon className="w-5 h-5 text-stone-800" />
                    )}
                  </button>
                  <div className="text-left">
                    <div className="text-xs font-bold text-stone-500">あなたの表示名</div>
                    <div className="font-bold text-lg">{me.displayName}</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setNameDraft(me.displayName);
                    setNameError('');
                    setEditingName(true);
                  }}
                  className={`p-2 rounded-lg text-stone-500 hover:text-brand-teal hover:bg-brand-teal/10 transition-colors ${flatBorder}`}
                  aria-label="表示名を編集"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}
        </section>
      )}

      {/* 家族招待 */}
      <button
        onClick={onOpenQr}
        className={`w-full bg-white p-4 rounded-2xl ${flatBorder} flex items-center justify-between ${bounceClass} shadow-[4px_4px_0px_#292524]`}
        style={springStyle}
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full bg-brand-teal/25 ${flatBorder} flex items-center justify-center`}>
              <QrCode className="w-5 h-5 text-stone-800" />
            </div>
            <div className="text-left">
              <div className="font-bold text-lg">家族を招待する</div>
              <div className="text-xs font-bold text-stone-500">QRコードやリンクで合流</div>
            </div>
          </div>
          <Plus className="w-6 h-6 text-stone-400" />
        </div>
      </button>

      {/* 新規家事登録 */}
      <section className={`bg-brand-yellow/15 p-4 rounded-2xl ${flatBorder} shadow-[4px_4px_0px_#292524]`}>
        <h2 className="text-base font-black mb-3">新しい家事を作る</h2>
        <form onSubmit={handleUpsertTaskMaster} className="space-y-3">
          <input
            type="text"
            placeholder="家事の名前"
            value={newTaskName}
            onChange={e => setNewTaskName(e.target.value)}
            className={`w-full p-3 rounded-xl bg-white ${flatBorder} font-bold placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-yellow`}
          />
          <select
            value={newTaskCat}
            onChange={e => setNewTaskCat(e.target.value)}
            className={`w-full p-3 rounded-xl bg-white ${flatBorder} font-bold focus:outline-none focus:ring-2 focus:ring-brand-yellow appearance-none`}
          >
            {CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="flex justify-center pt-1">
            <PointInput value={newTaskPoints} onChange={setNewTaskPoints} />
          </div>
          {error && <p className="text-red-500 text-sm font-bold">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full bg-brand-yellow py-3 rounded-xl font-bold ${flatBorder} ${bounceClass} flex items-center justify-center gap-2`}
            style={springStyle}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : '家事マスタに追加'}
          </button>
        </form>
      </section>

      {/* 登録済み家事一覧 */}
      <section>
        <h2 className="text-base font-black mb-3">登録済みの家事</h2>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-2 snap-x">
          <button
            onClick={() => setFilterCat(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 border-stone-800 ${filterCat === null ? 'bg-stone-800 text-white' : 'bg-white text-stone-600'}`}
          >
            すべて
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilterCat(cat.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 border-stone-800 ${filterCat === cat.id ? `${cat.color} text-stone-900 shadow-[2px_2px_0px_#292524]` : 'bg-white text-stone-500'}`}
            >
              <div className={`w-2 h-2 rounded-full ${cat.color} border border-stone-800`}></div>
              {cat.name}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {taskMasters
            .filter(t => (filterCat ? t.categoryId === filterCat : true))
            .sort((a, b) => a.taskName.localeCompare(b.taskName, 'ja'))
            .map(task => {
              const cat = CATEGORIES.find(c => c.id === task.categoryId);
              return (
                <div key={task.taskId} className={`bg-white p-3 rounded-xl ${flatBorder} flex flex-col gap-2 shadow-[2px_2px_0px_#292524]`}>
                    {editingTaskId === task.taskId ? (
                      <form onSubmit={(e) => handleUpdateTaskMaster(e, task.taskId)} className="space-y-3 w-full">
                        <div className="flex gap-2">
                           <input
                             type="text"
                             value={editTaskName}
                             onChange={e => setEditTaskName(e.target.value)}
                             className={`flex-1 p-2 rounded-lg bg-white ${flatBorder} text-sm font-bold placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-yellow`}
                           />
                        </div>
                        <select
                          value={editTaskCat}
                          onChange={e => setEditTaskCat(e.target.value)}
                          className={`w-full p-2 rounded-lg bg-white ${flatBorder} text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-yellow appearance-none`}
                        >
                          {CATEGORIES.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <div className="flex justify-center pt-1">
                          <PointInput value={editTaskPoints} onChange={setEditTaskPoints} />
                        </div>
                        <div className="flex gap-2 justify-end">
                           <button type="button" onClick={() => setEditingTaskId(null)} className={`p-2 rounded-lg text-stone-500 bg-stone-100 font-bold text-xs ${flatBorder} flex items-center gap-1`}>
                             <X className="w-4 h-4" /> キャンセル
                           </button>
                           <button type="submit" disabled={submitting} className={`p-2 rounded-lg text-stone-900 bg-brand-yellow font-bold text-xs ${flatBorder} flex items-center gap-1`}>
                             {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} 保存
                           </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${cat?.color ?? 'bg-stone-100'} ${flatBorder} flex items-center justify-center`}>
                            {cat && <cat.icon className="w-4 h-4" />}
                          </div>
                          <span className="font-bold text-sm">{task.taskName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm">{task.points}pt</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingTaskId(task.taskId);
                                setEditTaskName(task.taskName);
                                setEditTaskPoints(task.points);
                                setEditTaskCat(task.categoryId || 'other');
                              }}
                              className={`p-1.5 rounded-lg text-stone-400 hover:text-brand-teal hover:bg-brand-teal/10 transition-colors ${flatBorder}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(task.taskId)}
                              disabled={deletingId === task.taskId}
                              className={`p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors ${flatBorder}`}
                            >
                              {deletingId === task.taskId
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}
