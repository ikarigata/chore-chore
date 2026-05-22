import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { User, Task, HistoryItem, DailySummary } from './types';
import { apiGet, apiPost, apiPut, apiDelete } from './lib/api';

const MEMBER_COLORS = ['bg-yellow-300', 'bg-orange-300', 'bg-teal-300', 'bg-purple-300'];

interface InitResponse {
  users: Omit<User, 'color'>[];
  tasks: { taskId: string; taskName: string; points: number }[];
}

interface SummaryResponse {
  date: string;
  summaries: DailySummary[];
}

interface HistoriesResponse {
  histories: HistoryItem[];
}

interface AppContextType {
  mySub: string | null;
  members: User[];
  tasks: Task[];
  history: HistoryItem[];
  todaySummaries: DailySummary[];
  addTask: (task: Task) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  executeTask: (task: Task) => Promise<void>;
  loadingTaskId: string | null;
  initialized: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [mySub, setMySub] = useState<string | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [todaySummaries, setTodaySummaries] = useState<DailySummary[]>([]);
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    async function init() {
      const session = await fetchAuthSession();
      const sub = session.tokens?.idToken?.payload?.sub as string | undefined;
      if (sub) setMySub(sub);

      const [initData, summaryData, historiesData] = await Promise.all([
        apiGet<InitResponse>('/family/init'),
        apiGet<SummaryResponse>('/summary/daily'),
        apiGet<HistoriesResponse>('/histories'),
      ]);

      setMembers(
        initData.users.map((u, i) => ({ ...u, color: MEMBER_COLORS[i % MEMBER_COLORS.length] }))
      );
      // categoryId はバックエンドに存在しないため、初期値として 'other' を設定
      setTasks(initData.tasks.map(t => ({ ...t, categoryId: 'other' })));
      setTodaySummaries(summaryData.summaries);
      setHistory(historiesData.histories);
      setInitialized(true);
    }
    init().catch(console.error);
  }, []);

  const addTask = async (task: Task) => {
    await apiPut('/tasks', { taskId: task.taskId, taskName: task.taskName, points: task.points });
    setTasks(prev => [task, ...prev.filter(t => t.taskId !== task.taskId)]);
  };

  const deleteTask = async (taskId: string) => {
    await apiDelete(`/tasks/${taskId}`);
    setTasks(prev => prev.filter(t => t.taskId !== taskId));
  };

  const executeTask = async (task: Task) => {
    if (loadingTaskId) return;
    const taskExecutionId = crypto.randomUUID();
    setLoadingTaskId(task.taskId);
    try {
      await apiPost('/tasks/execute', { taskId: task.taskId, taskExecutionId });
      const [summaryData, historiesData] = await Promise.all([
        apiGet<SummaryResponse>('/summary/daily'),
        apiGet<HistoriesResponse>('/histories'),
      ]);
      setTodaySummaries(summaryData.summaries);
      setHistory(historiesData.histories);
    } finally {
      setLoadingTaskId(null);
    }
  };

  return (
    <AppContext.Provider value={{ mySub, members, tasks, history, todaySummaries, addTask, deleteTask, executeTask, loadingTaskId, initialized }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
