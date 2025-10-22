// src/types/express.d.ts
import 'express';

declare module 'express-serve-static-core' {
    interface Request {
        user?: { id: string };
        jti?: string | null;
    }
}
