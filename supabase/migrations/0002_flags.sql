-- Client flags — the codes shown on the census face card.
-- Stored as an array of value_list_items.code from the 'flags' list.
alter table clients add column if not exists flags text[] not null default '{}';
