import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppProvider } from '../context';
import Settings from '../pages/Settings';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router-dom';

const server = setupServer(
  http.get('*/family/init', () => {
    return HttpResponse.json({
      users: [{ cognitoSub: 'user1', displayName: 'パパ', totalPoints: 100 }],
      taskMasters: [{ taskId: 'task1', taskName: 'お風呂掃除', points: 10, categoryId: 'water' }],
    });
  }),
  http.get('*/summary/daily', () => {
    return HttpResponse.json({ date: '2026-05-23', summaries: [] });
  }),
  http.get('*/histories', () => {
    return HttpResponse.json({ taskHistories: [] });
  }),
  http.put('*/tasks', async ({ request }) => {
    const body = await request.json() as any;
    if (body.taskName === '新しい家事') {
      return HttpResponse.json({ message: '家事設定を保存しました' });
    }
    return new HttpResponse(null, { status: 400 });
  }),
  http.delete('*/tasks/:taskId', ({ params }) => {
    if (params.taskId === 'task1') {
      return HttpResponse.json({ message: '家事設定を削除しました' });
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

// OutletContext のモック（QR表示用）
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useOutletContext: () => ({ onOpenQr: vi.fn() }),
  };
});

describe('Settings Page', () => {
  it('新しい家事を作成できること', async () => {
    render(
      <MemoryRouter>
        <AppProvider>
          <Settings />
        </AppProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('お風呂掃除')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('家事の名前'), { target: { value: '新しい家事' } });
    fireEvent.change(screen.getByDisplayValue('10'), { target: { value: '20' } });
    
    const submitButton = screen.getByText('家事マスタに追加');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('新しい家事')).toBeInTheDocument();
      expect(screen.getByText('20pt')).toBeInTheDocument();
    });
  });

  it('家事を削除できること', async () => {
    render(
      <MemoryRouter>
        <AppProvider>
          <Settings />
        </AppProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('お風呂掃除')).toBeInTheDocument();
    });

    // 削除ボタンをクリック（ゴミ箱アイコンは Trash2 というコンポーネント名だが、ボタン内の aria-label や title などがないため、role で探すか、コンテナから探す必要がある。ここでは Settings.tsx を見ると button に title="削除" は付いていない。Trash2 アイコンが入っているボタンを特定する）
    // 現状の実装を確認: <button onClick={() => handleDeleteTaskMaster(task.taskId)} ...>
    const deleteButtons = screen.getAllByRole('button');
    // 家事一覧の中の削除ボタン（最後の要素が削除ボタンになるはずだが、より安全に「お風呂掃除」の隣のボタンを探す）
    const taskContainer = screen.getByText('お風呂掃除').closest('div')?.parentElement;
    const deleteButton = taskContainer?.querySelector('button:last-child');
    
    if (!deleteButton) throw new Error('Delete button not found');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.queryByText('お風呂掃除')).not.toBeInTheDocument();
    });
  });
});
