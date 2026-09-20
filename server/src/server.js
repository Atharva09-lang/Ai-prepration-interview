import { env, assertWebEnv } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { createMongoSessionStore } from './config/session.js';
import { createApp } from './app.js';

async function main() {
  assertWebEnv();
  await connectDB();

  const app = createApp({ sessionStore: createMongoSessionStore() });
  const server = app.listen(env.PORT, () => {
    console.log(`[server] listening on :${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal) => {
    console.log(`[server] ${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[server] failed to start:', err.message);
  process.exit(1);
});