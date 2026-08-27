CREATE OR REPLACE FUNCTION lock_account_type() RETURNS trigger AS $$
BEGIN
  IF NEW.account_type IS DISTINCT FROM OLD.account_type THEN
    RAISE EXCEPTION 'account_type is immutable'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_lock_account_type ON users;
CREATE TRIGGER users_lock_account_type
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION lock_account_type();

CREATE INDEX IF NOT EXISTS brands_icp_embedding_idx
  ON brands USING hnsw (icp_embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS creators_fingerprint_embedding_idx
  ON creators USING hnsw (fingerprint_embedding vector_cosine_ops);
