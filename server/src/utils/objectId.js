import { AppError } from './AppError.js';

const OBJECT_ID = /^[0-9a-f]{24}$/i;


export function assertObjectId(id, label = 'Resource') {
  if (typeof id !== 'string' || !OBJECT_ID.test(id)) {
    throw new AppError('NOT_FOUND', `${label} not found`, 404);
  }
  return id;
}