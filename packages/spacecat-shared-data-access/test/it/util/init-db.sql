-- PostgREST roles setup (must run before schema import)
-- The authenticator role is used by PostgREST to connect
CREATE ROLE postgrest_authenticator WITH LOGIN PASSWORD 'postgrest' NOINHERIT;
CREATE ROLE postgrest_anon NOLOGIN;
GRANT postgrest_anon TO postgrest_authenticator;
