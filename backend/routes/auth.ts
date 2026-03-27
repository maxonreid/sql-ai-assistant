import type { FastifyInstance } from 'fastify';
import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib';

const totp = new TOTP({
  crypto: new NobleCryptoPlugin(),
  base32: new ScureBase32Plugin(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/verify', async (req, reply): Promise<{ ok: boolean; error?: string }> => {
    const { token } = req.body as { token: string };
    const secret = process.env.TOTP_SECRET;
    if (!secret) return reply.code(500).send({ ok: false, error: 'TOTP_SECRET not configured' });
    const result = await totp.verify(token, { secret, epochTolerance: 30 });
    if (!result.valid) return reply.code(401).send({ ok: false, error: 'Invalid or expired code' });
    return { ok: true };
  });
}
