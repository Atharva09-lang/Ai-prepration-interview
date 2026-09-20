import bcrypt from 'bcrypt';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

const BCRYPT_ROUNDS = 12;
// Compared against when the email is unknown, so "no such user" and "wrong password"
// take about the same time.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

export async function registerUser({ email, password }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  try {
    return await User.create({ email, passwordHash });
  } catch (err) {
    // Unique index race: two requests registering the same email at once
    if (err?.code === 11000) {
      throw new AppError('EMAIL_TAKEN', 'An account with this email already exists', 409);
    }
    throw err;
  }
}

export async function verifyCredentials({ email, password }) {
  const user = await User.findOne({ email });
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) {
    throw new AppError('INVALID_CREDENTIALS', 'Incorrect email or password', 401);
  }
  return user;
}

export function getUserById(id) {
  return User.findById(id);
}