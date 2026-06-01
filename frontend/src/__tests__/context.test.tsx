import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AppProvider, useApp } from '../context';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// API のモック
const server = setupServer(
  http.get('*/family/init', () => {
    return HttpResponse.json({
      users: [
        { cognitoSub: 'user1', displayName: 'パパ', totalPoints: 100 },
      ],
      taskMasters: [
        { taskId: 'task1', taskName: 'お風呂掃除', points: 10, categoryId: 'water' },
      ],
    });
  }),
  http.get('*/summary/daily', () => {
    return HttpResponse.json({
      date: '2026-05-23',
      summaries: [
        { cognitoSub: 'user1', date: '2026-05-23', dailyPoints: 20 },
      ],
    });
  }),
  http.get('*/summary/weekly', () => {
    return HttpResponse.json({
      from: '2026-05-17',
      to: '2026-05-23',
      summaries: [
        { cognitoSub: 'user1', date: '2026-05-23', dailyPoints: 20 },
      ],
    });
  }),
  http.get('*/histories', () => {
    return HttpResponse.json({
      taskHistories: [],
    });
  }),
  http.get('*/negurai', () => {
    return HttpResponse.json({ negurai: [] });
  }),
  http.get('*/memos', () => {
    return HttpResponse.json({ memos: [] });
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Amplify のモック
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

const TestComponent = () => {
  const { initialized, members, taskMasters } = useApp();
  if (!initialized) return <div>Loading...</div>;
  return (
    <div>
      <div data-testid="user-count">{members.length}</div>
      <div data-testid="task-count">{taskMasters.length}</div>
      <div data-testid="user-name">{members[0]?.displayName}</div>
    </div>
  );
};

describe('AppProvider', () => {
  it('初期データが正しく読み込まれること', async () => {
    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('user-count')).toHaveTextContent('1');
    expect(screen.getByTestId('task-count')).toHaveTextContent('1');
    expect(screen.getByTestId('user-name')).toHaveTextContent('パパ');
  });
});
