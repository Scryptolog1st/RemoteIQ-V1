import { Injectable } from "@nestjs/common";
import { PgPoolService } from "../storage/pg-pool.service";
import { SupportLegal, SupportLegalDto } from "./support-legal.dto";

@Injectable()
export class SupportLegalService {
    private readonly rowId = 1;

    constructor(private readonly pg: PgPoolService) { }

    async get(): Promise<SupportLegal | null> {
        const { rows } = await this.pg.query(
            `
      SELECT
        id,
        support_email       AS "supportEmail",
        support_phone       AS "supportPhone",
        knowledge_base_url  AS "knowledgeBaseUrl",
        status_page_url     AS "statusPageUrl",
        privacy_policy_url  AS "privacyPolicyUrl",
        terms_url           AS "termsUrl",
        gdpr_contact_email  AS "gdprContactEmail",
        legal_address       AS "legalAddress",
        ticket_portal_url   AS "ticketPortalUrl",
        phone_hours         AS "phoneHours",
        notes_html          AS "notesHtml"
      FROM support_legal
      WHERE id = $1
      LIMIT 1
      `,
            [this.rowId]
        );
        const row = rows[0];
        if (!row) return null;
        return row as SupportLegal;
    }

    async upsert(input: SupportLegalDto): Promise<void> {
        await this.pg.query(
            `
      INSERT INTO support_legal
        (id, support_email, support_phone, knowledge_base_url, status_page_url,
         privacy_policy_url, terms_url, gdpr_contact_email, legal_address,
         ticket_portal_url, phone_hours, notes_html)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (id) DO UPDATE SET
        support_email       = EXCLUDED.support_email,
        support_phone       = EXCLUDED.support_phone,
        knowledge_base_url  = EXCLUDED.knowledge_base_url,
        status_page_url     = EXCLUDED.status_page_url,
        privacy_policy_url  = EXCLUDED.privacy_policy_url,
        terms_url           = EXCLUDED.terms_url,
        gdpr_contact_email  = EXCLUDED.gdpr_contact_email,
        legal_address       = EXCLUDED.legal_address,
        ticket_portal_url   = EXCLUDED.ticket_portal_url,
        phone_hours         = EXCLUDED.phone_hours,
        notes_html          = EXCLUDED.notes_html
      `,
            [
                this.rowId,
                input.supportEmail ?? null,
                input.supportPhone ?? null,
                input.knowledgeBaseUrl ?? null,
                input.statusPageUrl ?? null,
                input.privacyPolicyUrl ?? null,
                input.termsUrl ?? null,
                input.gdprContactEmail ?? null,
                input.legalAddress ?? null,
                input.ticketPortalUrl ?? null,
                input.phoneHours ?? null,
                input.notesHtml ?? null,
            ]
        );
    }
}
