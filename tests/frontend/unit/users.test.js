/**
 * Tests for frontend/src/data/users.js
 * Validates the registered users data structure used for frontend-only demo auth.
 */

import { REGISTERED_USERS } from '../../../frontend/src/data/users';

describe('REGISTERED_USERS', () => {
  test('is a non-empty array', () => {
    expect(Array.isArray(REGISTERED_USERS)).toBe(true);
    expect(REGISTERED_USERS.length).toBeGreaterThanOrEqual(3);
  });

  test('each user has the required fields', () => {
    REGISTERED_USERS.forEach((user) => {
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('name');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('password');
      expect(user).toHaveProperty('role');
      expect(user).toHaveProperty('avatar');
      expect(user).toHaveProperty('createdAt');
    });
  });

  test('all user ids are unique', () => {
    const ids = REGISTERED_USERS.map((u) => u.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  test('all user emails are unique', () => {
    const emails = REGISTERED_USERS.map((u) => u.email);
    const unique = new Set(emails);
    expect(unique.size).toBe(emails.length);
  });

  test('admin user exists with correct role', () => {
    const admin = REGISTERED_USERS.find((u) => u.email === 'admin@dataforgetest.com');
    expect(admin).toBeDefined();
    expect(admin.role).toBe('admin');
    expect(admin.password).toBe('admin123');
  });

  test('engineer user exists with correct role', () => {
    const eng = REGISTERED_USERS.find((u) => u.email === 'engineer@dataforgetest.com');
    expect(eng).toBeDefined();
    expect(eng.role).toBe('data_eng');
    expect(eng.password).toBe('engineer123');
  });

  test('qa user exists with correct role', () => {
    const qa = REGISTERED_USERS.find((u) => u.email === 'qa@dataforgetest.com');
    expect(qa).toBeDefined();
    expect(qa.role).toBe('tester');
    expect(qa.password).toBe('qa123456');
  });

  test('avatar field is null for all demo users', () => {
    REGISTERED_USERS.forEach((user) => {
      expect(user.avatar).toBeNull();
    });
  });

  test('createdAt is a valid ISO date string', () => {
    REGISTERED_USERS.forEach((user) => {
      const date = new Date(user.createdAt);
      expect(date.toString()).not.toBe('Invalid Date');
    });
  });
});
