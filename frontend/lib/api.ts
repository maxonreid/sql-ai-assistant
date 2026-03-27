// Backend base URL — configurable via NEXT_PUBLIC_API_URL, defaults to the
// local Fastify server. Works identically in dev (Next.js) and production
// (Electron file://) because both load the UI from the same machine.
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';

export const apiUrl = (path: string) => `${BASE}${path}`;
