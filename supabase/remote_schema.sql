

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."ledger_type" AS ENUM (
    'chore_credit',
    'manual_adjustment',
    'payout_debit'
);


ALTER TYPE "public"."ledger_type" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'parent',
    'kid'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_full_payout_for_kid"("hh" "uuid", "kid" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  isparent boolean;
  bal numeric(12,2);
  ps date; pe date;
  pid uuid;
BEGIN
  SELECT public.is_parent(hh) INTO isparent;
  IF NOT isparent THEN
    RAISE EXCEPTION 'Only parents can create payouts.';
  END IF;

  SELECT COALESCE(SUM(amount), 0.00) INTO bal
  FROM public.ledger_entries
  WHERE household_id = hh AND kid_id = kid;

  IF bal <= 0.00 THEN
    RAISE EXCEPTION 'No positive balance to pay (balance_dollars=%).', bal;
  END IF;

  SELECT period_start, period_end INTO ps, pe
  FROM public.current_pay_period(hh);

  INSERT INTO public.payouts (household_id, kid_id, period_start, period_end, amount, approved_by)
  VALUES (hh, kid, ps, pe, bal, auth.uid())
  RETURNING id INTO pid;

  INSERT INTO public.ledger_entries (household_id, kid_id, type, amount, related_payout_id, note)
  VALUES (hh, kid, 'payout_debit', -bal, pid, 'Biweekly allowance payout');

  RETURN pid;
END$$;


