// backend/src/agents/dto/update-agent-facts.dto.ts
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAgentFactsDto {
    @IsOptional()
    @IsIn(['windows', 'linux', 'macos'])
    os?: 'windows' | 'linux' | 'macos';

    @IsOptional()
    @IsIn(['x64', 'arm64', 'x86'])
    arch?: 'x64' | 'arm64' | 'x86';

    @IsOptional()
    @IsString()
    @MaxLength(50)
    version?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    primaryIp?: string;

    // agent sends this today
    @IsOptional()
    @IsString()
    @MaxLength(200)
    user?: string;

    // optional alias: some agents might send this name
    @IsOptional()
    @IsString()
    @MaxLength(200)
    loggedInUser?: string;
}
