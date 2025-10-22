CREATE TABLE IF NOT EXISTS support_legal (
  id                  integer PRIMARY KEY,
  support_email       text,
  support_phone       text,
  knowledge_base_url  text,
  status_page_url     text,
  privacy_policy_url  text,
  terms_url           text,
  gdpr_contact_email  text,
  legal_address       text,
  ticket_portal_url   text,
  phone_hours         text,
  notes_html          text
);

INSERT INTO support_legal (id, support_email)
SELECT 1, 'support@example.com'
WHERE NOT EXISTS (SELECT 1 FROM support_legal WHERE id = 1);
