-- An account made with a mobile number has no email: the email column may be empty (NULL).
-- Run this once in the Supabase SQL editor.

-- 1. Let the email column be empty (it stays unique: many NULLs are allowed, two equal emails are not)
alter table public.users alter column email drop not null;

-- 2. Accounts created earlier got a made-up address like 9876543210@placeholder.invalid: remove those, the number is the login
update public.users set email = null where email like '%@placeholder.invalid';
