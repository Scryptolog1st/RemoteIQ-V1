Set-Content -Path users_schema_fix.sql -Value @'
CREATE OR REPLACE FUNCTION set_users_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$func$;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_users_updated_at();
'@

docker cp .\users_schema_fix.sql backend-postgres-1:/tmp/users_schema_fix.sql
docker exec backend-postgres-1 psql -U remoteiq -d remoteiq -f /tmp/users_schema_fix.sql