ALTER FUNCTION "public"."create_full_payout_for_kid"("hh" "uuid", "kid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_local_date"("hh" "uuid") RETURNS "date"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select (now() at time zone h.timezone)::date
  from public.households h
  where h.id = hh
$$;


ALTER FUNCTION "public"."current_local_date"("hh" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_pay_period"("hh" "uuid") RETURNS TABLE("period_start" "date", "period_end" "date")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  anchor date;
  days int;
  today_local date;
  n int;
  start_date date;
begin
  select allowance_anchor_date, pay_period_days
    into anchor, days
  from public.households
  where id = hh;

  today_local := public.current_local_date(hh);
  if anchor is null then anchor := today_local; end if;
  if days is null or days <= 0 then days := 14; end if;

  n := greatest(0, ((today_local - anchor) / days));
  start_date := anchor + (n * days);
  return query select start_date, start_date + (days - 1);
end$$;


ALTER FUNCTION "public"."current_pay_period"("hh" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_household_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select household_id
  from public.profiles
  where id = auth.uid()
$$;


ALTER FUNCTION "public"."current_user_household_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."days_due_today"("dows" smallint[], "today" "date") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select coalesce(array_position(dows, extract(dow from today::timestamp)::int)::int is not null, false);
$$;


ALTER FUNCTION "public"."days_due_today"("dows" smallint[], "today" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dow_code"("dow" integer) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case dow
           when 0 then 'SU' when 1 then 'MO' when 2 then 'TU' when 3 then 'WE'
           when 4 then 'TH' when 5 then 'FR' when 6 then 'SA' else null end;
$$;


ALTER FUNCTION "public"."dow_code"("dow" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'kid'
  )
  on conflict (id) do nothing;
  return new;
end$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_member"("hh" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.household_id = hh
  )
$$;


ALTER FUNCTION "public"."is_member"("hh" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_parent"("hh" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'parent'
      and p.household_id = hh
  )
$$;


ALTER FUNCTION "public"."is_parent"("hh" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."local_time_of"("due_at" timestamp with time zone, "tz" "text") RETURNS time without time zone
    LANGUAGE "sql" IMMUTABLE
    AS $$
  -- Convert a timestamptz to local time-of-day in the given tz (handles DST)
  select (due_at at time zone tz)::time
$$;


ALTER FUNCTION "public"."local_time_of"("due_at" timestamp with time zone, "tz" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."on_checkin_verified_create_ledger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  hh uuid;
  kid uuid;
  amt numeric(12,2);
  chore_title text;
BEGIN
  IF (COALESCE(OLD.verified,false) = false) AND (NEW.verified = true) THEN
    SELECT c.household_id,
           a.kid_id,
           COALESCE(NEW.amount_awarded, COALESCE(a.amount_override, c.default_amount)),
           c.title
      INTO hh, kid, amt, chore_title
    FROM public.assignments a
    JOIN public.chores c ON c.id = a.chore_id
    WHERE a.id = NEW.assignment_id;

    INSERT INTO public.ledger_entries (household_id, kid_id, type, amount, related_checkin_id, note)
    VALUES (hh, kid, 'chore_credit', amt, NEW.id, 'Chore verified: ' || chore_title)
    ON CONFLICT (related_checkin_id) DO NOTHING;
  END IF;

  RETURN NEW;
END$$;


ALTER FUNCTION "public"."on_checkin_verified_create_ledger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rrule_due_today"("rule" "text", "anchor" "date", "today" "date") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
declare
  freq text;
  interval int;
  byday text;
  bymd text;
  today_dow int;
  today_code text;
  weeks int;
  months int;
  day_of_month int;
  byday_match boolean := true;
  bymd_match boolean := true;
begin
  if rule is null then
    return false;
  end if;

  freq := public.rrule_param(rule, 'FREQ');
  interval := coalesce((public.rrule_param(rule,'INTERVAL'))::int, 1);
  byday := public.rrule_param(rule, 'BYDAY');
  bymd := public.rrule_param(rule, 'BYMONTHDAY');

  today_dow := extract(dow from today::timestamp)::int;
  today_code := public.dow_code(today_dow);
  day_of_month := extract(day from today)::int;

  if freq = 'DAILY' then
    return mod((today - anchor), interval) = 0;

  elsif freq = 'WEEKLY' then
    -- week offset from anchor
    weeks := floor(((today - anchor)::numeric) / 7)::int;
    if byday is not null then
      byday_match := exists (
        select 1
        from unnest(string_to_array(byday, ',')) d(token)
        where token = today_code
      );
    end if;
    return (mod(weeks, interval) = 0) and byday_match;

  elsif freq = 'MONTHLY' then
    months := (extract(year from today)::int * 12 + extract(month from today)::int)
            - (extract(year from anchor)::int * 12 + extract(month from anchor)::int);
    if bymd is not null then
      bymd_match := exists (
        select 1
        from unnest(string_to_array(bymd, ',')) m(token)
        where token::int = day_of_month
      );
    else
      -- if BYMONTHDAY omitted, default to anchor day-of-month
      bymd_match := (day_of_month = extract(day from anchor)::int);
    end if;
    return (mod(months, interval) = 0) and bymd_match;

  else
    -- unsupported FREQ
    return false;
  end if;
end$$;


ALTER FUNCTION "public"."rrule_due_today"("rule" "text", "anchor" "date", "today" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rrule_param"("rule" "text", "key" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select (regexp_matches(upper(rule), key || '=([^;]+)'))[1];
$$;


ALTER FUNCTION "public"."rrule_param"("rule" "text", "key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_checkin_amount"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.amount_awarded IS NULL THEN
    SELECT COALESCE(a.amount_override, c.default_amount)
      INTO NEW.amount_awarded
    FROM public.assignments a
    JOIN public.chores      c ON c.id = a.chore_id
    WHERE a.id = NEW.assignment_id;
  END IF;
  RETURN NEW;
END$$;


ALTER FUNCTION "public"."set_checkin_amount"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_checkin_points"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.points_awarded is null then
    select c.points
      into new.points_awarded
    from public.assignments a
    join public.chores c on c.id = a.chore_id
    where a.id = new.assignment_id;
  end if;
  return new;
end$$;


ALTER FUNCTION "public"."set_checkin_points"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_occurrence_date_default"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.occurrence_date is null then
    new.occurrence_date := (new.completed_at)::date;
  end if;
  return new;
end$$;


ALTER FUNCTION "public"."set_occurrence_date_default"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "chore_id" "uuid" NOT NULL,
    "kid_id" "uuid",
    "days_of_week" smallint[] DEFAULT '{}'::smallint[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "due_at" timestamp with time zone,
    "rrule" "text",
    "amount_override" numeric(12,2),
    CONSTRAINT "chk_days" CHECK ((("array_length"("days_of_week", 1) IS NULL) OR ((LEAST("days_of_week"[1], "days_of_week"[2], "days_of_week"[3], "days_of_week"[4], "days_of_week"[5], "days_of_week"[6]) >= 0) AND (GREATEST("days_of_week"[1], "days_of_week"[2], "days_of_week"[3], "days_of_week"[4], "days_of_week"[5], "days_of_week"[6]) <= 6))))
);


ALTER TABLE "public"."assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checkins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_by" "uuid" NOT NULL,
    "verified" boolean DEFAULT false NOT NULL,
    "verified_by" "uuid",
    "allowance_awarded" integer,
    "occurrence_date" "date",
    "amount_awarded" numeric(12,2),
    CONSTRAINT "checkins_amount_awarded_check" CHECK ((("amount_awarded" IS NULL) OR ("amount_awarded" >= (0)::numeric))),
    CONSTRAINT "chk_points_awarded" CHECK ((("allowance_awarded" IS NULL) OR ("allowance_awarded" >= 0)))
);


ALTER TABLE "public"."checkins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "points" integer DEFAULT 1 NOT NULL,
    "frequency" "text" DEFAULT 'adhoc'::"text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "default_amount" numeric(12,2) DEFAULT 0.00 NOT NULL,
    CONSTRAINT "chores_points_check" CHECK (("points" >= 0))
);


ALTER TABLE "public"."chores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."households" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "timezone" "text" DEFAULT 'America/Chicago'::"text" NOT NULL,
    "allowance_anchor_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "pay_period_days" integer DEFAULT 14 NOT NULL
);


ALTER TABLE "public"."households" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ledger_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "kid_id" "uuid" NOT NULL,
    "type" "public"."ledger_type" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "related_checkin_id" "uuid",
    "related_payout_id" "uuid",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "amount_cents" integer GENERATED ALWAYS AS ("round"(("amount" * (100)::numeric))) STORED,
    CONSTRAINT "chk_amount_nonzero" CHECK (("amount" <> 0.00))
);


ALTER TABLE "public"."ledger_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "kid_id" "uuid" NOT NULL,
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "amount" numeric(12,2) DEFAULT 0.00 NOT NULL,
    "paid_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approved_by" "uuid",
    "amount_cents" integer GENERATED ALWAYS AS ("round"(("amount" * (100)::numeric))) STORED,
    CONSTRAINT "payouts_amount_check" CHECK (("amount" >= 0.00))
);


ALTER TABLE "public"."payouts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "role" "public"."user_role" DEFAULT 'kid'::"public"."user_role" NOT NULL,
    "household_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."redemptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reward_id" "uuid" NOT NULL,
    "kid_id" "uuid" NOT NULL,
    "redeemed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approved" boolean DEFAULT false NOT NULL,
    "approved_by" "uuid"
);


ALTER TABLE "public"."redemptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rewards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "cost_points" integer NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rewards_cost_points_check" CHECK (("cost_points" > 0))
);


