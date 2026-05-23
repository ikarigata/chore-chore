import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import {
  FamilyInitResponseSchema,
  SummaryDailyResponseSchema,
  TaskHistoryListResponseSchema,
  type FamilyInitResponse,
  type SummaryDailyResponse,
  type TaskHistoryListResponse,
} from '@iezi/shared';
import type { User, TaskMaster, TaskHistory, DailySummary } from './types';
import { apiGet, apiPost, apiPut, apiDelete } from './lib/api';

const MEMBER_COLORS = ['bg-yellow-300', 'bg-orange-300', 'bg-teal-300', 'bg-purple-300'];

// 既存メンバーの色は維持し、新規メンバーには未使用の色を割り当てる
function assignMemberColors(users: FamilyInitResponse['users'], prev: User[]): User[] {
  const usedColors = new Set<string>();
  for (const u of users) {
    const existing = prev.find(p => p.cognitoSub === u.cognitoSub);
    if (existing) usedColors.add(existing.color);
  }
  return users.map((u, i) => {
    const existing = prev.find(p => p.cognitoSub === u.cognitoSub);
    if (existing) return { ...u, color: existing.color };
    const available =
      MEMBER_COLORS.find(c => !usedColors.has(c)) ?? MEMBER_COLORS[i % MEMBER_COLORS.length];
    usedColors.add(available);
    return { ...u, color: available };
  });
}

interface AppContextType {
  mySub: string | null;
  members: User[];
  taskMasters: TaskMaster[];
  taskHistories: TaskHistory[];
  todaySummaries: DailySummary[];
  upsertTaskMaster: (task: TaskMaster) => Promise<void>;
  deleteTaskMaster: (taskId: string) => Promise<void>;
  createTaskHistory: (task: TaskMaster) => Promise<void>;
  deleteTaskHistory: (item: TaskHistory) => Promise<void>;
  processingId: string | null;
  initialized: boolean;
  initError: string | null;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [mySub, setMySub] = useState<string | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [taskMasters, setTaskMasters] = useState<TaskMaster[]>([]);
  const [taskHistories, setTaskHistories] = useState<TaskHistory[]>([]);
  const [todaySummaries, setTodaySummaries] = useState<DailySummary[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const refreshTokenRef = useRef(0);

  const refreshAllData = useCallback(async () => {
    const token = ++refreshTokenRef.current;
    const [initData, summaryData, historiesData] = await Promise.all([
      apiGet<FamilyInitResponse>('/family/init', FamilyInitResponseSchema),
      apiGet<SummaryDailyResponse>('/summary/daily', SummaryDailyResponseSchema),
      apiGet<TaskHistoryListResponse>('/histories', TaskHistoryListResponseSchema),
    ]);
    if (token !== refreshTokenRef.current) return;
    setMembers(prev => assignMemberColors(initData.users, prev));
    setTaskMasters(initData.taskMasters.map(t => ({ ...t, categoryId: t.categoryId ?? 'other' })));
    setTodaySummaries(summaryData.summaries);
    setTaskHistories(historiesData.taskHistories);
  }, []);

  useEffect(() => {
    async function init() {
      const session = await fetchAuthSession();
      const sub = session.tokens?.idToken?.payload?.sub as string | undefined;
      if (sub) setMySub(sub);
      await refreshAllData();
      setInitialized(true);
    }
    init().catch(err => {
      setInitError(err instanceof Error ? err.message : '読み込みに失敗しました');
      setInitialized(true);
    });
  }, [refreshAllData]);

  useEffect(() => {
    if (!initialized || processingId) return;
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        refreshAllData().catch(err =>
          console.warn('フォーカス時の再同期に失敗しました', err)
        );
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [initialized, processingId, refreshAllData]);

  const upsertTaskMaster = async (task: TaskMaster) => {
    await apiPut('/tasks', { taskId: task.taskId, taskName: task.taskName, points: task.points, categoryId: task.categoryId });
    setTaskMasters(prev => [task, ...prev.filter(t => t.taskId !== task.taskId)]);
  };

  const deleteTaskMaster = async (taskId: string) => {
    await apiDelete(`/tasks/${taskId}`);
    setTaskMasters(prev => prev.filter(t => t.taskId !== taskId));
  };

  const createTaskHistory = async (task: TaskMaster) => {
    if (processingId || !mySub) return;
    const taskExecutionId = crypto.randomUUID();

    setProcessingId(task.taskId);
    try {
      await apiPost('/tasks/execute', { taskId: task.taskId, taskExecutionId });
      await refreshAllData();
    } catch (err) {
      console.error('家事の実行に失敗しました', err);
      throw err;
    } finally {
      setProcessingId(null);
    }
  };

  const deleteTaskHistory = async (item: TaskHistory) => {
    if (processingId || !mySub) return;

    setProcessingId(item.taskExecutionId);
    try {
      await apiDelete('/tasks/execute', {
        taskExecutionId: item.taskExecutionId,
        timestamp: item.timestamp,
        points: item.points,
      });
      await refreshAllData();
    } catch (err) {
      console.error('家事の取り消しに失敗しました', err);
      throw err;
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <AppContext.Provider value={{
      mySub,
      members,
      taskMasters,
      taskHistories,
      todaySummaries,
      upsertTaskMaster,
      deleteTaskMaster,
      createTaskHistory,
      deleteTaskHistory,
      processingId,
      initialized,
      initError
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
