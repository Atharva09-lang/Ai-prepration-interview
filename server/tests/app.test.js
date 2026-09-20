import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app.js';

let server;
let base;

beforeAll(async () => {
  await new Promise((resolve) => {
    server = createApp().listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

describe('app skeleton', () => {
  it('GET /api/health returns ok', async () => {
    const res = await fetch(`${base}/api/health`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
  });

  it('unknown route returns a structured 404', async () => {
    const res = await fetch(`${base}/api/nope`);
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('malformed JSON returns a structured 400', async () => {
    const res = await fetch(`${base}/api/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad',
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('INVALID_JSON');
  });
});