ALTER TABLE "public"."rewards" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_due_today" AS
 WITH "ctx" AS (
         SELECT "public"."current_user_household_id"() AS "hh"
        ), "base" AS (
         SELECT "a"."id" AS "assignment_id",
            "c"."id" AS "chore_id",
            "c"."title" AS "chore_title",
            "c"."household_id",
            "h"."timezone" AS "household_timezone",
            COALESCE("a"."amount_override", "c"."default_amount") AS "amount",
            "a"."kid_id",
            "k"."display_name" AS "kid_name",
            ("a"."kid_id" IS NULL) AS "is_anyone",
            "a"."rrule",
            "a"."days_of_week",
            "a"."due_at",
            "public"."current_local_date"("h"."id") AS "today_local",
            "h"."allowance_anchor_date" AS "anchor"
           FROM (((("public"."assignments" "a"
             JOIN "public"."chores" "c" ON (("c"."id" = "a"."chore_id")))
             JOIN "public"."households" "h" ON (("h"."id" = "c"."household_id")))
             LEFT JOIN "public"."profiles" "k" ON (("k"."id" = "a"."kid_id")))
             JOIN "ctx" ON (("c"."household_id" = "ctx"."hh")))
        ), "with_flags" AS (
         SELECT "b"."assignment_id",
            "b"."chore_id",
            "b"."chore_title",
            "b"."household_id",
            "b"."household_timezone",
            "b"."amount",
            "b"."kid_id",
            "b"."kid_name",
            "b"."is_anyone",
            "b"."rrule",
            "b"."days_of_week",
            "b"."due_at",
            "b"."today_local",
            "b"."anchor",
            ((("b"."rrule" IS NOT NULL) AND "public"."rrule_due_today"("b"."rrule", "b"."anchor", "b"."today_local")) OR (("b"."rrule" IS NULL) AND ("b"."days_of_week" IS NOT NULL) AND "public"."days_due_today"("b"."days_of_week", "b"."today_local")) OR (("b"."rrule" IS NULL) AND (("b"."days_of_week" IS NULL) OR ("array_length"("b"."days_of_week", 1) IS NULL)) AND ("b"."due_at" IS NOT NULL) AND ((("b"."due_at" AT TIME ZONE "b"."household_timezone"))::"date" = "b"."today_local"))) AS "due_today",
                CASE
                    WHEN ("b"."due_at" IS NOT NULL) THEN "public"."local_time_of"("b"."due_at", "b"."household_timezone")
                    ELSE NULL::time without time zone
                END AS "due_time_local",
            (EXISTS ( SELECT 1
                   FROM "public"."checkins" "ci"
                  WHERE (("ci"."assignment_id" = "b"."assignment_id") AND ("ci"."occurrence_date" = "b"."today_local")))) AS "completed_today"
           FROM "base" "b"
        )
 SELECT "assignment_id",
    "chore_id",
    "chore_title",
    "household_id",
    "amount",
    "kid_id",
    "kid_name",
    "is_anyone",
    "today_local" AS "due_date_local",
    "due_time_local",
    "completed_today",
        CASE
            WHEN "public"."is_parent"("household_id") THEN false
            ELSE (("is_anyone" OR ("kid_id" = "auth"."uid"())) AND (NOT "completed_today"))
        END AS "can_current_user_claim",
        CASE
            WHEN ("rrule" IS NOT NULL) THEN 'rrule'::"text"
            WHEN ("days_of_week" IS NOT NULL) THEN 'days_of_week'::"text"
            WHEN ("due_at" IS NOT NULL) THEN 'due_at'::"text"
            ELSE 'adhoc'::"text"
        END AS "recurrence_source"
   FROM "with_flags"
  WHERE ("due_today" = true)
  ORDER BY "due_time_local", "chore_title";


