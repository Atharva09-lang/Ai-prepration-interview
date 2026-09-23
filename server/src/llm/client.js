

import { env } from '../config/env.js';
import { mockGenerate } from './mock.js';
import { AppError } from '../utils/AppError.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 2000;

const MAX_DELAY_MS = 60_000;

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const GEMINI_MODEL = (process.env.GEMINI_MODEL || 'gemini-3-flash-preview')
  .trim()
  .replace(/^models\//, '');

function isRetryableStatus(status) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}


function retryDelaySeconds(headerValue, bodyText) {
  const header = Number(headerValue);
  if (Number.isFinite(header) && header > 0) return header;

  if (typeof bodyText === 'string') {
    const iso = bodyText.match(/"retryDelay"\s*:\s*"([\d.]+)s"/);
    if (iso) {
      const secs = Number(iso[1]);
      if (Number.isFinite(secs) && secs > 0) return secs;
    }
    const prose = bodyText.match(/retry in ([\d.]+)\s*s/i);
    if (prose) {
      const secs = Number(prose[1]);
      if (Number.isFinite(secs) && secs > 0) return secs;
    }
  }
  return null;
}


async function callGemini(prompt, retryOnJsonError = true) {
  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  };

  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        const errText = await res.text().catch(() => '');
        const secs = retryDelaySeconds(res.headers.get('retry-after'), errText);
        const backoffSec = Number.isFinite(secs) && secs > 0
          ? secs
          : (BASE_DELAY_MS / 1000) * 2 ** attempt;
        const delay = Math.min(backoffSec * 1000, MAX_DELAY_MS);
        if (attempt < MAX_RETRIES) {
          await sleep(delay);
          continue;
        }
        throw new AppError('LLM_RATE_LIMITED', 'LLM provider rate limited — too many requests', 429);
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        lastError = new AppError('LLM_ERROR', `Gemini API error: ${res.status}`, 502);
        if (isRetryableStatus(res.status) && attempt < MAX_RETRIES) {
          const secs = retryDelaySeconds(res.headers.get('retry-after'), errText);
          const backoffSec = Number.isFinite(secs) && secs > 0
            ? secs
            : (BASE_DELAY_MS / 1000) * 2 ** attempt;
          await sleep(Math.min(backoffSec * 1000, MAX_DELAY_MS));
          continue;
        }
        throw lastError;
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

     
      try {
        return JSON.parse(rawText);
      } catch (parseErr) {
      
        const match = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) {
          try {
            return JSON.parse(match[1]);
          } catch {   }
        }

        if (retryOnJsonError && attempt < MAX_RETRIES) {
          await sleep(BASE_DELAY_MS);
        
          return callGemini(prompt, false);
        }

        throw new AppError(
          'LLM_INVALID_JSON',
          `LLM returned invalid JSON: ${parseErr.message}`,
          422,
        );
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      lastError = err;
      if (attempt < MAX_RETRIES) {
        await sleep(BASE_DELAY_MS * 2 ** attempt);
      }
    }
  }

  throw lastError ?? new AppError('LLM_ERROR', 'LLM call failed after retries', 502);
}

/**
 *
 * @param {{ type: string; prompt: string; useMock?: boolean }} opts
 * @returns {Promise<object>}  
 */
export async function generateStructured({ type, prompt, useMock }) {
  if (!type) throw new Error('LLM generation type is required');


  const shouldMock = useMock ?? !env.GEMINI_API_KEY;

  if (shouldMock) {
    return mockGenerate(type);
  }

  return callGemini(prompt);
}