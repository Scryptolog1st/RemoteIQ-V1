import { Body, Controller, Post, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { EnrollAgentDto } from './dto/enroll-agent.dto';
import { AgentsService } from './agents.service';
import { AgentTokenGuard, getAgentFromRequest } from '../common/agent-token.util';
import { UpdateAgentFactsDto } from './dto/update-agent-facts.dto';
import { SubmitSoftwareDto } from './dto/submit-software.dto';

@Controller('/api/agent')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))
export class AgentsController {
  constructor(
    private readonly auth: AuthService,
    private readonly agents: AgentsService,
  ) { }

  /**
   * Enroll the agent and RETURN deviceId as well so the agent can persist it.
   * We normalize various possible shapes from AuthService to a clean object.
   */
  @Post('/enroll')
  async enroll(
    @Body() body: EnrollAgentDto
  ): Promise<{ agentId: string; deviceId: string; agentToken: string }> {
    const res: any = await this.auth.enrollAgent(body);

    const agentId =
      String(res?.agentId ?? res?.agent?.id ?? '');
    const deviceId =
      String(res?.deviceId ?? res?.device?.id ?? body?.deviceId ?? '');
    const agentToken =
      String(res?.agentToken ?? res?.token ?? res?.accessToken ?? '');

    // Basic sanity: we expect token + agentId
    if (!agentToken || !agentId) {
      throw new Error('Enrollment succeeded but missing token or agentId in response.');
    }

    return { agentId, deviceId, agentToken };
  }

  /** Authenticated ping: updates last_seen_at + facts */
  @Post('/ping')
  @UseGuards(AgentTokenGuard)
  async ping(@Req() req: any, @Body() body: UpdateAgentFactsDto) {
    const agent = getAgentFromRequest(req);
    console.log('[PING]', { agentId: agent.id, body });
    await this.agents.updateFacts(agent.id, body ?? {});
    return { ok: true };
  }

  /** Authenticated: submit full software inventory */
  @Post('/software')
  @UseGuards(AgentTokenGuard)
  async submitSoftware(@Req() req: any, @Body() body: SubmitSoftwareDto) {
    const agent = getAgentFromRequest(req);
    await this.agents.upsertSoftware(agent.id, body?.items ?? []);
    return { ok: true, count: body?.items?.length ?? 0 };
  }
}

