import Fastify from 'fastify';
import cors from '@fastify/cors';
import { authRoutes } from './routes/auth';
import { connectionRoutes } from './routes/connections';
import { schemaRoutes } from './routes/schema';
import { queryRoutes } from './routes/query';
import { settingsRoutes } from './routes/settings';
import { db } from './db/sqlite';

const app = Fastify({ logger: true });

app.register(cors, { origin: `http://localhost:${process.env.FRONTEND_PORT || 3000}` });

// Health check
app.get('/api/health', async () => ({ status: 'ok' }));

// Register routes
app.register(authRoutes);
app.register(connectionRoutes, { db });
app.register(schemaRoutes, { db });
app.register(queryRoutes, { db });
app.register(settingsRoutes, { db });

const start = async (): Promise<void> => {
  await app.listen({
    port: Number(process.env.BACKEND_PORT) || 3001,
    host: '127.0.0.1'
  });
};

start();