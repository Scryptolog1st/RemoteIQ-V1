import { Module } from "@nestjs/common";
import { AgentsController } from "./agents.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [AgentsController],
})
export class AgentsModule { }
