import session from 'express-session';
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import { env, isProduction } from './env.js';

export const SESSION_COOKIE_NAME = 'sid';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const sessionCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  // In production the frontend and API are typically on different hosts, so the
  // session cookie is sent on cross-site requests and must be SameSite=None
  // (which browsers only honour over HTTPS — hence `secure` above). Locally both
  // run on `localhost`, which is same-site, so `lax` is fine and stricter.
  sameSite: isProduction ? 'none' : 'lax',
  maxAge: SESSION_TTL_MS,
};


export function createMongoSessionStore() {
  return MongoStore.create({
    client: mongoose.connection.getClient(),
    collectionName: 'sessions',
    ttl: SESSION_TTL_MS / 1000,
  });
}


export function sessionMiddleware(store) {
  return session({
    name: SESSION_COOKIE_NAME,
    secret: env.SESSION_SECRET ?? (env.NODE_ENV === 'test' ? 'test-only-secret' : undefined),
    resave: false,
    saveUninitialized: false,
    rolling: true, 
    store,
    cookie: sessionCookieOptions,
  });
}