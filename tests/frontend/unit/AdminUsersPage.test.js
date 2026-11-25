/**
 * Tests for frontend/src/pages/AdminUsersPage.js — the operator panel.
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  Navigate: ({ to }) => <div data-testid="navigate" data-to={to} />,
}));

const mockContext = jest.fn();
jest.mock('../../../frontend/src/context/AuthContext', () => ({
  useAuthContext: () => mockContext(),
}));

const mockLanguage = jest.fn(() => 'pt-BR');
jest.mock('../../../frontend/src/context/LanguageContext', () => ({
  useLanguage: () => ({ language: mockLanguage(), changeLanguage: jest.fn() }),
}));

jest.mock('../../../frontend/src/components/LanguageToggle', () =>
  function MockLanguageToggle() {
    return <div />;
  }
);

const mockApiFetch = jest.fn();
jest.mock('../../../frontend/src/config/api', () => ({
  apiFetch: (...args) => mockApiFetch(...args),
}));

import AdminUsersPage from '../../../frontend/src/pages/AdminUsersPage';

const answer = (status, body = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});

const account = (overrides) => ({
  id: 'usr_1',
  email: 'fulano@gmail.com',
  name: 'Fulano',
  status: 'pending',
  is_admin: false,
  profile: null,
  invited: false,
  email_authoritative: true,
  created_at: '2026-11-25T10:00:00+00:00',
  approved_at: null,
  last_login_at: '2026-11-25T10:00:00+00:00',
  ...overrides,
});

const operator = account({
  id: 'usr_op',
  email: 'op@gmail.com',
  name: 'Operador',
  status: 'approved',
  is_admin: true,
});

let listing;
let onPost;

const setup = async () => {
  mockApiFetch.mockImplementation(async (path, options = {}) => {
    if (path === '/api/version') return answer(200, { version: '2.0.0', commit: 'abcdef1234' });
    if (options.method === 'POST') return onPost(path, JSON.parse(options.body));
    return answer(200, listing);
  });
  await act(async () => {
    render(<AdminUsersPage />);
  });
};

const posts = () =>
  mockApiFetch.mock.calls
    .filter(([, options]) => options?.method === 'POST')
    .map(([path, options]) => [path, JSON.parse(options.body)]);

const row = (email) => screen.getByText(email).closest('tr');

beforeEach(() => {
  jest.clearAllMocks();
  mockLanguage.mockReturnValue('pt-BR');
  mockContext.mockReturnValue({ user: { userId: 'usr_op', isAdmin: true } });
  listing = { users: [account(), operator], invites: [], audit: [] };
  onPost = () => answer(200, {});
});

describe('who may see it', () => {
  test.each([{ user: { isAdmin: false } }, { user: null }])('not %p', async (context) => {
    mockContext.mockReturnValue(context);
    await setup();
    expect(screen.getByTestId('navigate').getAttribute('data-to')).toBe('/');
    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});

describe('accounts', () => {
  test('lists everyone with their status', async () => {
    await setup();
    expect(within(row('fulano@gmail.com')).getByText('pendente')).toBeInTheDocument();
    expect(within(row('op@gmail.com')).getByText('aprovado')).toBeInTheDocument();
    expect(within(row('op@gmail.com')).getByText('você')).toBeInTheDocument();
  });

  test('approves', async () => {
    await setup();
    listing = { ...listing, users: [account({ status: 'approved' }), operator] };
    await act(async () => {
      fireEvent.click(within(row('fulano@gmail.com')).getByText('aprovar'));
    });
    expect(posts()).toEqual([['/api/auth/admin/users/usr_1/status', { status: 'approved' }]]);
    expect(within(row('fulano@gmail.com')).getByText('aprovado')).toBeInTheDocument();
  });

  test('blocks', async () => {
    await setup();
    await act(async () => {
      fireEvent.click(within(row('fulano@gmail.com')).getByText('bloquear'));
    });
    expect(posts()).toEqual([['/api/auth/admin/users/usr_1/status', { status: 'blocked' }]]);
  });

  test('offers no way to block an administrator', async () => {
    await setup();
    expect(within(row('op@gmail.com')).queryByText('bloquear')).toBeNull();
  });

  test('a blocked account can only be approved again', async () => {
    listing = { ...listing, users: [account({ status: 'blocked' })] };
    await setup();
    expect(within(row('fulano@gmail.com')).queryByText('bloquear')).toBeNull();
    expect(within(row('fulano@gmail.com')).getByText('aprovar')).toBeInTheDocument();
  });

  test('warns when an invited address is not run by Google', async () => {
    listing = { ...listing, users: [account({ invited: true })] };
    await setup();
    expect(screen.getByText(/confirme com a pessoa/)).toBeInTheDocument();
  });

  test('tolerates an account without a name or a login date', async () => {
    listing = { ...listing, users: [account({ name: '', last_login_at: null })] };
    await setup();
    expect(screen.getAllByText('fulano@gmail.com').length).toBe(2);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  test('says so when there is nobody', async () => {
    listing = { ...listing, users: [] };
    await setup();
    expect(screen.getByText('Nenhuma conta ainda.')).toBeInTheDocument();
  });

  test('a refused change is reported and changes nothing on screen', async () => {
    onPost = () => answer(409, { error: 'protected_user' });
    await setup();
    await act(async () => {
      fireEvent.click(within(row('fulano@gmail.com')).getByText('bloquear'));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('A alteração não foi feita');
    expect(within(row('fulano@gmail.com')).getByText('pendente')).toBeInTheDocument();
  });

  test('so is a server that does not answer', async () => {
    onPost = () => Promise.reject(new TypeError('Failed to fetch'));
    await setup();
    await act(async () => {
      fireEvent.click(within(row('fulano@gmail.com')).getByText('aprovar'));
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('granting access by e-mail', () => {
  const typeAndSend = async (text) => {
    fireEvent.change(screen.getByLabelText('Liberar e-mails'), { target: { value: text } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Liberar' }));
    });
  };

  test('accepts commas, spaces, semicolons and lines', async () => {
    onPost = () => answer(200, { invited: 4, approved_now: 0 });
    await setup();
    await typeAndSend('a@x.com, b@x.com;c@x.com\n d@x.com ');
    expect(posts()).toEqual([
      ['/api/auth/admin/invites', { emails: ['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com'] }],
    ]);
    expect(screen.getByRole('status')).toHaveTextContent('4 e-mail(s) liberado(s)');
    expect(screen.getByLabelText('Liberar e-mails')).toHaveValue('');
  });

  test('tells who was already waiting', async () => {
    onPost = () => answer(200, { invited: 1, approved_now: 1 });
    await setup();
    await typeAndSend('a@x.com');
    expect(screen.getByRole('status')).toHaveTextContent('já esperava');
  });

  test('points at the invalid address and keeps what was typed', async () => {
    onPost = () => answer(400, { error: 'invalid_emails', invalid: ['sem-arroba'] });
    await setup();
    await typeAndSend('a@x.com sem-arroba');
    expect(screen.getByRole('alert')).toHaveTextContent('sem-arroba');
    expect(screen.getByLabelText('Liberar e-mails')).toHaveValue('a@x.com sem-arroba');
  });

  test('does nothing without an address', async () => {
    await setup();
    fireEvent.submit(screen.getByLabelText('Liberar e-mails').closest('form'));
    expect(posts()).toEqual([]);
  });

  test('lists open invites and cancels one', async () => {
    listing = { ...listing, invites: [{ email: 'novo@gmail.com', created_at: '2026-11-25' }] };
    onPost = () => ({ status: 204, ok: true, json: () => Promise.reject(new SyntaxError()) });
    await setup();
    await act(async () => {
      fireEvent.click(screen.getByText('cancelar'));
    });
    expect(posts()).toEqual([['/api/auth/admin/invites/revoke', { email: 'novo@gmail.com' }]]);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('the rest of the page', () => {
  test('shows the audit trail, including actions it does not know', async () => {
    listing = {
      ...listing,
      audit: [
        { ts: '2026-11-25T10:00:00+00:00', action: 'status_approved', detail: 'a@x.com' },
        { ts: '2026-11-25T09:00:00+00:00', action: 'something_new', detail: 'b@x.com' },
      ],
    };
    await setup();
    expect(screen.getByText(/a@x.com — aprovado/)).toBeInTheDocument();
    expect(screen.getByText(/b@x.com — something_new/)).toBeInTheDocument();
  });

  test('shows which versions are running', async () => {
    await setup();
    await waitFor(() => expect(screen.getByText(/backend v2\.0\.0 \(abcdef1\)/)).toBeInTheDocument());
  });

  test('survives a backend without a version route', async () => {
    mockApiFetch.mockImplementation(async (path) => {
      if (path === '/api/version') throw new TypeError('Failed to fetch');
      return answer(200, listing);
    });
    await act(async () => {
      render(<AdminUsersPage />);
    });
    expect(screen.getByText(/backend —/)).toBeInTheDocument();
  });

  test.each([
    ['refuses', () => Promise.resolve(answer(500))],
    ['is unreachable', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('says so when the server %s', async (_name, reply) => {
    mockApiFetch.mockImplementation(reply);
    await act(async () => {
      render(<AdminUsersPage />);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar');
  });

  test('speaks English, and falls back to it', async () => {
    mockLanguage.mockReturnValue('fr-FR');
    await setup();
    expect(screen.getByText('Users and access')).toBeInTheDocument();
  });
});
