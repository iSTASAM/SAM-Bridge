-- Migration 019: ChatGPT-style AI Conversations and Messages Storage
-- Stores structured AI chat threads and message history on Supabase.

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'New Chat',
  user_id text,
  channel_type text not null default 'web' check (channel_type in ('web', 'slack', 'line', 'custom')),
  channel_id text,
  provider_id text,
  model text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_conversations_user_created_idx
  on public.ai_conversations (user_id, updated_at desc);

create index if not exists ai_conversations_channel_idx
  on public.ai_conversations (channel_type, channel_id, updated_at desc);

alter table public.ai_conversations enable row level security;

create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_chat_messages_conversation_created_idx
  on public.ai_chat_messages (conversation_id, created_at asc);

alter table public.ai_chat_messages enable row level security;

-- Trigger to auto-update updated_at on ai_conversations whenever a message is added
create or replace function public.update_ai_conversation_timestamp()
returns trigger as $$
begin
  update public.ai_conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_ai_conversation_timestamp_trigger on public.ai_chat_messages;
create trigger update_ai_conversation_timestamp_trigger
  after insert on public.ai_chat_messages
  for each row execute function public.update_ai_conversation_timestamp();
