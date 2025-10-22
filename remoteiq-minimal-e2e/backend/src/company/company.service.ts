// backend/src/company/company.service.ts
import { Injectable } from "@nestjs/common";
import { PgPoolService } from "../storage/pg-pool.service";
import { CompanyProfile, CompanyProfileDto } from "./company.dto";

@Injectable()
export class CompanyService {
    private readonly rowId = 1;
    constructor(private readonly pg: PgPoolService) { }

    async get(): Promise<CompanyProfile | null> {
        const { rows } = await this.pg.query(
            `SELECT id,
              name,
              legal_name AS "legalName",
              email, phone, fax, website,
              vat_tin   AS "vatTin",
              address1, address2, city, state, postal, country
         FROM company_profile
        WHERE id = $1
        LIMIT 1`,
            [this.rowId]
        );
        return (rows[0] as CompanyProfile) ?? null;
    }

    async upsert(input: CompanyProfileDto): Promise<void> {
        await this.pg.query(
            `INSERT INTO company_profile
         (id, name, legal_name, email, phone, fax, website, vat_tin,
          address1, address2, city, state, postal, country)
       VALUES
         ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO UPDATE SET
         name       = EXCLUDED.name,
         legal_name = EXCLUDED.legal_name,
         email      = EXCLUDED.email,
         phone      = EXCLUDED.phone,
         fax        = EXCLUDED.fax,
         website    = EXCLUDED.website,
         vat_tin    = EXCLUDED.vat_tin,
         address1   = EXCLUDED.address1,
         address2   = EXCLUDED.address2,
         city       = EXCLUDED.city,
         state      = EXCLUDED.state,
         postal     = EXCLUDED.postal,
         country    = EXCLUDED.country`,
            [
                this.rowId,
                input.name,
                input.legalName ?? null,
                input.email ?? null,
                input.phone ?? null,
                input.fax ?? null,
                input.website ?? null,
                input.vatTin ?? null,
                input.address1 ?? null,
                input.address2 ?? null,
                input.city ?? null,
                input.state ?? null,
                input.postal ?? null,
                input.country ?? null,
            ]
        );
    }
}
