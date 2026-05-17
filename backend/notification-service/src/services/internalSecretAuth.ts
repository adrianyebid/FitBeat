import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

const HEADER_NAME = 'x-internal-token';

/**
 * Express middleware that validates the X-Internal-Token header for S2S routes.
 * Uses crypto.timingSafeEqual for constant-time comparison to mitigate timing attacks.
 *
 * Only apply this middleware to route groups that serve internal S2S endpoints.
 * Public routes and /health must NOT use this middleware.
 */
export function internalSecretAuth(req: Request, res: Response, next: NextFunction): void {
    const secret = process.env.FITBEAT_INTERNAL_SECRET || process.env.INTERNAL_SERVICE_TOKEN || '';

    if (!secret) {
        res.status(503).json({ message: 'internal secret not configured' });
        return;
    }

    const provided = req.headers[HEADER_NAME] as string | undefined;

    if (!provided) {
        res.status(401).json({ message: 'missing X-Internal-Token header' });
        return;
    }

    const expectedBuf = Buffer.from(secret, 'utf-8');
    const providedBuf = Buffer.from(provided, 'utf-8');

    if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
        res.status(403).json({ message: 'invalid internal token' });
        return;
    }

    next();
}
