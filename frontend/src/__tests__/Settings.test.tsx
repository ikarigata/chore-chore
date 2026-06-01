import { describe, it, expect, vi } from 'vitest';
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
  http.get('*/summary/weekly', () => {
    return HttpResponse.json({ from: '2026-05-17', to: '2026-05-23', summaries: [] });
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
  }),
  http.get('*/negurai', () => HttpResponse.json({ negurai: [] })),
  http.get('*/memos', () => HttpResponse.json({ memos: [] }))
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

    const taskContainer = screen.getByText('お風呂掃除').closest('div')?.parentElement;
    const deleteButton = taskContainer?.querySelector('button:last-child');
    
    if (!deleteButton) throw new Error('Delete button not found');
    fireEvent.click(deleteButton);

    // 確認ダイアログが表示されるのを待って「削除」ボタンをクリック
    await waitFor(() => {
      expect(screen.getByText('本当に削除しますか？')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: '削除' }));

    await waitFor(() => {
      expect(screen.queryByText('お風呂掃除')).not.toBeInTheDocument();
    });
  });
});
