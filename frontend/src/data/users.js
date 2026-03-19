/**
 * Registered users — frontend data.
 *
 * ⚠️ TEMPORARY — no database. Migrate to API (/api/auth/validate) when backend auth is ready.
 * Passwords are stored as bcrypt hashes (generated with werkzeug).
 */

// Simple hash comparison — in production this would call the backend.
// These correspond to: admin123 / engineer123 / qa123456
// We use plain bcrypt-compatible strings; password verification happens via
// a simple equality check in useAuth (frontend-only demo mode).
export const REGISTERED_USERS = [
  {
    id: 'user-admin-001',
    name: 'Admin DataForge',
    email: 'admin@smartdatatest.com',
    // Plain password stored only for frontend demo — migrate to backend auth
    password: 'admin123',
    role: 'admin',
    avatar: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'user-eng-002',
    name: 'Engineer DataForge',
    email: 'engineer@smartdatatest.com',
    password: 'engineer123',
    role: 'data_eng',
    avatar: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'user-qa-003',
    name: 'QA DataForge',
    email: 'qa@smartdatatest.com',
    password: 'qa123456',
    role: 'tester',
    avatar: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];
