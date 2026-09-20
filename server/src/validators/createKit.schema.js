import { z } from 'zod';

const httpUrl = z
  .string()
  .trim()
  .min(1, 'Company URL is required')
  .refine((value) => {
    try {
      const { protocol } = new URL(value);
      return protocol === 'http:' || protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Enter a valid http(s) URL');


export const createKitSchema = z.object({

  jd: z
    .string()
    .trim()
    .min(10, 'Job description is too short')
    .max(20000, 'Job description is too long (max 20,000 characters)'),
  company_url: httpUrl,
  days: z.coerce.number().int('Days must be a whole number').min(1).max(365),
});