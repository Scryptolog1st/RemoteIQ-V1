import { Module } from "@nestjs/common";
import { SmtpController } from "./smtp.controller";
import { SmtpService } from "./smtp.service";
import { SmtpRepository } from "./smtp.repository";
import { DkimRepository } from "./dkim.repository";

@Module({
    controllers: [SmtpController],
    providers: [SmtpService, SmtpRepository, DkimRepository],
    exports: [SmtpService, SmtpRepository, DkimRepository],
})
export class SmtpModule { }
