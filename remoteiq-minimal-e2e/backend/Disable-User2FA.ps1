# Set your email:
$EMAIL = "jgibbs.online@gmail.com"

# This block:
#  - gives the column a default of empty array
#  - backfills any historical NULLs to '{}'
#  - disables 2FA for your user and sets codes to empty array
$SQL = @"
ALTER TABLE users
  ALTER COLUMN two_factor_recovery_codes SET DEFAULT '{}'::text[];

UPDATE users
   SET two_factor_recovery_codes = '{}'::text[]
 WHERE two_factor_recovery_codes IS NULL;

UPDATE users
   SET two_factor_enabled = FALSE,
       two_factor_secret  = NULL,
       two_factor_recovery_codes = '{}'::text[]
 WHERE lower(email) = lower('$EMAIL');

SELECT id, email, two_factor_enabled,
       (two_factor_secret IS NOT NULL) AS has_secret,
       COALESCE(array_length(two_factor_recovery_codes,1),0) AS recovery_count
FROM users
WHERE lower(email) = lower('$EMAIL')
LIMIT 1;
"@

docker compose -f docker-compose.db.yml exec -T postgres `
    psql -U remoteiq -d remoteiq -v ON_ERROR_STOP=1 -c "$SQL"
