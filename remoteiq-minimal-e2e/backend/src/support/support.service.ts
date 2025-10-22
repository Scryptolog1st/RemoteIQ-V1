import { Injectable } from "@nestjs/common";
import { PgPoolService } from "../storage/pg-pool.service";
import { SupportLegal, SupportLegalDto } from "./support.dto";

@Injectable()
export class SupportService {
    private readonly rowId = 1;
    constructor(private readonly pg: PgPoolService) { }

    async get(): Promise<SupportLegal | null> {
        const { rows } = await this.pg.query(
            `SELECT 1 AS id,
              support_url   AS "supportUrl",
              status_url    AS "statusUrl",
              terms_url     AS "termsUrl",
              privacy_url   AS "privacyUrl",
              kb_url        AS "kbUrl",
              contact_email AS "contactEmail",
              support_phone AS "supportPhone",
              legal_version AS "legalVersion"
         FROM support_legal_settings
        WHERE id = $1
        LIMIT 1`,
            [this.rowId]
        );
        return rows[0] ?? null;
    }

    async upsert(input: SupportLegalDto): Promise<void> {
        await this.pg.query(
            `INSERT INTO support_legal_settings
         (id, support_url, status_url, terms_url, privacy_url,
          kb_url, contact_email, support_phone, legal_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET
         support_url   = EXCLUDED.support_url,
         status_url    = EXCLUDED.status_url,
         terms_url     = EXCLUDED.terms_url,
         privacy_url   = EXCLUDED.privacy_url,
         kb_url        = EXCLUDED.kb_url,
         contact_email = EXCLUDED.contact_email,
         support_phone = EXCLUDED.support_phone,
         legal_version = EXCLUDED.legal_version`,
            [
                this.rowId,
                input.supportUrl ?? null,
                input.statusUrl ?? null,
                input.termsUrl ?? null,
                input.privacyUrl ?? null,
                input.kbUrl ?? null,
                input.contactEmail ?? null,
                input.supportPhone ?? null,
                input.legalVersion ?? null,
            ]
        );
    }
}
