import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Onboarding from '../pages/Onboarding';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router-dom';
import { INVITE_TOKEN_KEY } from '../pages/Auth';

const server = setupServer(
  http.post('*/families', async ({ request }) => {
    const body = await request.json() as { displayName: string };
    if (body.displayName === 'パパ') {
      return HttpResponse.json({ familyId: 'fam_123' });
    }
    return new HttpResponse(null, { status: 400 });
  }),
  http.post('*/families/join', async ({ request }) => {
    const body = await request.json() as { token: string, displayName: string };
    if (body.token === 'mock-token' && body.displayName === 'ママ') {
      return HttpResponse.json({ familyId: 'fam_123' });
    }
    return new HttpResponse(null, { status: 400 });
  })
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());

// Amplify のモック
const mockFetchAuthSession = vi.fn().mockResolvedValue({
  tokens: {
    idToken: {
      payload: { sub: 'user1' },
      toString: () => 'mock-token',
    },
  },
});

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: (...args: any[]) => mockFetchAuthSession(...args),
}));

// useNavigate のモック
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Onboarding Page', () => {
  it('新しい家族を作成できること', async () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    );

    expect(screen.getByText('家族をつくる')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/ニックネーム/), { target: { value: 'パパ' } });
    fireEvent.click(screen.getByText('はじめる'));

    await waitFor(() => {
      expect(mockFetchAuthSession).toHaveBeenCalledWith({ forceRefresh: true });
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('招待トークンがある場合、既存の家族に参加できること', async () => {
    localStorage.setItem(INVITE_TOKEN_KEY, 'mock-token');

    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    );

    expect(screen.getByText('家族に参加する')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/ニックネーム/), { target: { value: 'ママ' } });
    fireEvent.click(screen.getByText('参加する'));

    await waitFor(() => {
      expect(mockFetchAuthSession).toHaveBeenCalledWith({ forceRefresh: true });
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
      expect(localStorage.getItem(INVITE_TOKEN_KEY)).toBeNull();
    });
  });

  it('APIエラー時にエラーメッセージが表示されること', async () => {
    server.use(
      http.post('*/families', () => {
        return HttpResponse.json({ message: 'エラーが発生しました' }, { status: 500 });
      })
    );

    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/ニックネーム/), { target: { value: 'パパ' } });
    fireEvent.click(screen.getByText('はじめる'));

    await waitFor(() => {
      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument();
    });
  });
});
