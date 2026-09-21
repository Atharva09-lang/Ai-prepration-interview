/**
 * llm/client.js — unified LLM client.
 *
 * Provider selection:
 *  - GEMINI_API_KEY set → use Google Gemini (gemini-1.5-flash, free tier)
 *  - Otherwise          → use the mock (safe for tests and local dev without a key)
 *
 * Retry policy:
 *  - Up to 3 attempts total (initial + 2 retries)
 *  - Exponential backoff: 2s, 4s
 *  - On 429, respects Retry-After header when present
 *  - On invalid JSON, retries once; second failure throws AppError
 */

import { env } from '../config/env.js';
import { mockGenerate } from './mock.js';
import { AppError } from '../utils/AppError.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 2000;

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = 'gemini-1.5-flash';

function isRetryableStatus(status) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

/**
 * Calls Gemini with the given prompt and returns parsed JSON.
 * Throws on unrecoverable errors.
 */
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
        const retryAfter = Number(res.headers.get('retry-after') ?? BASE_DELAY_MS / 1000);
        const delay = Math.min(retryAfter * 1000, 30_000);
        if (attempt < MAX_RETRIES) {
          await sleep(delay);
          continue;
        }
        throw new AppError('LLM_RATE_LIMITED', 'LLM provider rate limited — too many requests', 429);
      }

      if (!res.ok) {
        lastError = new AppError('LLM_ERROR', `Gemini API error: ${res.status}`, 502);
        if (isRetryableStatus(res.status) && attempt < MAX_RETRIES) {
          await sleep(BASE_DELAY_MS * 2 ** attempt);
          continue;
        }
        throw lastError;
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      // Parse JSON — Gemini returns JSON string inside text
      try {
        return JSON.parse(rawText);
      } catch (parseErr) {
        // Try to extract JSON from markdown code block
        const match = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) {
          try {
            return JSON.parse(match[1]);
          } catch { /* fall through */ }
        }

        if (retryOnJsonError && attempt < MAX_RETRIES) {
          await sleep(BASE_DELAY_MS);
          // Recursive retry with one less retry allowed
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
 * Generates structured output from the LLM.
 *
 * @param {{ type: string; prompt: string; useMock?: boolean }} opts
 * @returns {Promise<object>}  Parsed JSON from the LLM
 */
export async function generateStructured({ type, prompt, useMock }) {
  if (!type) throw new Error('LLM generation type is required');

  // Use mock when: explicitly requested, or no API key available
  const shouldMock = useMock ?? !env.GEMINI_API_KEY;

  if (shouldMock) {
    return mockGenerate(type);
  }

  return callGemini(prompt);
}