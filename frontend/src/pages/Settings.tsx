import { useState } from 'react';
import { QrCode, Plus } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { useApp } from '../context';
import { CATEGORIES } from '../constants';
import { springStyle, bounceClass, flatBorder } from '../styles';
import type { LayoutOutletContext } from '../components/Layout';

export default function Settings() {
  const { tasks, setTasks } = useApp();
  const { onOpenQr } = useOutletContext<LayoutOutletContext>();

  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskPoints, setNewTaskPoints] = useState(10);
  const [newTaskCat, setNewTaskCat] = useState('cooking');
  const [filterCat, setFilterCat] = useState<string | null>(null);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;
    setTasks([
      { id: `task_${Date.now()}`, name: newTaskName, points: Number(newTaskPoints), categoryId: newTaskCat },
      ...tasks,
    ]);
    setNewTaskName('');
    setNewTaskPoints(10);
  };

  return (
    <div className="p-4 space-y-6">
      {/* 家族招待 */}
      <button
        onClick={onOpenQr}
        className={`w-full bg-white p-4 rounded-2xl ${flatBorder} flex items-center justify-between ${bounceClass} shadow-[4px_4px_0px_#292524]`}
        style={springStyle}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full bg-teal-100 ${flatBorder} flex items-center justify-center`}>
            <QrCode className="w-5 h-5 text-stone-800" />
          </div>
          <div className="text-left">
            <div className="font-bold text-lg">家族を招待する</div>
            <div className="text-xs font-bold text-stone-500">QRコードやリンクで合流</div>
          </div>
        </div>
        <Plus className="w-6 h-6 text-stone-400" />
      </button>

      {/* 新規家事登録 */}
      <section className={`bg-yellow-100/50 p-4 rounded-2xl ${flatBorder}`}>
        <h2 className="text-base font-black mb-3">新しい家事を作る</h2>
        <form onSubmit={handleAddTask} className="space-y-3">
          <input
            type="text"
            placeholder="家事の名前"
            value={newTaskName}
            onChange={e => setNewTaskName(e.target.value)}
            className={`w-full p-3 rounded-xl bg-white ${flatBorder} font-bold placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-yellow-400`}
          />
          <div className="flex gap-2">
            <select
              value={newTaskCat}
              onChange={e => setNewTaskCat(e.target.value)}
              className={`flex-1 p-3 rounded-xl bg-white ${flatBorder} font-bold focus:outline-none focus:ring-2 focus:ring-yellow-400 appearance-none`}
            >
              {CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="relative w-24">
              <input
                type="number"
                value={newTaskPoints}
                onChange={e => setNewTaskPoints(Number(e.target.value))}
                className={`w-full p-3 rounded-xl bg-white ${flatBorder} font-bold text-right pr-6 focus:outline-none focus:ring-2 focus:ring-yellow-400`}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-500">pt</span>
            </div>
          </div>
          <button
            type="submit"
            className={`w-full bg-yellow-300 py-3 rounded-xl font-bold ${flatBorder} ${bounceClass}`}
            style={springStyle}
          >
            家事マスタに追加
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
          {tasks
            .filter(t => (filterCat ? t.categoryId === filterCat : true))
            .map(task => {
              const cat = CATEGORIES.find(c => c.id === task.categoryId);
              return (
                <div key={task.id} className={`bg-white p-3 rounded-xl ${flatBorder} flex items-center justify-between opacity-80`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${cat?.color} ${flatBorder} flex items-center justify-center`}>
                      {cat && <cat.icon className="w-4 h-4" />}
                    </div>
                    <span className="font-bold text-sm">{task.name}</span>
                  </div>
                  <span className="font-black text-sm">{task.points}pt</span>
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}
