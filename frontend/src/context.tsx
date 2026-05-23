import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { User, Task, HistoryItem, DailySummary } from './types';
import { apiGet, apiPost, apiPut, apiDelete } from './lib/api';

const MEMBER_COLORS = ['bg-yellow-300', 'bg-orange-300', 'bg-teal-300', 'bg-purple-300'];

interface InitResponse {
  users: Omit<User, 'color'>[];
  tasks: { taskId: string; taskName: string; points: number; categoryId?: string }[];
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
  cancelTask: (item: HistoryItem) => Promise<void>;
  loadingTaskId: string | null;
  initialized: boolean;
  initError: string | null;
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
  const [initError, setInitError] = useState<string | null>(null);

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
      setTasks(initData.tasks.map(t => ({ ...t, categoryId: t.categoryId ?? 'other' })));
      setTodaySummaries(summaryData.summaries);
      setHistory(historiesData.histories);
      setInitialized(true);
    }
    init().catch(err => {
      setInitError(err instanceof Error ? err.message : '読み込みに失敗しました');
      setInitialized(true);
    });
  }, []);

  const addTask = async (task: Task) => {
    await apiPut('/tasks', { taskId: task.taskId, taskName: task.taskName, points: task.points, categoryId: task.categoryId });
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
      setMembers(prev => prev.map(m =>
        m.cognitoSub === mySub ? { ...m, totalPoints: m.totalPoints + task.points } : m
      ));
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

  const cancelTask = async (item: HistoryItem) => {
    await apiDelete('/tasks/execute', {
      taskExecutionId: item.taskExecutionId,
      timestamp: item.timestamp,
      points: item.points,
    });
    setMembers(prev => prev.map(m =>
      m.cognitoSub === mySub ? { ...m, totalPoints: m.totalPoints - item.points } : m
    ));
    const [summaryData, historiesData] = await Promise.all([
      apiGet<SummaryResponse>('/summary/daily'),
      apiGet<HistoriesResponse>('/histories'),
    ]);
    setTodaySummaries(summaryData.summaries);
    setHistory(historiesData.histories);
  };

  return (
    <AppContext.Provider value={{ mySub, members, tasks, history, todaySummaries, addTask, deleteTask, executeTask, cancelTask, loadingTaskId, initialized, initError }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
