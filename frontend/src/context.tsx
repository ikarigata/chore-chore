import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import {
  FamilyInitResponseSchema,
  MemoListResponseSchema,
  NeguraiListResponseSchema,
  SummaryDailyResponseSchema,
  SummaryMonthlyResponseSchema,
  SummaryWeeklyResponseSchema,
  TaskHistoryListResponseSchema,
  type FamilyInitResponse,
  type MemoListResponse,
  type NeguraiListResponse,
  type SummaryDailyResponse,
  type SummaryMonthlyResponse,
  type SummaryWeeklyResponse,
  type TaskHistoryListResponse,
} from '@iezi/shared';
import type { User, TaskMaster, TaskHistory, DailySummary, Negurai, Memo } from './types';
import { apiGet, apiPost, apiPut, apiDelete } from './lib/api';
import { dateKeyToTimestamp, getJSTDateString } from './lib/time';

const MEMBER_COLORS = ['bg-brand-yellow', 'bg-brand-sky', 'bg-brand-teal', 'bg-brand-green'];

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
  weeklySummaries: DailySummary[];
  negurai: Negurai[];
  memos: Memo[];
  monthlySummaries: Record<string, DailySummary[]>;
  fetchMonthlySummaries: (monthKey: string) => Promise<void>;
  updateMyProfile: (patch: { displayName?: string; icon?: string }) => Promise<void>;
  upsertTaskMaster: (task: TaskMaster) => Promise<void>;
  deleteTaskMaster: (taskId: string) => Promise<void>;
  createTaskHistory: (task: TaskMaster, opts?: { dateKey?: string }) => Promise<void>;
  deleteTaskHistory: (item: TaskHistory) => Promise<void>;
  updateTaskHistoryDate: (item: TaskHistory, newDateKey: string) => Promise<void>;
  createNegurai: (giverSub: string, description: string, points: number) => Promise<void>;
  deleteNegurai: (item: Negurai) => Promise<void>;
  createMemo: (content: string) => Promise<void>;
  deleteMemo: (item: Memo) => Promise<void>;
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
  const [weeklySummaries, setWeeklySummaries] = useState<DailySummary[]>([]);
  const [negurai, setNegurai] = useState<Negurai[]>([]);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [monthlySummaries, setMonthlySummaries] = useState<Record<string, DailySummary[]>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const refreshTokenRef = useRef(0);

  const refreshAllData = useCallback(async () => {
    const token = ++refreshTokenRef.current;
    const [initData, summaryData, weeklyData, historiesData, neguraiData, memosData] = await Promise.all([
      apiGet<FamilyInitResponse>('/family/init', FamilyInitResponseSchema),
      apiGet<SummaryDailyResponse>('/summary/daily', SummaryDailyResponseSchema),
      apiGet<SummaryWeeklyResponse>('/summary/weekly', SummaryWeeklyResponseSchema),
      apiGet<TaskHistoryListResponse>('/histories', TaskHistoryListResponseSchema),
      apiGet<NeguraiListResponse>('/negurai', NeguraiListResponseSchema),
      apiGet<MemoListResponse>('/memos', MemoListResponseSchema),
    ]);
    if (token !== refreshTokenRef.current) return;
    setMembers(prev => assignMemberColors(initData.users, prev));
    setTaskMasters(initData.taskMasters.map(t => ({ ...t, categoryId: t.categoryId ?? 'other' })));
    setTodaySummaries(summaryData.summaries);
    setWeeklySummaries(weeklyData.summaries);
    setTaskHistories(historiesData.taskHistories);
    setNegurai(neguraiData.negurai);
    setMemos(memosData.memos);
    // 家事の追加・取消・日付変更で月次サマリが古くなるため、キャッシュを破棄して lazy 再取得させる
    setMonthlySummaries({});
  }, []);

  const fetchMonthlySummaries = useCallback(async (monthKey: string) => {
    const data = await apiGet<SummaryMonthlyResponse>(
      `/summary/monthly?month=${monthKey}`,
      SummaryMonthlyResponseSchema,
    );
    setMonthlySummaries(prev => ({ ...prev, [monthKey]: data.summaries }));
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

  const updateMyProfile = async (patch: { displayName?: string; icon?: string }) => {
    if (!mySub) return;
    const body: { displayName?: string; icon?: string } = {};
    if (patch.displayName !== undefined) body.displayName = patch.displayName.trim();
    if (patch.icon !== undefined) body.icon = patch.icon;
    await apiPut('/users/me', body);
    setMembers(prev =>
      prev.map(m => (m.cognitoSub === mySub ? { ...m, ...body } : m)),
    );
  };

  const upsertTaskMaster = async (task: TaskMaster) => {
    await apiPut('/tasks', { taskId: task.taskId, taskName: task.taskName, points: task.points, categoryId: task.categoryId });
    setTaskMasters(prev => [task, ...prev.filter(t => t.taskId !== task.taskId)]);
  };

  const deleteTaskMaster = async (taskId: string) => {
    await apiDelete(`/tasks/${taskId}`);
    setTaskMasters(prev => prev.filter(t => t.taskId !== taskId));
  };

  const createTaskHistory = async (task: TaskMaster, opts?: { dateKey?: string }) => {
    if (processingId || !mySub) return;
    const taskExecutionId = crypto.randomUUID();
    // 今日選択時は timestamp を送らずバックエンドの now に任せる
    const todayKey = getJSTDateString(new Date());
    const body: { taskId: string; taskExecutionId: string; timestamp?: string } = {
      taskId: task.taskId,
      taskExecutionId,
    };
    if (opts?.dateKey && opts.dateKey !== todayKey) {
      body.timestamp = dateKeyToTimestamp(opts.dateKey);
    }

    setProcessingId(task.taskId);
    try {
      await apiPost('/tasks/execute', body);
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

  const createNegurai = async (giverSub: string, description: string, points: number) => {
    if (processingId || !mySub) return;
    const neguraiId = crypto.randomUUID();
    setProcessingId('negurai');
    try {
      await apiPost('/negurai', { neguraiId, giverSub, description, points });
      await refreshAllData();
    } catch (err) {
      console.error('ねぎらいの登録に失敗しました', err);
      throw err;
    } finally {
      setProcessingId(null);
    }
  };

  const deleteNegurai = async (item: Negurai) => {
    if (processingId || !mySub) return;
    setProcessingId(item.neguraiId);
    try {
      await apiDelete('/negurai', {
        neguraiId: item.neguraiId,
        timestamp: item.timestamp,
        points: item.points,
        giverSub: item.giverSub,
      });
      await refreshAllData();
    } catch (err) {
      console.error('ねぎらいの取り消しに失敗しました', err);
      throw err;
    } finally {
      setProcessingId(null);
    }
  };

  const createMemo = async (content: string) => {
    if (processingId || !mySub) return;
    const memoId = crypto.randomUUID();
    setProcessingId('memo-create');
    try {
      await apiPost('/memos', { memoId, content });
      await refreshAllData();
    } catch (err) {
      console.error('メモの追加に失敗しました', err);
      throw err;
    } finally {
      setProcessingId(null);
    }
  };

  const deleteMemo = async (item: Memo) => {
    if (processingId || !mySub) return;
    setProcessingId(item.memoId);
    try {
      await apiDelete('/memos', { memoId: item.memoId, timestamp: item.timestamp });
      await refreshAllData();
    } catch (err) {
      console.error('メモの削除に失敗しました', err);
      throw err;
    } finally {
      setProcessingId(null);
    }
  };

  // 家事実績の日付編集は spec の鉄則どおり「削除→再登録（新 UUID）」の2段で行う
  const updateTaskHistoryDate = async (item: TaskHistory, newDateKey: string) => {
    if (processingId || !mySub) return;

    setProcessingId(item.taskExecutionId);
    try {
      await apiDelete('/tasks/execute', {
        taskExecutionId: item.taskExecutionId,
        timestamp: item.timestamp,
        points: item.points,
      });
      const newExecutionId = crypto.randomUUID();
      const timestamp = dateKeyToTimestamp(newDateKey);
      try {
        await apiPost('/tasks/execute', {
          taskId: item.taskId,
          taskExecutionId: newExecutionId,
          timestamp,
        });
      } catch (createErr) {
        // delete は成功したが create が失敗 → 実状態を反映するため再取得してからユーザーに通知
        await refreshAllData().catch(() => {});
        throw createErr;
      }
      await refreshAllData();
    } catch (err) {
      console.error('家事の日付変更に失敗しました', err);
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
      weeklySummaries,
      negurai,
      memos,
      monthlySummaries,
      fetchMonthlySummaries,
      updateMyProfile,
      upsertTaskMaster,
      deleteTaskMaster,
      createTaskHistory,
      deleteTaskHistory,
      updateTaskHistoryDate,
      createNegurai,
      deleteNegurai,
      createMemo,
      deleteMemo,
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
