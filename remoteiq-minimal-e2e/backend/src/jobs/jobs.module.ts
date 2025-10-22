// backend/src/jobs/jobs.module.ts
import { Module, forwardRef } from "@nestjs/common";
import { RunsController } from "./runs.controller";
import { RunsService } from "./runs.service";
import { WsModule } from "../ws/ws.module";

@Module({
  imports: [forwardRef(() => WsModule)],
  controllers: [RunsController],
  providers: [RunsService],
  exports: [RunsService],
})
export class JobsModule { }