ALTER VIEW "public"."vw_due_today" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_kid_balances" AS
 SELECT "household_id",
    "kid_id",
    (COALESCE("sum"("amount"), 0.00))::numeric(12,2) AS "balance_dollars",
    ("round"((COALESCE("sum"("amount"), 0.00) * (100)::numeric)))::bigint AS "balance_cents"
   FROM "public"."ledger_entries" "le"
  GROUP BY "household_id", "kid_id";


ALTER VIEW "public"."vw_kid_balances" OWNER TO "postgres";


ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checkins"
    ADD CONSTRAINT "checkins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chores"
    ADD CONSTRAINT "chores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."households"
    ADD CONSTRAINT "households_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ledger_entries"
    ADD CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ledger_entries"
    ADD CONSTRAINT "ledger_entries_related_checkin_id_key" UNIQUE ("related_checkin_id");



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."redemptions"
    ADD CONSTRAINT "redemptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rewards"
    ADD CONSTRAINT "rewards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "uq_assignment" UNIQUE ("chore_id", "kid_id");



ALTER TABLE ONLY "public"."chores"
    ADD CONSTRAINT "uq_chores_household_title" UNIQUE ("household_id", "title");



CREATE INDEX "idx_assignments_chore" ON "public"."assignments" USING "btree" ("chore_id");



CREATE INDEX "idx_assignments_kid" ON "public"."assignments" USING "btree" ("kid_id");



