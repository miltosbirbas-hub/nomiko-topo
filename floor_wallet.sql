-- ═══════════════════════════════════════════════════════════════════
-- ΝΟΜΙΚΟ ΤΟΠΟ — Floor-plan (Οριζόντια Ιδιοκτησία) wallet + tier
-- Επεκτείνει τον υπάρχοντα πίνακα public.user_tokens (στήλη balance).
-- Τρέξε ΟΛΟ το αρχείο μία φορά στο Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════

-- 1) ΝΕΕΣ ΣΤΗΛΕΣ ----------------------------------------------------
-- tier: 'free' | 'premium' | 'ultra'
-- floor_balance: wallet αναλύσεων κάτοψης (5 demo δωρεάν για ΟΛΟΥΣ)
alter table public.user_tokens
  add column if not exists tier text not null default 'free'
    check (tier in ('free','premium','ultra')),
  add column if not exists floor_balance integer not null default 5;

-- Υπάρχοντα μέλη που δεν έχουν ακόμα floor_balance → δώσε 5 demo
update public.user_tokens
set floor_balance = 5
where floor_balance is null;

-- 2) ΕΝΗΜΕΡΩΣΗ TRIGGER ΝΕΩΝ ΜΕΛΩΝ ----------------------------------
-- Αν έχεις ήδη trigger που γεμίζει balance=5 στο signup, πρόσθεσε
-- και floor_balance=5. Το παρακάτω είναι ΑΣΦΑΛΕΣ default — αν ο
-- δικός σου trigger κάνει INSERT στο user_tokens, βεβαιώσου ότι
-- περιλαμβάνει floor_balance (αλλιώς πιάνει το default 5 της στήλης).
-- Δεν χρειάζεται αλλαγή αν βασίζεσαι στο column default.

-- 3) RPC: κατάσταση floor-plan wallet -------------------------------
create or replace function public.my_floor_status()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
  v_bal  integer;
begin
  select tier, coalesce(floor_balance,0)
    into v_tier, v_bal
  from public.user_tokens
  where user_id = auth.uid();

  if not found then
    return json_build_object('tier','free','floor_balance',0,'found',false);
  end if;

  return json_build_object('tier',v_tier,'floor_balance',v_bal,'found',true);
end;
$$;

-- 4) RPC: χρέωση 1 ανάλυσης κάτοψης ---------------------------------
-- Κανόνας:
--   • floor_balance > 0  → χρέωσε (ισχύει για ΟΛΟΥΣ — demo + αγορασμένα)
--   • floor_balance = 0 & tier='free'           → LOCKED_TIER
--   • floor_balance = 0 & tier in premium/ultra → NO_FLOOR_TOKENS
create or replace function public.spend_floor_token()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
  v_bal  integer;
begin
  select tier, coalesce(floor_balance,0)
    into v_tier, v_bal
  from public.user_tokens
  where user_id = auth.uid()
  for update;

  if not found then
    return json_build_object('ok',false,'reason','NO_ACCOUNT');
  end if;

  if v_bal > 0 then
    update public.user_tokens
      set floor_balance = floor_balance - 1
    where user_id = auth.uid();
    return json_build_object('ok',true,'floor_balance',v_bal-1,'tier',v_tier);
  end if;

  -- balance = 0 → gate ανάλογα με tier
  if v_tier in ('premium','ultra') then
    return json_build_object('ok',false,'reason','NO_FLOOR_TOKENS','tier',v_tier);
  else
    return json_build_object('ok',false,'reason','LOCKED_TIER','tier',v_tier);
  end if;
end;
$$;

-- 5) ADMIN RPC (μόνο για σένα) --------------------------------------
-- Ενεργοποίηση συνδρομής σε χρήστη.
create or replace function public.grant_tier(p_user uuid, p_tier text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tier not in ('free','premium','ultra') then
    raise exception 'invalid tier %', p_tier;
  end if;
  update public.user_tokens set tier = p_tier where user_id = p_user;
end;
$$;

-- Προσθήκη αγορασμένων αναλύσεων κάτοψης (π.χ. πακέτο 100 ή top-up).
create or replace function public.add_floor_tokens(p_user uuid, p_n integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_new integer;
begin
  update public.user_tokens
    set floor_balance = coalesce(floor_balance,0) + p_n
  where user_id = p_user
  returning floor_balance into v_new;
  return v_new;
end;
$$;

-- 6) ΔΙΚΑΙΩΜΑΤΑ -----------------------------------------------------
grant execute on function public.my_floor_status() to authenticated;
grant execute on function public.spend_floor_token() to authenticated;
-- Τα grant_tier / add_floor_tokens ΜΟΝΟ για service_role (admin),
-- ΟΧΙ authenticated — ώστε να μην μπορεί χρήστης να αυτο-αναβαθμιστεί.
revoke all on function public.grant_tier(uuid,text) from public, authenticated;
revoke all on function public.add_floor_tokens(uuid,integer) from public, authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- ΧΡΗΣΗ (admin, από SQL editor με role postgres):
--   select public.grant_tier('USER-UUID', 'premium');
--   select public.add_floor_tokens('USER-UUID', 100);   -- πακέτο 100
--   select public.add_floor_tokens('USER-UUID', 10);    -- top-up
-- ═══════════════════════════════════════════════════════════════════
