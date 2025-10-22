// src/agents/agents.controller.ts
import { Body, Controller, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { EnrollAgentDto } from './dto/enroll-agent.dto';

@Controller('/api/agent')
export class AgentsController {
  constructor(private readonly auth: AuthService) { }

  @Post('/enroll')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))
  async enroll(
    @Body() body: EnrollAgentDto,
  ): Promise<{ agentId: string; agentToken: string }> {
    // AuthService.enrollAgent should return { agentId, agentToken }
    return this.auth.enrollAgent(body);
  }
}
