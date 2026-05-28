-- Keep the manual adjustment RPC unambiguous after adding pay-period targeting.

drop function if exists public.create_manual_adjustment(uuid, int, text, date);
