//backend\src\storage\storage.module.ts

import { Module } from "@nestjs/common";
import { PgPoolService } from "./pg-pool.service";
import { PgBootstrap } from "./pg.bootstrap";

@Module({
    providers: [PgPoolService, PgBootstrap],
    exports: [PgPoolService],
})
export class StorageModule { }
