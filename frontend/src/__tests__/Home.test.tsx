import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider } from '../context';
import Home from '../pages/Home';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('*/family/init', () => {
    return HttpResponse.json({
      users: [{ cognitoSub: 'user1', displayName: 'パパ', totalPoints: 100 }],
      taskMasters: [{ taskId: 'task1', taskName: 'お風呂掃除', points: 10, categoryId: 'water' }],
    });
  }),
  http.get('*/summary/daily', () => {
    return HttpResponse.json({
      date: '2026-05-23',
      summaries: [{ cognitoSub: 'user1', date: '2026-05-23', dailyPoints: 20 }],
    });
  }),
  http.get('*/histories', () => {
    return HttpResponse.json({ taskHistories: [] });
  }),
  http.post('*/tasks/execute', async ({ request }) => {
    const body = await request.json() as { taskId: string; taskExecutionId: string };
    if (body.taskId === 'task1') {
      return HttpResponse.json({ message: '家事を記録しました' });
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

describe('Home Page', () => {
  it('家事カテゴリを選択して家事を実行できること', async () => {
    render(
      <AppProvider>
        <Home />
      </AppProvider>
    );

    // ロード完了を待つ
    await waitFor(() => {
      expect(screen.getAllByText('パパ')[0]).toBeInTheDocument();
    });

    // カテゴリ「水回り」をクリック
    const waterCategory = screen.getByText('水回り');
    fireEvent.click(waterCategory);

    // 家事「お風呂掃除」が表示されることを確認
    expect(screen.getByText('お風呂掃除')).toBeInTheDocument();
    expect(screen.getByText('10 pt')).toBeInTheDocument();

    // 「やった！」ボタンをクリック
    const executeButton = screen.getByText('やった！');
    fireEvent.click(executeButton);

    // ローディング表示を確認（processingId の影響）
    expect(executeButton).toBeDisabled();
    
    // 実行完了後の再読み込みなどを待つ（モックでは即座に終わる）
    await waitFor(() => {
      expect(executeButton).not.toBeDisabled();
    });
  });
});
