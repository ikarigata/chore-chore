```react
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Home, ScrollText, Settings, Check, Plus, QrCode, 
  ArrowLeft, X, Utensils, Droplets, ShoppingCart, 
  Sparkles, Shirt, Box, Loader2, UserPlus, Flame
} from 'lucide-react';

// --- 定数＆ダミーデータ ---
const CATEGORIES = [
  { id: 'cooking', name: '料理', icon: Utensils, color: 'bg-red-100' },
  { id: 'cleaning', name: '掃除', icon: Sparkles, color: 'bg-blue-100' },
  { id: 'laundry', name: '洗濯', icon: Shirt, color: 'bg-cyan-100' },
  { id: 'water', name: '水回り', icon: Droplets, color: 'bg-teal-100' },
  { id: 'shopping', name: '買物', icon: ShoppingCart, color: 'bg-green-100' },
  { id: 'other', name: 'その他', icon: Box, color: 'bg-stone-100' },
];

const INITIAL_TASKS = [
  { id: 't1', name: '食器洗い', points: 10, categoryId: 'cooking' },
  { id: 't2', name: '夕食作り', points: 30, categoryId: 'cooking' },
  { id: 't3', name: 'お風呂掃除', points: 15, categoryId: 'water' },
  { id: 't4', name: 'トイレ掃除', points: 10, categoryId: 'water' },
  { id: 't5', name: '掃除機かけ', points: 15, categoryId: 'cleaning' },
  { id: 't6', name: '洗濯物を干す', points: 10, categoryId: 'laundry' },
  { id: 't7', name: '日用品の買出', points: 20, categoryId: 'shopping' },
];

const GRAPH_BASE = [
  { day: '月', papa: 40, mama: 60 },
  { day: '火', papa: 50, mama: 80 },
  { day: '水', papa: 90, mama: 40 },
  { day: '木', papa: 30, mama: 70 },
  { day: '金', papa: 80, mama: 90 },
  { day: '土', papa: 120, mama: 100 },
];

// --- スタイルユーティリティ ---
const springStyle = { transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' };
const bounceClass = "transition-transform duration-300 active:scale-95";
const flatBorder = "border-2 border-stone-800";

// --- メインコンポーネント ---
export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [users, setUsers] = useState({
    papa: { id: 'papa', name: 'パパ', color: 'bg-yellow-300', today: 40, total: 3450 },
    mama: { id: 'mama', name: 'ママ', color: 'bg-orange-300', today: 20, total: 3820 }
  });
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [history, setHistory] = useState([]);
  
  // 状態管理
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loadingTaskId, setLoadingTaskId] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);

  // 家事完了（同期トランザクションのモック）
  const handleExecuteTask = (task) => {
    if (loadingTaskId) return;
    
    // 1. フロントで意図を固定（ローディング開始）
    setLoadingTaskId(task.id);

    // 擬似的なAPI通信の遅延 (500ms)
    setTimeout(() => {
      // 2 & 3. 履歴の追加とポイントの加算を同時に行う
      const newHistory = {
        id: `exec_${Date.now()}`,
        taskId: task.id,
        taskName: task.name,
        points: task.points,
        categoryId: task.categoryId,
        userId: 'papa', // 今回はパパとして実行
        timestamp: new Date()
      };

      setHistory(prev => [newHistory, ...prev]);
      setUsers(prev => ({
        ...prev,
        papa: {
          ...prev.papa,
          today: prev.papa.today + task.points,
          total: prev.papa.total + task.points
        }
      }));
      
      // ローディング解除
      setLoadingTaskId(null);
    }, 500);
  };

  // 画面ルーティング
  if (activeTab === 'welcome') {
    return <WelcomeScreen onBack={() => setActiveTab('settings')} />;
  }

  return (
    <div className="min-h-screen bg-amber-50 text-stone-800 font-sans pb-24">
      {/* ヘッダー */}
      <header className="bg-white px-4 py-3 flex items-center justify-between border-b-2 border-stone-800 sticky top-0 z-10">
        <h1 className="text-xl font-black tracking-wider flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-500" />
          iezi
        </h1>
        <div className="bg-yellow-200 px-3 py-1 rounded-full font-bold text-sm border-2 border-stone-800 flex items-center gap-1">
          <UserPlus className="w-4 h-4" /> パパ
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-md mx-auto w-full">
        {activeTab === 'home' && (
          <HomeTab 
            users={users} 
            tasks={tasks}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            onExecute={handleExecuteTask}
            loadingTaskId={loadingTaskId}
          />
        )}
        {activeTab === 'history' && <HistoryTab history={history} />}
        {activeTab === 'settings' && (
          <SettingsTab 
            tasks={tasks} 
            setTasks={setTasks} 
            onOpenQr={() => setShowQrModal(true)} 
          />
        )}
      </main>

      {/* ボトムナビゲーション */}
      <nav className={`fixed bottom-0 w-full max-w-md left-1/2 -translate-x-1/2 bg-white border-t-2 border-stone-800 flex justify-around p-3 pb-safe z-20`}>
        <NavButton icon={Home} label="ホーム" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
        <NavButton icon={ScrollText} label="履歴" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
        <NavButton icon={Settings} label="設定" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
      </nav>

      {/* 家族招待QRモーダル */}
      {showQrModal && (
        <QrModal 
          onClose={() => setShowQrModal(false)} 
          onPreviewWelcome={() => {
            setShowQrModal(false);
            setActiveTab('welcome');
          }} 
        />
      )}
    </div>
  );
}

// --- タブコンポーネント: ホーム ---
function HomeTab({ users, tasks, selectedCategory, setSelectedCategory, onExecute, loadingTaskId }) {
  const currentGraphData = useMemo(() => {
    return [...GRAPH_BASE, { day: '今日', papa: users.papa.today, mama: users.mama.today }];
  }, [users]);

  const maxPoints = Math.max(...currentGraphData.map(d => Math.max(d.papa, d.mama)), 100);

  return (
    <div className="p-4 space-y-6">
      {/* コンパクトなダッシュボード */}
      <section className={`bg-white rounded-2xl p-4 ${flatBorder} shadow-[4px_4px_0px_#292524]`}>
        <div className="flex justify-between items-end mb-4">
          <div className="flex gap-4">
            <UserScore user={users.papa} />
            <UserScore user={users.mama} />
          </div>
        </div>
        
        {/* 直近7日間の極薄ガイドライン付きグラフ */}
        <div className="h-24 relative flex items-end justify-between pt-4 border-t-2 border-stone-100">
          {/* ガイドライン */}
          <div className="absolute top-0 w-full border-b border-dashed border-stone-200"></div>
          <div className="absolute top-1/2 w-full border-b border-dashed border-stone-200"></div>
          
          {currentGraphData.map((data, i) => (
            <div key={i} className="flex flex-col items-center gap-1 w-1/7 z-10">
              <div className="flex gap-1 h-16 items-end">
                <div 
                  className="w-2 bg-yellow-300 rounded-t-sm border-x border-t border-stone-800 transition-all duration-500 ease-out"
                  style={{ height: `${(data.papa / maxPoints) * 100}%`, ...springStyle }}
                />
                <div 
                  className="w-2 bg-orange-300 rounded-t-sm border-x border-t border-stone-800 transition-all duration-500 ease-out"
                  style={{ height: `${(data.mama / maxPoints) * 100}%`, ...springStyle }}
                />
              </div>
              <span className="text-[10px] font-bold text-stone-500">{data.day}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 家事メニュー (ドリルダウン) */}
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
              <h2 className="text-lg font-black">{CATEGORIES.find(c => c.id === selectedCategory)?.name}の家事</h2>
            </div>
            
            {tasks.filter(t => t.categoryId === selectedCategory).map(task => (
              <div key={task.id} className={`bg-white p-3 rounded-2xl ${flatBorder} flex items-center justify-between shadow-[2px_2px_0px_#292524]`}>
                <div>
                  <div className="font-bold">{task.name}</div>
                  <div className="text-sm font-black text-yellow-600 flex items-center gap-1">
                    <Flame className="w-4 h-4" /> {task.points} pt
                  </div>
                </div>
                <button
                  onClick={() => onExecute(task)}
                  disabled={loadingTaskId !== null}
                  className={`bg-teal-200 px-4 py-2 rounded-full font-bold ${flatBorder} flex items-center gap-1 transition-all ${loadingTaskId === task.id ? 'opacity-80 scale-95' : bounceClass}`}
                  style={springStyle}
                >
                  {loadingTaskId === task.id ? (
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

// ダッシュボードのユーザースコア用ミニコンポーネント
function UserScore({ user }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <div className={`w-3 h-3 rounded-full ${user.color} ${flatBorder}`}></div>
        <span className="text-sm font-bold">{user.name}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-black leading-none">{user.today}</span>
        <span className="text-xs font-bold text-stone-500">pt</span>
      </div>
      <div className="text-[10px] font-bold text-stone-400 mt-0.5">
        累計: {user.total} pt
      </div>
    </div>
  );
}

// --- タブコンポーネント: 履歴 ---
function HistoryTab({ history }) {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-black flex items-center gap-2">
        <ScrollText className="w-5 h-5 text-orange-500" />
        みんなの履歴
      </h2>
      
      {history.length === 0 ? (
        <div className="text-center py-12 text-stone-500 font-bold bg-white rounded-2xl border-2 border-dashed border-stone-300">
          まだ履歴がありません
        </div>
      ) : (
        <div className="space-y-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-stone-300 before:to-transparent">
          {history.map((item, idx) => {
            const cat = CATEGORIES.find(c => c.id === item.categoryId) || CATEGORIES[5];
            const isPapa = item.userId === 'papa';
            return (
              <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 border-white ${isPapa ? 'bg-yellow-300' : 'bg-orange-300'} shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10`}>
                  <cat.icon className="w-5 h-5 text-stone-800" />
                </div>
                
                <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded-2xl bg-white ${flatBorder} shadow-[2px_2px_0px_#292524]`}>
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-sm">{item.taskName}</span>
                    <span className="text-xs font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">+{item.points}</span>
                  </div>
                  <div className="text-[10px] font-bold text-stone-400 flex items-center justify-between">
                    <span>{isPapa ? 'パパ' : 'ママ'} が完了</span>
                    <span>{item.timestamp.getHours()}:{item.timestamp.getMinutes().toString().padStart(2, '0')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- タブコンポーネント: 設定 ---
function SettingsTab({ tasks, setTasks, onOpenQr }) {
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskPoints, setNewTaskPoints] = useState(10);
  const [newTaskCat, setNewTaskCat] = useState('cooking');
  const [filterCat, setFilterCat] = useState(null);

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;
    
    setTasks([{
      id: `task_${Date.now()}`,
      name: newTaskName,
      points: Number(newTaskPoints),
      categoryId: newTaskCat
    }, ...tasks]);
    
    setNewTaskName('');
    setNewTaskPoints(10);
  };

  return (
    <div className="p-4 space-y-6">
      {/* 家族を招待 */}
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

      {/* 新規家事登録 (柔らかいフラットフォーム) */}
      <section className={`bg-yellow-100/50 p-4 rounded-2xl ${flatBorder}`}>
        <h2 className="text-base font-black mb-3">新しい家事を作る</h2>
        <form onSubmit={handleAddTask} className="space-y-3">
          <input 
            type="text" 
            placeholder="家事の名前" 
            value={newTaskName}
            onChange={(e) => setNewTaskName(e.target.value)}
            className={`w-full p-3 rounded-xl bg-white ${flatBorder} font-bold placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-yellow-400`}
          />
          <div className="flex gap-2">
            <select 
              value={newTaskCat}
              onChange={(e) => setNewTaskCat(e.target.value)}
              className={`flex-1 p-3 rounded-xl bg-white ${flatBorder} font-bold focus:outline-none focus:ring-2 focus:ring-yellow-400 appearance-none`}
            >
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="relative w-24">
              <input 
                type="number" 
                value={newTaskPoints}
                onChange={(e) => setNewTaskPoints(e.target.value)}
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

      {/* 登録済みマスタと絞り込みフィルター */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-black">登録済みの家事</h2>
        </div>
        
        {/* さりげないカテゴリフィルターチップ */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-2 snap-x hide-scrollbar">
          <button
            onClick={() => setFilterCat(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 border-stone-800
              ${filterCat === null ? 'bg-stone-800 text-white' : 'bg-white text-stone-600'}
            `}
          >
            すべて
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilterCat(cat.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 border-stone-800
                ${filterCat === cat.id ? `${cat.color} text-stone-900 shadow-[2px_2px_0px_#292524]` : 'bg-white text-stone-500'}
              `}
            >
              <div className={`w-2 h-2 rounded-full ${cat.color} border border-stone-800`}></div>
              {cat.name}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {tasks.filter(t => filterCat ? t.categoryId === filterCat : true).map(task => {
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

// --- 招待ウェルカム画面 (ゲスト側プレビュー) ---
function WelcomeScreen({ onBack }) {
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = () => {
    setIsJoining(true);
    setTimeout(() => {
      alert("Cognitoのサインアップ画面へ遷移します (モック)");
      setIsJoining(false);
      onBack();
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-teal-50 flex flex-col items-center justify-center p-6 text-stone-800">
      <div className={`bg-white w-full max-w-sm rounded-3xl p-8 ${flatBorder} shadow-[8px_8px_0px_#292524] text-center relative`}>
        <button onClick={onBack} className={`absolute top-4 left-4 p-2 bg-stone-100 rounded-full ${flatBorder} ${bounceClass}`}>
          <X className="w-5 h-5" />
        </button>
        
        <div className="w-20 h-20 bg-yellow-200 rounded-full border-4 border-stone-800 mx-auto mb-6 flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-stone-800" />
        </div>
     

     <h1 className="text-2xl font-black mb-2">ieziへようこそ！</h1>
        <p className="font-bold text-stone-600 mb-8 leading-relaxed">
          <span className="text-teal-600 border-b-2 border-teal-200">パパさん</span> から招待が届いています。<br/>一緒に家事管理を始めましょう！
        </p>

        {/* Neo Brutalism風ボタン */}
        <button 
          onClick={handleJoin}
          disabled={isJoining}
          className={`w-full bg-teal-400 py-4 rounded-xl font-black text-lg border-2 border-stone-800 
            shadow-[0px_4px_0px_#292524] active:shadow-[0px_0px_0px_#292524] active:translate-y-1 
            transition-all flex items-center justify-center gap-2`}
        >
          {isJoining ? <Loader2 className="w-6 h-6 animate-spin" /> : "参加して、はじめる"}
        </button>
        
        <div className="mt-6 text-xs font-bold text-stone-400 underline decoration-stone-300 underline-offset-4">
          すでにアカウントをお持ちの方はこちら
        </div>
      </div>
    </div>
  );
}

// --- QRコードモーダル ---
function QrModal({ onClose, onPreviewWelcome }) {
  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className={`bg-white w-full max-w-sm rounded-3xl p-6 ${flatBorder} shadow-[8px_8px_0px_#292524] relative animate-in zoom-in-95 duration-200`}>
        <button onClick={onClose} className={`absolute top-4 right-4 p-2 bg-stone-100 rounded-full ${flatBorder} ${bounceClass}`}>
          <X className="w-5 h-5" />
        </button>
        
        <h3 className="text-xl font-black mb-6 text-center">家族を招待</h3>
        
        <div className={`w-48 h-48 mx-auto bg-stone-100 rounded-2xl ${flatBorder} flex items-center justify-center mb-6`}>
          <QrCode className="w-24 h-24 text-stone-300" />
          <div className="absolute font-bold text-stone-400 rotate-12">QR Code Mock</div>
        </div>
        
        <div className="flex gap-2 mb-6">
          <input 
            type="text" 
            readOnly 
            value="https://iezi.app/invite?token=abc..." 
            className={`flex-1 p-3 rounded-xl bg-stone-50 ${flatBorder} font-bold text-sm text-stone-500`}
          />
          <button className={`bg-stone-800 text-white px-4 rounded-xl font-bold border-2 border-stone-800 ${bounceClass}`}>
            コピー
          </button>
        </div>

        <div className="border-t-2 border-dashed border-stone-200 pt-4 text-center">
          <button 
            onClick={onPreviewWelcome}
            className="text-xs font-bold text-teal-600 bg-teal-50 px-4 py-2 rounded-full border border-teal-200"
          >
            ※招待された側の画面プレビューを見る
          </button>
        </div>
      </div>
    </div>
  );
}

// --- ボトムナビ用ボタン ---
function NavButton({ icon: Icon, label, active, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl transition-all duration-300 ${active ? 'scale-110' : 'active:scale-95'}`}
      style={springStyle}
    >
      <div className={`relative p-1.5 rounded-lg ${active ? 'bg-yellow-200 border-2 border-stone-800' : 'text-stone-500'}`}>
        <Icon className={active ? 'w-5 h-5 text-stone-800' : 'w-6 h-6'} />
        {active && <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-teal-400 rounded-full border border-stone-800"></div>}
      </div>
      <span className={`text-[10px] mt-1 font-bold ${active ? 'text-stone-800' : 'text-stone-500'}`}>{label}</span>
    </button>
  );
}

```