import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('schema defines private deck, public room state, and atomic RPCs', async () => {
  const sql = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
  for (const token of [
    'create table if not exists public.lottery_rooms',
    'create table if not exists public.lottery_decks',
    'create or replace function public.draw_ticket',
    'create or replace function public.confirm_draw',
    'create or replace function public.add_tickets',
    'for update',
    'security definer',
    "'main'",
  ]) assert.match(sql.toLowerCase(), new RegExp(token.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('anon users can read room state but not the private deck', async () => {
  const sql = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
  assert.match(sql, /lottery_rooms_read/i);
  assert.doesNotMatch(sql, /create policy\s+lottery_decks_read/i);
  assert.match(sql, /grant execute on function public\.draw_ticket/i);
});
