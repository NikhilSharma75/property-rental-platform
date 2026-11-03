-- 008: make audit_log append-only.
-- Blocks DELETE, and any UPDATE except nulling actor_id (the "on delete set null" foreign key performs
-- exactly that update when a user account is deleted).
create or replace function audit_log_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'audit_log is append-only';
  end if;
  if tg_op = 'UPDATE' then
    if new.actor_id is null
       and (to_jsonb(new) - 'actor_id') = (to_jsonb(old) - 'actor_id') then
      return new;
    end if;
    raise exception 'audit_log is append-only';
  end if;
  return new;
end $$;

drop trigger if exists audit_log_guard_trg on audit_log;
create trigger audit_log_guard_trg
  before update or delete on audit_log
  for each row execute function audit_log_guard();
