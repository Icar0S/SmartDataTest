import { createHash, randomBytes } from 'node:crypto';
import type { BrowserContext, Page } from '@playwright/test';
import { apiURL, isLocal } from './target';

/**
 * A signed-in session for the tour.
 *
 * In production people sign in with Google. That cannot be automated without
 * keeping somebody's Google password in a script, so the operator opens a short
 * session on the server and passes it in DEMO_SESSION_TOKEN.
 *
 * Locally the tour starts a stand-in identity provider (tests/support/mock_oidc.py)
 * and signs in for real, through the same endpoints.
 */

/** Who the stand-in provider says is signing in. Invited before the API starts. */
export const DEMO_PERSON = {
  email: 'engineer@smartdatatest.com',
  name: 'Engineer SmartDataTest',
  domain: 'smartdatatest.com',
};

/** What the frontend keeps in storage (frontend/src/utils/authStorage.js). */
export type BrowserSession = {
  token: string;
  expiresAt: number;
  status: string;
  contact: string;
  userId: string;
  name: string;
  email: string;
  avatar: string;
  isAdmin: boolean;
  profile: string | null;
};

type ApiAnswer = {
  token?: string;
  expires_at: number;
  status: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string;
    is_admin: boolean;
    profile: string | null;
  };
};

const SESSION_KEY = 'smartdatatest_session';

const HOW_TO_GET_A_TOKEN = [
  'Em produção a gravação precisa de uma sessão aberta no servidor:',
  '',
  '  export DEMO_SESSION_TOKEN=$(docker exec dataforgetest-backend \\',
  '      python -m auth.cli sessao conta-de-demonstracao@gmail.com --horas 2)',
  '',
  'A conta precisa já ter entrado uma vez com Google e estar aprovada.',
].join('\n');

function toSession(data: ApiAnswer, token: string): BrowserSession {
  return {
    token,
    expiresAt: data.expires_at * 1000,
    status: data.status,
    contact: '',
    userId: data.user.id,
    name: data.user.name,
    email: data.user.email,
    avatar: data.user.avatar,
    isAdmin: data.user.is_admin,
    profile: data.user.profile,
  };
}

async function sessionFromToken(token: string): Promise<BrowserSession> {
  const response = await fetch(`${apiURL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 401) {
    throw new Error(`DEMO_SESSION_TOKEN expirou ou não é válido.\n\n${HOW_TO_GET_A_TOKEN}`);
  }
  if (!response.ok) throw new Error(`${apiURL}/api/auth/me respondeu ${response.status}`);
  const session = toSession((await response.json()) as ApiAnswer, token);
  if (session.status !== 'approved') {
    throw new Error(`A conta ${session.email} não está aprovada na plataforma.`);
  }
  return session;
}

/** The whole login, without a browser, against the stand-in provider. */
async function sessionFromStandInProvider(): Promise<BrowserSession> {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const follow = async (url: string, cookie = ''): Promise<{ next: string; cookie: string }> => {
    const response = await fetch(url, { redirect: 'manual', headers: cookie ? { cookie } : {} });
    const next = response.headers.get('location');
    if (!next) throw new Error(`${url} respondeu ${response.status}, sem redirecionar`);
    return { next, cookie: (response.headers.get('set-cookie') ?? '').split(';')[0] };
  };
  const start = await follow(`${apiURL}/api/auth/google/login?challenge=${challenge}`);
  const provider = await follow(start.next);
  const back = await follow(provider.next, start.cookie);
  const code = new URLSearchParams(new URL(back.next).hash.slice(1)).get('code');
  const response = await fetch(`${apiURL}/api/auth/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, verifier }),
  });
  if (!response.ok) throw new Error(`Login local falhou: ${response.status} ${await response.text()}`);
  const data = (await response.json()) as ApiAnswer;
  return toSession(data, data.token ?? '');
}

export async function demoSession(): Promise<BrowserSession> {
  const token = process.env.DEMO_SESSION_TOKEN;
  if (token) return sessionFromToken(token);
  if (isLocal) return sessionFromStandInProvider();
  throw new Error(HOW_TO_GET_A_TOKEN);
}

/** Pages opened from now on start signed in. */
export async function startSignedIn(context: BrowserContext, session: BrowserSession): Promise<void> {
  await context.addInitScript(
    ({ key, value }) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        // about:blank has no storage.
      }
    },
    {
      key: SESSION_KEY,
      // The pitch cut skips the profile step.
      value: JSON.stringify({ ...session, profile: session.profile ?? 'data_eng' }),
    },
  );
}

/** Signs in the page that is already open. */
export async function enterSession(page: Page, session: BrowserSession): Promise<void> {
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: SESSION_KEY, value: JSON.stringify(session) },
  );
}
