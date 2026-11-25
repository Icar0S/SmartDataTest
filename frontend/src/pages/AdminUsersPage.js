import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import LanguageToggle from '../components/LanguageToggle';
import { apiFetch } from '../config/api';
import { APP_COMMIT, versionLabel } from '../config/version';
import { useAuthContext } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------
const translations = {
  'pt-BR': {
    title: 'Usuários e acessos',
    subtitle: 'Quem pode usar a plataforma. Bloquear tem efeito na próxima requisição da pessoa.',
    back: '← Início',
    inviteTitle: 'Liberar e-mails',
    inviteHint:
      'Quem está nesta lista entra direto no primeiro login. Um por linha, ou separados por vírgula.',
    invitePlaceholder: 'fulano@gmail.com',
    inviteButton: 'Liberar',
    invitesOpen: 'Liberados que ainda não entraram',
    revoke: 'cancelar',
    users: 'Contas',
    who: 'Quem',
    status: 'Situação',
    since: 'Desde',
    lastLogin: 'Último login',
    actions: 'Ações',
    none: 'Nenhuma conta ainda.',
    approve: 'aprovar',
    block: 'bloquear',
    admin: 'admin',
    you: 'você',
    invitedNotGoogle:
      'Este e-mail está liberado, mas não é do Google: confirme com a pessoa antes de aprovar.',
    statuses: { pending: 'pendente', approved: 'aprovado', blocked: 'bloqueado' },
    audit: 'Últimas ações',
    auditActions: {
      user_created: 'entrou pela primeira vez',
      status_approved: 'aprovado',
      status_blocked: 'bloqueado',
      status_pending: 'voltou para pendente',
      approved_by_invite: 'aprovado por convite',
      invited: 'e-mail liberado',
      invite_revoked: 'liberação cancelada',
      admin_granted: 'tornou-se administrador',
      admin_removed: 'deixou de ser administrador',
      session_created: 'sessão aberta no servidor',
    },
    versions: 'Versões em execução',
    loadError: 'Não foi possível carregar. Tente de novo em instantes.',
    actionError: 'A alteração não foi feita. Tente de novo em instantes.',
    invalidEmails: 'E-mail inválido:',
    invited: (n, now) =>
      `${n} e-mail(s) liberado(s).${now ? ` ${now} já esperava(m) e entrou(aram) agora.` : ''}`,
  },
  'en-US': {
    title: 'Users and access',
    subtitle: "Who may use the platform. Blocking takes effect on the person's next request.",
    back: '← Home',
    inviteTitle: 'Grant access by e-mail',
    inviteHint: 'People listed here get in on their first sign-in. One per line, or comma-separated.',
    invitePlaceholder: 'someone@gmail.com',
    inviteButton: 'Grant',
    invitesOpen: 'Granted, not signed in yet',
    revoke: 'cancel',
    users: 'Accounts',
    who: 'Who',
    status: 'Status',
    since: 'Since',
    lastLogin: 'Last sign-in',
    actions: 'Actions',
    none: 'No accounts yet.',
    approve: 'approve',
    block: 'block',
    admin: 'admin',
    you: 'you',
    invitedNotGoogle:
      'This e-mail was granted, but is not run by Google: check with the person before approving.',
    statuses: { pending: 'pending', approved: 'approved', blocked: 'blocked' },
    audit: 'Latest actions',
    auditActions: {
      user_created: 'signed in for the first time',
      status_approved: 'approved',
      status_blocked: 'blocked',
      status_pending: 'back to pending',
      approved_by_invite: 'approved by invite',
      invited: 'e-mail granted',
      invite_revoked: 'grant cancelled',
      admin_granted: 'became an administrator',
      admin_removed: 'no longer an administrator',
      session_created: 'session opened on the server',
    },
    versions: 'Running versions',
    loadError: 'Could not load. Please try again in a moment.',
    actionError: 'The change was not made. Please try again in a moment.',
    invalidEmails: 'Invalid e-mail:',
    invited: (n, now) =>
      `${n} e-mail(s) granted.${now ? ` ${now} was/were already waiting and got in now.` : ''}`,
  },
};

