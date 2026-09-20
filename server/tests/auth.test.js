import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app.js';
import { registerSchema } from '../src/validators/auth.schema.js';

let server;
let base;

beforeAll(async () => {
  await new Promise((resolve) => {
    server = createApp().listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

const post = (path, body) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('auth guards', () => {
  it('GET /api/auth/me without a session is 401 UNAUTHENTICATED', async () => {
    const res = await fetch(`${base}/api/auth/me`);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });

  it('register rejects an invalid email and a short password', async () => {
    const res = await post('/api/auth/register', { email: 'nope', password: 'short' });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    const paths = body.error.details.map((d) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['email', 'password']));
  });

  it('login rejects an empty body', async () => {
    const res = await post('/api/auth/login', {});
    expect(res.status).toBe(400);
  });

  it('logout without a session is a harmless 204', async () => {
    const res = await fetch(`${base}/api/auth/logout`, { method: 'POST' });
    expect(res.status).toBe(204);
  });
});

describe('registerSchema', () => {
  it('trims and lowercases the email', () => {
    const parsed = registerSchema.parse({ email: '  Test@Example.COM ', password: 'longenough1' });
    expect(parsed.email).toBe('test@example.com');
  });

  it('rejects passwords longer than 72 characters', () => {
    const result = registerSchema.safeParse({ email: 'a@b.com', password: 'x'.repeat(73) });
    expect(result.success).toBe(false);
  });
});