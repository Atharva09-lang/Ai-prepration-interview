import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { registerUser, verifyCredentials, getUserById } from '../services/auth.service.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../config/session.js';

// New session id on every login/register prevents session fixation.
const startSession = (req, userId) =>
  new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId.toString();
      req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
    });
  });

export const register = asyncHandler(async (req, res) => {
  const user = await registerUser(req.validated.body);
  await startSession(req, user._id);
  res.status(201).json({ user });
});

export const login = asyncHandler(async (req, res) => {
  const user = await verifyCredentials(req.validated.body);
  await startSession(req, user._id);
  res.json({ user });
});

export const logout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions);
    res.status(204).end();
  });
};

export const me = asyncHandler(async (req, res) => {
  const user = await getUserById(req.userId);
  if (!user) {
    // Session points at a user that no longer exists: treat as signed out.
    await new Promise((resolve) => req.session.destroy(resolve));
    res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions);
    throw new AppError('UNAUTHENTICATED', 'Please sign in to continue', 401);
  }
  res.json({ user });
});