const STATUS_STYLES = {
  pending: 'text-yellow-300 border-yellow-600/60',
  approved: 'text-green-300 border-green-600/60',
  blocked: 'text-red-300 border-red-600/60',
};

// The server stores UTC; people read their own clock.
const day = (iso, language) => (iso ? new Date(iso).toLocaleDateString(language) : '—');
const minute = (iso, language) =>
  iso ? new Date(iso).toLocaleString(language, { dateStyle: 'short', timeStyle: 'short' }) : '—';
const splitEmails = (text) => text.split(/[\s,;]+/).filter(Boolean);

const post = (path, body) =>
  apiFetch(`/api/auth/admin${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

function Card({ title, children }) {
  return (
    <section className="bg-gray-800/40 border border-gray-700/40 rounded-2xl p-5 mb-6">
      <h2 className="text-white font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function UsersTable({ users, currentId, t, language, onStatus, busy }) {
  if (users.length === 0) return <p className="text-sm text-gray-400">{t.none}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-xs uppercase text-gray-500">
          <tr>
            {[t.who, t.status, t.since, t.lastLogin, t.actions].map((label) => (
              <th key={label} className="py-2 pr-4 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-gray-700/40 align-top">
              <td className="py-3 pr-4">
                <p className="text-white">
                  {u.name || u.email}
                  {u.is_admin && <span className="ml-2 text-xs text-purple-300">{t.admin}</span>}
                  {u.id === currentId && <span className="ml-2 text-xs text-gray-500">{t.you}</span>}
                </p>
                <p className="text-gray-400 break-all">{u.email}</p>
                {u.invited && u.status === 'pending' && (
                  <p className="text-xs text-yellow-300 mt-1">{t.invitedNotGoogle}</p>
                )}
              </td>
              <td className="py-3 pr-4">
                <span className={`text-xs border rounded-full px-2 py-0.5 ${STATUS_STYLES[u.status]}`}>
                  {t.statuses[u.status]}
                </span>
              </td>
              <td className="py-3 pr-4 text-gray-400 whitespace-nowrap">{day(u.created_at, language)}</td>
              <td className="py-3 pr-4 text-gray-400 whitespace-nowrap">{minute(u.last_login_at, language)}</td>
              <td className="py-3 whitespace-nowrap">
                {u.status !== 'approved' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onStatus(u, 'approved')}
                    className="mr-3 text-green-300 hover:text-green-200 disabled:opacity-50"
                  >
                    {t.approve}
                  </button>
                )}
                {/* Administrators are only blocked from the server itself. */}
                {u.status !== 'blocked' && !u.is_admin && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onStatus(u, 'blocked')}
                    className="text-red-300 hover:text-red-200 disabled:opacity-50"
                  >
                    {t.block}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Operator panel: who may use the platform. */
export default function AdminUsersPage() {
  const { user } = useAuthContext();
  const { language } = useLanguage();
  const t = translations[language] ?? translations['en-US'];

  const [data, setData] = useState(null);
  const [backendVersion, setBackendVersion] = useState(null);
  const [emails, setEmails] = useState('');
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);

  const isAdmin = Boolean(user?.isAdmin);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch('/api/auth/admin/users');
      if (!response.ok) throw new Error(String(response.status));
      setData(await response.json());
      return true;
    } catch {
      setProblem('load');
      return false;
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    load();
    apiFetch('/api/version')
      .then((response) => (response.ok ? response.json() : null))
      .then(setBackendVersion)
      .catch(() => {});
  }, [isAdmin, load]);

  if (!isAdmin) return <Navigate to="/" replace />;

  const run = async (action, onDone = () => {}) => {
    setBusy(true);
    setProblem('');
    setMessage('');
    try {
      const response = await action();
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setProblem(body.invalid ? `${t.invalidEmails} ${body.invalid.join(', ')}` : 'action');
        return;
      }
      onDone(body);
      await load();
    } catch {
      setProblem('action');
    } finally {
      setBusy(false);
    }
  };

  const onStatus = (target, status) => run(() => post(`/users/${target.id}/status`, { status }));

  const onInvite = (event) => {
    event.preventDefault();
    const list = splitEmails(emails);
    if (list.length === 0) return;
    run(
      () => post('/invites', { emails: list }),
      (body) => {
        setEmails('');
        setMessage(t.invited(body.invited, body.approved_now));
      }
    );
  };

  const onRevoke = (email) => run(() => post('/invites/revoke', { email }));

  const problemText = { load: t.loadError, action: t.actionError }[problem] ?? problem;
  const backendLabel = backendVersion ? `v${backendVersion.version}`.replace('vdev', 'dev') : '—';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#1a1a2e] text-white">
      <header className="border-b border-gray-700/50 bg-gray-900/70 backdrop-blur-md px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-sm text-gray-400 hover:text-white">
            {t.back}
          </Link>
          <LanguageToggle size="sm" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 text-left">
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="text-sm text-gray-400 mt-1 mb-6">{t.subtitle}</p>

        {problemText && (
          <div
            role="alert"
            className="bg-red-900/30 border border-red-700/50 rounded-lg px-4 py-3 mb-6 text-sm text-red-300"
          >
            {problemText}
          </div>
        )}
        {message && (
          <div
            role="status"
            className="bg-green-900/30 border border-green-700/50 rounded-lg px-4 py-3 mb-6 text-sm text-green-300"
          >
            {message}
          </div>
        )}

        <Card title={t.inviteTitle}>
          <p className="text-sm text-gray-400 mb-3">{t.inviteHint}</p>
          <form onSubmit={onInvite} className="flex flex-col sm:flex-row gap-3">
            <textarea
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder={t.invitePlaceholder}
              aria-label={t.inviteTitle}
              rows={2}
              className="flex-1 bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <button
              type="submit"
              disabled={busy || splitEmails(emails).length === 0}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 text-white font-semibold px-6 py-2 rounded-lg"
            >
              {t.inviteButton}
            </button>
          </form>
          {data?.invites.length > 0 && (
            <div className="mt-4">
              <p className="text-xs uppercase text-gray-500 mb-2">{t.invitesOpen}</p>
              <ul className="text-sm text-gray-300">
                {data.invites.map((invite) => (
                  <li key={invite.email} className="py-1">
                    {invite.email}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRevoke(invite.email)}
                      className="ml-3 text-xs text-gray-500 hover:text-red-300"
                    >
                      {t.revoke}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {data && (
          <Card title={`${t.users} (${data.users.length})`}>
            <UsersTable
              users={data.users}
              currentId={user.userId}
              t={t}
              language={language}
              onStatus={onStatus}
              busy={busy}
            />
          </Card>
        )}

        {data?.audit.length > 0 && (
          <Card title={t.audit}>
            <ul className="text-sm text-gray-400">
              {data.audit.map((entry, index) => (
                <li key={`${entry.ts}-${index}`} className="py-1">
                  <span className="text-gray-500 font-mono text-xs mr-3">{minute(entry.ts, language)}</span>
                  {entry.detail} — {t.auditActions[entry.action] ?? entry.action}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card title={t.versions}>
          <p className="text-sm text-gray-400 font-mono">
            frontend {versionLabel()}
            {APP_COMMIT && ` (${APP_COMMIT.slice(0, 7)})`} · backend {backendLabel}
            {backendVersion && ` (${backendVersion.commit.slice(0, 7)})`}
          </p>
        </Card>
      </main>
    </div>
  );
}