CREATE INDEX "idx_checkins_assignment" ON "public"."checkins" USING "btree" ("assignment_id");



CREATE INDEX "idx_chores_household" ON "public"."chores" USING "btree" ("household_id");



CREATE INDEX "idx_ledger_created_at" ON "public"."ledger_entries" USING "btree" ("created_at");



CREATE INDEX "idx_ledger_household_kid" ON "public"."ledger_entries" USING "btree" ("household_id", "kid_id");



CREATE INDEX "idx_payouts_household_kid" ON "public"."payouts" USING "btree" ("household_id", "kid_id");



CREATE INDEX "idx_payouts_period" ON "public"."payouts" USING "btree" ("period_start", "period_end");



CREATE INDEX "idx_profiles_household" ON "public"."profiles" USING "btree" ("household_id");



CREATE INDEX "idx_redemptions_kid" ON "public"."redemptions" USING "btree" ("kid_id");



CREATE INDEX "idx_redemptions_reward" ON "public"."redemptions" USING "btree" ("reward_id");



CREATE INDEX "idx_rewards_household" ON "public"."rewards" USING "btree" ("household_id");



CREATE UNIQUE INDEX "uq_assignment_anyone_one_per_chore" ON "public"."assignments" USING "btree" ("chore_id") WHERE ("kid_id" IS NULL);



CREATE UNIQUE INDEX "uq_checkins_one_per_occurrence" ON "public"."checkins" USING "btree" ("assignment_id", "occurrence_date");



CREATE OR REPLACE TRIGGER "trg_on_checkin_verified" AFTER UPDATE OF "verified" ON "public"."checkins" FOR EACH ROW EXECUTE FUNCTION "public"."on_checkin_verified_create_ledger"();



CREATE OR REPLACE TRIGGER "trg_set_checkin_amount" BEFORE INSERT ON "public"."checkins" FOR EACH ROW EXECUTE FUNCTION "public"."set_checkin_amount"();



CREATE OR REPLACE TRIGGER "trg_set_checkin_points" BEFORE INSERT ON "public"."checkins" FOR EACH ROW EXECUTE FUNCTION "public"."set_checkin_points"();



CREATE OR REPLACE TRIGGER "trg_set_occurrence_date" BEFORE INSERT ON "public"."checkins" FOR EACH ROW EXECUTE FUNCTION "public"."set_occurrence_date_default"();



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_chore_id_fkey" FOREIGN KEY ("chore_id") REFERENCES "public"."chores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_kid_id_fkey" FOREIGN KEY ("kid_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checkins"
    ADD CONSTRAINT "checkins_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checkins"
    ADD CONSTRAINT "checkins_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."checkins"
    ADD CONSTRAINT "checkins_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."chores"
    ADD CONSTRAINT "chores_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ledger_entries"
    ADD CONSTRAINT "ledger_entries_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ledger_entries"
    ADD CONSTRAINT "ledger_entries_kid_id_fkey" FOREIGN KEY ("kid_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ledger_entries"
    ADD CONSTRAINT "ledger_entries_related_checkin_id_fkey" FOREIGN KEY ("related_checkin_id") REFERENCES "public"."checkins"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ledger_entries"
    ADD CONSTRAINT "ledger_entries_related_payout_id_fkey" FOREIGN KEY ("related_payout_id") REFERENCES "public"."payouts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_kid_id_fkey" FOREIGN KEY ("kid_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."redemptions"
    ADD CONSTRAINT "redemptions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."redemptions"
    ADD CONSTRAINT "redemptions_kid_id_fkey" FOREIGN KEY ("kid_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."redemptions"
    ADD CONSTRAINT "redemptions_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rewards"
    ADD CONSTRAINT "rewards_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



CREATE POLICY "Assignments: parents manage" ON "public"."assignments" USING ((EXISTS ( SELECT 1
   FROM "public"."chores" "c"
  WHERE (("c"."id" = "assignments"."chore_id") AND "public"."is_parent"("c"."household_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."chores" "c"
     JOIN "public"."profiles" "k" ON (("k"."id" = "assignments"."kid_id")))
  WHERE (("c"."id" = "assignments"."chore_id") AND "public"."is_parent"("c"."household_id") AND ("k"."household_id" = "c"."household_id")))));



CREATE POLICY "Assignments: select own/anyone or parent" ON "public"."assignments" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."chores" "c"
  WHERE (("c"."id" = "assignments"."chore_id") AND ("c"."household_id" = "public"."current_user_household_id"())))) AND (("kid_id" = "auth"."uid"()) OR ("kid_id" IS NULL) OR "public"."is_parent"("public"."current_user_household_id"()))));



