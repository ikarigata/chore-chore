import { ScrollText } from 'lucide-react';
import { useApp } from '../context';
import { CATEGORIES } from '../constants';
import { flatBorder } from '../styles';

export default function History() {
  const { history, members, tasks, mySub } = useApp();

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
        <div className="space-y-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-stone-300 before:to-transparent">
          {history.map(item => {
            const categoryId = tasks.find(t => t.taskId === item.taskId)?.categoryId;
            const cat = CATEGORIES.find(c => c.id === categoryId) ?? CATEGORIES[5];
            const member = members.find(m => m.cognitoSub === item.cognitoSub);
            const isMe = item.cognitoSub === mySub;
            const ts = new Date(item.timestamp);
            return (
              <div key={item.taskExecutionId} className="relative flex items-center justify-between group animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 border-white ${member?.color ?? 'bg-stone-300'} shadow shrink-0 z-10`}>
                  <cat.icon className="w-5 h-5 text-stone-800" />
                </div>

                <div className={`w-[calc(100%-3.5rem)] p-3 rounded-2xl bg-white ${flatBorder} shadow-[2px_2px_0px_#292524]`}>
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-sm">
                      {tasks.find(t => t.taskId === item.taskId)?.taskName ?? item.taskId}
                    </span>
                    <span className="text-xs font-black text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">+{item.points}</span>
                  </div>
                  <div className="text-[10px] font-bold text-stone-400 flex items-center justify-between">
                    <span>{isMe ? 'あなた' : (member?.displayName ?? '不明')} が完了</span>
                    <span>
                      {ts.getHours()}:{ts.getMinutes().toString().padStart(2, '0')}
                    </span>
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
