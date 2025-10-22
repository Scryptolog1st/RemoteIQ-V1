// src/agents/dto/enroll-agent.dto.ts
import { IsIn, IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class EnrollAgentDto {
    @IsString() @IsNotEmpty() @MaxLength(200)
    enrollmentSecret!: string;

    @IsString() @IsNotEmpty() @MaxLength(200)
    deviceId!: string;

    @IsString() @IsNotEmpty() @MaxLength(200)
    hostname!: string;

    @IsIn(['windows', 'linux', 'macos'])
    os!: 'windows' | 'linux' | 'macos';

    @IsIn(['x64', 'arm64', 'x86'])
    arch!: 'x64' | 'arm64' | 'x86';

    @IsString() @IsNotEmpty() @MaxLength(50)
    version!: string;
}
