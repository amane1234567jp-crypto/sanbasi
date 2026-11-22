create table if not exists sb_devices (id text primary key, secret_hash text not null, names jsonb not null default '[]'::jsonb, expo text, calls int not null default 0, calls_since timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists sb_pending (to_id text not null, from_id text not null, names jsonb not null default '[]'::jsonb, at timestamptz not null default now(), primary key (to_id, from_id));
alter table sb_devices enable row level security;
alter table sb_pending enable row level security;
