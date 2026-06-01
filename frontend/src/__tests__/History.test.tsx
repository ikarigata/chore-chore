import { describe, it, expect, vi } from 'vitest';
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
    const body = await request.json() as { taskExecutionId: string };
    if (body.taskExecutionId === 'exec1') {
      return HttpResponse.json({ message: '家事の記録を取り消しました' });
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

function findCardForUserLabel(label: string): HTMLElement {
  const labelNode = screen.getByText(label);
  // メンバー名は <div class="flex-1 p-3 rounded-2xl bg-white ..."> の中のカード
  const card = labelNode.closest('div.bg-white');
  if (!card) throw new Error(`Card for ${label} not found`);
  return card as HTMLElement;
}

describe('History Page', () => {
  it('履歴が正しく表示され、自分の履歴のみ取り消しと日付変更ボタンが表示されること', async () => {
    render(
      <AppProvider>
        <History />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('あなた')).toBeInTheDocument();
      expect(screen.getByText('ママ')).toBeInTheDocument();
    });

    const myCard = findCardForUserLabel('あなた');
    expect(myCard.querySelector('button[title="取り消す"]')).toBeInTheDocument();
    expect(myCard.querySelector('button[title="日付を変更"]')).toBeInTheDocument();

    const otherCard = findCardForUserLabel('ママ');
    expect(otherCard.querySelector('button[title="取り消す"]')).not.toBeInTheDocument();
    expect(otherCard.querySelector('button[title="日付を変更"]')).not.toBeInTheDocument();
  });

  it('履歴の取り消しが実行できること', async () => {
    render(
      <AppProvider>
        <History />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('あなた')).toBeInTheDocument();
    });

    const myCard = findCardForUserLabel('あなた');
    const undoButton = myCard.querySelector('button[title="取り消す"]') as HTMLButtonElement;

    // 削除後の再取得をシミュレート
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

    fireEvent.click(undoButton);

    await waitFor(() => {
      expect(screen.queryByText('あなた')).not.toBeInTheDocument();
      expect(screen.getByText('ママ')).toBeInTheDocument();
    });
  });

  it('日付変更で DELETE → POST の順で呼ばれ、新しい UUID と新しい timestamp が送信される', async () => {
    const deleteBodies: any[] = [];
    const postBodies: any[] = [];
    server.use(
      http.delete('*/tasks/execute', async ({ request }) => {
        deleteBodies.push(await request.json());
        return HttpResponse.json({ message: 'OK' });
      }),
      http.post('*/tasks/execute', async ({ request }) => {
        postBodies.push(await request.json());
        return HttpResponse.json({ message: 'OK' });
      }),
    );

    render(
      <AppProvider>
        <History />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('あなた')).toBeInTheDocument();
    });

    const myCard = findCardForUserLabel('あなた');
    const editButton = myCard.querySelector('button[title="日付を変更"]') as HTMLButtonElement;
    fireEvent.click(editButton);

    // DateChipSheet が開く
    await waitFor(() => {
      expect(screen.getByText('実績日を変更')).toBeInTheDocument();
    });

    // 「昨日」を選択（履歴側にも「昨日」セパレーターが出る可能性があるので role で絞る）
    const yesterdayButton = screen.getByRole('button', { name: '昨日' });
    fireEvent.click(yesterdayButton);

    await waitFor(() => {
      expect(deleteBodies).toHaveLength(1);
      expect(postBodies).toHaveLength(1);
    });

    // DELETE は元の execId + timestamp
    expect(deleteBodies[0].taskExecutionId).toBe('exec1');
    expect(deleteBodies[0].timestamp).toBe('2026-05-23T08:00:00.000Z');

    // POST は元と異なる新 UUID、 timestamp も新日付
    expect(postBodies[0].taskExecutionId).not.toBe('exec1');
    expect(postBodies[0].taskExecutionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(postBodies[0].taskId).toBe('task1');
    expect(typeof postBodies[0].timestamp).toBe('string');
    // 昨日選択は JST 正午合成 → ISO 化されているので元 timestamp と必ず異なる
    expect(postBodies[0].timestamp).not.toBe('2026-05-23T08:00:00.000Z');
  });
});
