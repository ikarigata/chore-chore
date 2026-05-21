import { createContext, useContext, useState, type ReactNode } from 'react';
import type { User, Task, HistoryItem } from './types';
import { INITIAL_TASKS } from './constants';

interface AppContextType {
  users: { papa: User; mama: User };
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  history: HistoryItem[];
  executeTask: (task: Task) => void;
  loadingTaskId: string | null;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState({
    papa: { id: 'papa', name: 'パパ', color: 'bg-yellow-300', today: 40, total: 3450 },
    mama: { id: 'mama', name: 'ママ', color: 'bg-orange-300', today: 20, total: 3820 },
  });
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);

  const executeTask = (task: Task) => {
    if (loadingTaskId) return;
    setLoadingTaskId(task.id);

    setTimeout(() => {
      const newItem: HistoryItem = {
        id: `exec_${Date.now()}`,
        taskId: task.id,
        taskName: task.name,
        points: task.points,
        categoryId: task.categoryId,
        userId: 'papa',
        timestamp: new Date(),
      };
      setHistory(prev => [newItem, ...prev]);
      setUsers(prev => ({
        ...prev,
        papa: {
          ...prev.papa,
          today: prev.papa.today + task.points,
          total: prev.papa.total + task.points,
        },
      }));
      setLoadingTaskId(null);
    }, 500);
  };

  return (
    <AppContext.Provider value={{ users, tasks, setTasks, history, executeTask, loadingTaskId }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
