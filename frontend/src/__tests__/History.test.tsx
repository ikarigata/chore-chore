import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider } from '../context';
import History from '../pages/History';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('*/family/init', () => {
    return HttpResponse.json({
      users: [
        { cognitoSub: 'user1', displayName: 'パパ', totalPoints: 100 },
        { cognitoSub: 'user2', displayName: 'ママ', totalPoints: 120 },
      ],
      taskMasters: [{ taskId: 'task1', taskName: 'お風呂掃除', points: 10, categoryId: 'water' }],
    });
  }),
  http.get('*/summary/daily', () => {
    return HttpResponse.json({ date: '2026-05-23', summaries: [] });
  }),
  http.get('*/summary/weekly', () => {
    return HttpResponse.json({ from: '2026-05-17', to: '2026-05-23', summaries: [] });
  }),
  http.get('*/histories', () => {
    return HttpResponse.json({
      taskHistories: [
        {
          taskExecutionId: 'exec1',
          cognitoSub: 'user1',
          taskId: 'task1',
          points: 10,
          timestamp: '2026-05-23T08:00:00.000Z',
          expiresAt: 1779763200,
        },
        {
          taskExecutionId: 'exec2',
          cognitoSub: 'user2',
          taskId: 'task1',
          points: 10,
          timestamp: '2026-05-23T09:00:00.000Z',
          expiresAt: 1779763200,
        },
      ],
    });
  }),
  http.delete('*/tasks/execute', async ({ request }) => {
    const body = await request.json() as any;
    if (body.taskExecutionId === 'exec1') {
      return HttpResponse.json({ message: '家事の記録を取り消しました' });
    }
    return new HttpResponse(null, { status: 404 });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn().mockResolvedValue({
    tokens: {
      idToken: {
        payload: { sub: 'user1' },
        toString: () => 'mock-token',
      },
    },
  }),
}));

describe('History Page', () => {
  it('履歴が正しく表示され、自分の履歴のみ取り消しボタンが表示されること', async () => {
    render(
      <AppProvider>
        <History />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('あなた が完了')).toBeInTheDocument();
      expect(screen.getByText('ママ が完了')).toBeInTheDocument();
    });

    // パパ(user1=あなた)の履歴には取り消しボタンがあるはず
    const papaHistory = screen.getByText('あなた が完了').closest('.bg-white');
    const undoButton = papaHistory?.querySelector('button[title="取り消す"]');
    expect(undoButton).toBeInTheDocument();

    // ママ(user2)の履歴には取り消しボタンがないはず
    const mamaHistory = screen.getByText('ママ が完了').closest('.bg-white');
    const noUndoButton = mamaHistory?.querySelector('button[title="取り消す"]');
    expect(noUndoButton).not.toBeInTheDocument();
  });

  it('履歴の取り消しが実行できること', async () => {
    render(
      <AppProvider>
        <History />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('あなた が完了')).toBeInTheDocument();
    });

    const papaHistory = screen.getByText('あなた が完了').closest('.bg-white');
    const undoButton = papaHistory?.querySelector('button[title="取り消す"]');
    
    // API レスポンスの変更をシミュレート（削除後の再取得）
    server.use(
      http.get('*/histories', () => {
        return HttpResponse.json({
          taskHistories: [
            {
              taskExecutionId: 'exec2',
              cognitoSub: 'user2',
              taskId: 'task1',
              points: 10,
              timestamp: '2026-05-23T09:00:00.000Z',
              expiresAt: 1779763200,
            },
          ],
        });
      })
    );

    fireEvent.click(undoButton!);

    await waitFor(() => {
      expect(screen.queryByText('あなた が完了')).not.toBeInTheDocument();
      expect(screen.getByText('ママ が完了')).toBeInTheDocument();
    });
  });
});
