-- Fix update_user_last_active(): the original definition (20240222200001)
-- compared users.telegram_user_id (text) with NEW.user_id (uuid, the
-- users.id foreign key). Postgres has no text = uuid operator, so the
-- trigger raised 42883 on EVERY insert into checks and the insert rolled
-- back — check history never landed, silently, because the bot did not
-- check the insert result. Match on the primary key instead.
CREATE OR REPLACE FUNCTION update_user_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET last_active_at = NOW()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