CREATE POLICY "Checkins: kid insert own or anyone" ON "public"."checkins" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."assignments" "a"
     JOIN "public"."chores" "c" ON (("c"."id" = "a"."chore_id")))
  WHERE (("a"."id" = "checkins"."assignment_id") AND ("c"."household_id" = "public"."current_user_household_id"()) AND (("a"."kid_id" = "auth"."uid"()) OR ("a"."kid_id" IS NULL))))) AND ("completed_by" = "auth"."uid"())));



CREATE POLICY "Checkins: parents update" ON "public"."checkins" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."assignments" "a"
     JOIN "public"."chores" "c" ON (("c"."id" = "a"."chore_id")))
  WHERE (("a"."id" = "checkins"."assignment_id") AND "public"."is_parent"("c"."household_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."assignments" "a"
     JOIN "public"."chores" "c" ON (("c"."id" = "a"."chore_id")))
  WHERE (("a"."id" = "checkins"."assignment_id") AND "public"."is_parent"("c"."household_id")))));



CREATE POLICY "Checkins: select same household" ON "public"."checkins" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."assignments" "a"
     JOIN "public"."chores" "c" ON (("c"."id" = "a"."chore_id")))
  WHERE (("a"."id" = "checkins"."assignment_id") AND ("c"."household_id" = "public"."current_user_household_id"())))));



CREATE POLICY "Chores: parents manage" ON "public"."chores" USING ("public"."is_parent"("household_id")) WITH CHECK (("public"."is_parent"("household_id") AND ("household_id" = "public"."current_user_household_id"())));



CREATE POLICY "Chores: select same household" ON "public"."chores" FOR SELECT USING (("household_id" = "public"."current_user_household_id"()));



CREATE POLICY "Households: members can select" ON "public"."households" FOR SELECT USING ("public"."is_member"("id"));



CREATE POLICY "Households: parents can update" ON "public"."households" FOR UPDATE USING ("public"."is_parent"("id")) WITH CHECK ("public"."is_parent"("id"));



CREATE POLICY "Ledger: parents manage" ON "public"."ledger_entries" USING ("public"."is_parent"("household_id")) WITH CHECK ("public"."is_parent"("household_id"));



CREATE POLICY "Ledger: select same household" ON "public"."ledger_entries" FOR SELECT USING (("household_id" = "public"."current_user_household_id"()));



CREATE POLICY "Payouts: parents manage" ON "public"."payouts" USING ("public"."is_parent"("household_id")) WITH CHECK ("public"."is_parent"("household_id"));



CREATE POLICY "Payouts: select same household" ON "public"."payouts" FOR SELECT USING (("household_id" = "public"."current_user_household_id"()));



CREATE POLICY "Profiles: select same household" ON "public"."profiles" FOR SELECT USING (("household_id" = "public"."current_user_household_id"()));



CREATE POLICY "Profiles: user can update own" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Redemptions: kid insert own" ON "public"."redemptions" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."rewards" "r"
  WHERE (("r"."id" = "redemptions"."reward_id") AND ("r"."household_id" = "public"."current_user_household_id"())))) AND ("kid_id" = "auth"."uid"())));



CREATE POLICY "Redemptions: parents update" ON "public"."redemptions" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."rewards" "r"
  WHERE (("r"."id" = "redemptions"."reward_id") AND "public"."is_parent"("r"."household_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."rewards" "r"
  WHERE (("r"."id" = "redemptions"."reward_id") AND "public"."is_parent"("r"."household_id")))));



CREATE POLICY "Redemptions: select same household" ON "public"."redemptions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."rewards" "r"
  WHERE (("r"."id" = "redemptions"."reward_id") AND ("r"."household_id" = "public"."current_user_household_id"())))));



