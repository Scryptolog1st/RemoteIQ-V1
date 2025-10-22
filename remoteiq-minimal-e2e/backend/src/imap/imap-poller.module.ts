import { Module } from "@nestjs/common";
import { ImapPollerService } from "./imap-poller.service";
import { SmtpRepository } from "../smtp/smtp.repository";

@Module({
    providers: [ImapPollerService, SmtpRepository],
    exports: [ImapPollerService],
})
export class ImapPollerModule { }
