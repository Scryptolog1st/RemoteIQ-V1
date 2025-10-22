// backend/src/database/prisma.service.ts
// Stub PrismaService so legacy files compile without the real Prisma engine.
// It purposefully returns `any` so code like `existing.id` type-checks.
// Remove this stub once you wire real Prisma models, or delete legacy code.

import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";

/** A permissive delegate that mimics Prisma model methods */
export type PrismaModelDelegate = {
    // reads
    findFirst: (...args: any[]) => Promise<any>;
    findMany: (...args: any[]) => Promise<any[]>;
    findUnique: (...args: any[]) => Promise<any>;

    // writes
    create: (...args: any[]) => Promise<any>;
    update: (...args: any[]) => Promise<any>;
    upsert: (...args: any[]) => Promise<any>;
    delete: (...args: any[]) => Promise<any>;
};

function makeModel(): PrismaModelDelegate {
    return {
        // At runtime we return harmless placeholders, but the important part is the `any` typing.
        async findFirst(_args?: any): Promise<any> { return null; },
        async findMany(_args?: any): Promise<any[]> { return []; },
        async findUnique(_args?: any): Promise<any> { return null; },

        async create(_args?: any): Promise<any> { return {}; },
        async update(_args?: any): Promise<any> { return {}; },
        async upsert(_args?: any): Promise<any> { return {}; },
        async delete(_args?: any): Promise<any> { return {}; },
    };
}

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
    // Expose “models” referenced by legacy code.
    public agent: PrismaModelDelegate = makeModel();
    public job: PrismaModelDelegate = makeModel();
    public jobResult: PrismaModelDelegate = makeModel();

    // Some code calls $transaction([...]). Make it a no-op that preserves types.
    async $transaction(_ops: any[]): Promise<any[]> {
        return [];
    }

    async onModuleInit(): Promise<void> {
        // no-op: we are not starting a real Prisma engine
    }

    async onModuleDestroy(): Promise<void> {
        // no-op
    }

    async enableShutdownHooks(): Promise<void> {
        // no-op
    }
}