CREATE POLICY "Rewards: parents manage" ON "public"."rewards" USING ("public"."is_parent"("household_id")) WITH CHECK ("public"."is_parent"("household_id"));



CREATE POLICY "Rewards: select same household" ON "public"."rewards" FOR SELECT USING (("household_id" = "public"."current_user_household_id"()));



ALTER TABLE "public"."assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checkins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."households" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ledger_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payouts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."redemptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rewards" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."create_full_payout_for_kid"("hh" "uuid", "kid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_full_payout_for_kid"("hh" "uuid", "kid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_full_payout_for_kid"("hh" "uuid", "kid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_local_date"("hh" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."current_local_date"("hh" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_local_date"("hh" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_pay_period"("hh" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."current_pay_period"("hh" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_pay_period"("hh" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_household_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_household_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_household_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."days_due_today"("dows" smallint[], "today" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."days_due_today"("dows" smallint[], "today" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."days_due_today"("dows" smallint[], "today" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."dow_code"("dow" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."dow_code"("dow" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dow_code"("dow" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_member"("hh" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_member"("hh" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_member"("hh" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_parent"("hh" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_parent"("hh" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_parent"("hh" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."local_time_of"("due_at" timestamp with time zone, "tz" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."local_time_of"("due_at" timestamp with time zone, "tz" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."local_time_of"("due_at" timestamp with time zone, "tz" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."on_checkin_verified_create_ledger"() TO "anon";
GRANT ALL ON FUNCTION "public"."on_checkin_verified_create_ledger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."on_checkin_verified_create_ledger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rrule_due_today"("rule" "text", "anchor" "date", "today" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."rrule_due_today"("rule" "text", "anchor" "date", "today" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rrule_due_today"("rule" "text", "anchor" "date", "today" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."rrule_param"("rule" "text", "key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."rrule_param"("rule" "text", "key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rrule_param"("rule" "text", "key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_checkin_amount"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_checkin_amount"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_checkin_amount"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_checkin_points"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_checkin_points"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_checkin_points"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_occurrence_date_default"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_occurrence_date_default"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_occurrence_date_default"() TO "service_role";


















GRANT ALL ON TABLE "public"."assignments" TO "anon";
GRANT ALL ON TABLE "public"."assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."assignments" TO "service_role";



GRANT ALL ON TABLE "public"."checkins" TO "anon";
GRANT ALL ON TABLE "public"."checkins" TO "authenticated";
GRANT ALL ON TABLE "public"."checkins" TO "service_role";



GRANT ALL ON TABLE "public"."chores" TO "anon";
GRANT ALL ON TABLE "public"."chores" TO "authenticated";
GRANT ALL ON TABLE "public"."chores" TO "service_role";



GRANT ALL ON TABLE "public"."households" TO "anon";
GRANT ALL ON TABLE "public"."households" TO "authenticated";
GRANT ALL ON TABLE "public"."households" TO "service_role";



GRANT ALL ON TABLE "public"."ledger_entries" TO "anon";
GRANT ALL ON TABLE "public"."ledger_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."ledger_entries" TO "service_role";



GRANT ALL ON TABLE "public"."payouts" TO "anon";
GRANT ALL ON TABLE "public"."payouts" TO "authenticated";
GRANT ALL ON TABLE "public"."payouts" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."redemptions" TO "anon";
GRANT ALL ON TABLE "public"."redemptions" TO "authenticated";
GRANT ALL ON TABLE "public"."redemptions" TO "service_role";



GRANT ALL ON TABLE "public"."rewards" TO "anon";
GRANT ALL ON TABLE "public"."rewards" TO "authenticated";
GRANT ALL ON TABLE "public"."rewards" TO "service_role";



GRANT ALL ON TABLE "public"."vw_due_today" TO "anon";
GRANT ALL ON TABLE "public"."vw_due_today" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_due_today" TO "service_role";



GRANT ALL ON TABLE "public"."vw_kid_balances" TO "anon";
GRANT ALL ON TABLE "public"."vw_kid_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_kid_balances" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
