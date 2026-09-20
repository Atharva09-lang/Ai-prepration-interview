import { AppError } from '../utils/AppError.js';

export function requireAuth(req, res, next) {
  const userId = req.session?.userId;
  if (!userId) {
    return next(new AppError('UNAUTHENTICATED', 'Please sign in to continue', 401));
  }
  req.userId = userId;
  next();
}