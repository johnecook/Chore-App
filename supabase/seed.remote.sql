SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."audit_log_entries" ("instance_id", "id", "payload", "created_at", "ip_address") VALUES
	('00000000-0000-0000-0000-000000000000', 'f7441fab-6d5f-4e20-a294-20be3d936ff2', '{"action":"user_signedup","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"provider":"email","user_email":"johnecook@me.com","user_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","user_phone":""}}', '2025-08-14 14:29:22.138711+00', ''),
	('00000000-0000-0000-0000-000000000000', '8fe771b6-fd84-4fce-8492-a730fe7aaaf9', '{"action":"login","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-08-14 14:46:55.194842+00', ''),
	('00000000-0000-0000-0000-000000000000', '66aeb5ab-3124-4e56-ba49-ffff1eac25c6', '{"action":"login","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-08-14 17:26:01.383018+00', ''),
	('00000000-0000-0000-0000-000000000000', '2b397543-1df3-4e09-afdf-d42062b74fa3', '{"action":"token_refreshed","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-14 19:29:59.682862+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c005d228-6476-4fac-be85-0f9db4109dd4', '{"action":"token_revoked","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-14 19:29:59.689022+00', ''),
	('00000000-0000-0000-0000-000000000000', '33079472-bdc0-4da9-9eb7-9da62a3d81db', '{"action":"login","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-08-14 19:42:36.059036+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f8d33283-4f6f-4175-81ce-76a5c1eced82', '{"action":"user_signedup","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"provider":"email","user_email":"will.c.cook@icloud.com","user_id":"62d17eda-195d-49ba-80db-2756690548a5","user_phone":""}}', '2025-08-14 20:33:11.566812+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f8aaf706-07a2-4558-9962-fd48b26ccbeb', '{"action":"user_signedup","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"provider":"email","user_email":"hollisbailey511@gmail.com","user_id":"0b6fdbff-83a2-478f-bdd2-242167c4b734","user_phone":""}}', '2025-08-14 20:33:38.039661+00', ''),
	('00000000-0000-0000-0000-000000000000', '47a8f825-c891-4130-954c-ee42506e9a90', '{"action":"user_signedup","actor_id":"00000000-0000-0000-0000-000000000000","actor_username":"service_role","actor_via_sso":false,"log_type":"team","traits":{"provider":"email","user_email":"elizabeth85bailey@gmail.com","user_id":"16c33085-eeaf-4cc1-ac9b-4dc5d77d30ba","user_phone":""}}', '2025-08-14 20:34:00.943769+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c36a2484-2341-4c57-a654-cf96a30db573', '{"action":"token_refreshed","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-15 13:18:33.700541+00', ''),
	('00000000-0000-0000-0000-000000000000', 'dfc72a7a-9cc1-464c-8909-2db0b400cb9d', '{"action":"token_revoked","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-15 13:18:33.716556+00', ''),
	('00000000-0000-0000-0000-000000000000', '71a20573-b34c-4ccd-a9c8-4ea0a53e283e', '{"action":"token_refreshed","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-15 13:18:42.674161+00', ''),
	('00000000-0000-0000-0000-000000000000', '76b15790-fca9-4c97-a79a-7da903e528b5', '{"action":"token_refreshed","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-15 13:18:47.621278+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f21d0b62-53c4-474f-9416-78bd26f8dc4e', '{"action":"login","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-08-15 13:18:49.715305+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f3828760-f179-4366-bfe1-9ae6da70f657', '{"action":"token_refreshed","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-15 14:32:48.18159+00', ''),
	('00000000-0000-0000-0000-000000000000', 'ebd0acf5-2f29-43c2-9cc2-35f620c1f7c2', '{"action":"token_revoked","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-15 14:32:48.20094+00', ''),
	('00000000-0000-0000-0000-000000000000', '4a13412b-8271-44ed-b1ba-1820fe47d083', '{"action":"token_refreshed","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-15 14:33:19.88351+00', ''),
	('00000000-0000-0000-0000-000000000000', '2adddcfc-7c08-4819-b97d-224e4c9f470d', '{"action":"login","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-08-15 14:33:21.222969+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b9361bf2-fe24-4efb-b42b-ac225f922c51', '{"action":"token_refreshed","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-15 17:18:44.396469+00', ''),
	('00000000-0000-0000-0000-000000000000', 'a4044f78-8fa9-46ae-a66e-3187ef0a7649', '{"action":"token_revoked","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-15 17:18:44.418875+00', ''),
	('00000000-0000-0000-0000-000000000000', '6d904500-36e6-429e-a86f-9da68f710eaa', '{"action":"token_refreshed","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-26 19:39:03.055027+00', ''),
	('00000000-0000-0000-0000-000000000000', '3cbf9026-d6e0-4298-8c6a-2ab2e2e546ea', '{"action":"token_revoked","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-26 19:39:03.067075+00', ''),
	('00000000-0000-0000-0000-000000000000', '372b6f5c-6575-4fa7-9843-3b5d096af87f', '{"action":"token_refreshed","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-26 19:39:09.357196+00', ''),
	('00000000-0000-0000-0000-000000000000', '6fcebc59-94a4-4b7c-bdb8-35d6c332cdab', '{"action":"token_refreshed","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-26 19:39:09.368095+00', ''),
	('00000000-0000-0000-0000-000000000000', 'f3d9ccc1-b1d9-4f44-9b96-3a5337352a6d', '{"action":"token_refreshed","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-26 19:39:38.670667+00', ''),
	('00000000-0000-0000-0000-000000000000', '273a2663-e784-4b70-878d-3a0689a827cb', '{"action":"token_refreshed","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-26 19:39:48.735051+00', ''),
	('00000000-0000-0000-0000-000000000000', '68a129ae-0adb-4472-b686-136caf87ffdf', '{"action":"token_refreshed","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-26 20:46:39.414796+00', ''),
	('00000000-0000-0000-0000-000000000000', '6dc30543-3ced-4c8b-ac43-69dfc3069996', '{"action":"token_revoked","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-26 20:46:39.436642+00', ''),
	('00000000-0000-0000-0000-000000000000', 'e9910d20-6e68-445a-be56-8e8cc19a91e4', '{"action":"user_repeated_signup","actor_id":"62d17eda-195d-49ba-80db-2756690548a5","actor_username":"will.c.cook@icloud.com","actor_via_sso":false,"log_type":"user","traits":{"provider":"email"}}', '2025-08-26 21:01:58.982411+00', ''),
	('00000000-0000-0000-0000-000000000000', 'cbc0d18e-e3be-4ad3-9fad-4a2e8e3887de', '{"action":"login","actor_id":"62d17eda-195d-49ba-80db-2756690548a5","actor_username":"will.c.cook@icloud.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-08-26 21:08:13.000783+00', ''),
	('00000000-0000-0000-0000-000000000000', 'a6ad7412-2bac-453a-8c1f-6d09f3d18188', '{"action":"login","actor_id":"62d17eda-195d-49ba-80db-2756690548a5","actor_username":"will.c.cook@icloud.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-08-26 21:09:18.235083+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c0ae67fd-9db3-49f8-a25d-dcba4f1e7510', '{"action":"login","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-08-26 21:11:50.282894+00', ''),
	('00000000-0000-0000-0000-000000000000', '56678ef4-25d9-414a-9275-1ee302b2682d', '{"action":"login","actor_id":"62d17eda-195d-49ba-80db-2756690548a5","actor_username":"will.c.cook@icloud.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-08-26 21:12:46.029831+00', ''),
	('00000000-0000-0000-0000-000000000000', '131d916f-7db8-4df8-8fa9-c2ad2780117e', '{"action":"token_refreshed","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-26 21:13:12.932536+00', ''),
	('00000000-0000-0000-0000-000000000000', 'e2584181-f577-4d43-9243-fe095d876b27', '{"action":"token_revoked","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-26 21:13:12.933891+00', ''),
	('00000000-0000-0000-0000-000000000000', '3b8770e5-449a-4f21-b895-ab130899682d', '{"action":"token_refreshed","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-26 21:13:20.065035+00', ''),
	('00000000-0000-0000-0000-000000000000', 'b386f751-d31f-47d4-b311-69c084e3b69e', '{"action":"token_refreshed","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-26 21:13:21.133188+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c706a455-77d2-4513-bf0d-868a1d098e78', '{"action":"login","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-08-26 21:13:36.01712+00', ''),
	('00000000-0000-0000-0000-000000000000', '88f3ad6e-bcc3-48da-9400-1c96090d67c5', '{"action":"token_refreshed","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-26 21:15:10.278044+00', ''),
	('00000000-0000-0000-0000-000000000000', '73886a91-de2b-4c81-adc3-7cf367efc8dd', '{"action":"token_revoked","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-26 21:15:10.279403+00', ''),
	('00000000-0000-0000-0000-000000000000', '4c5714f8-b1b5-4560-b734-21e0c1ca0926', '{"action":"token_refreshed","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-26 21:15:20.100343+00', ''),
	('00000000-0000-0000-0000-000000000000', '52f12ef8-434f-4505-948d-9ec3fb2730bd', '{"action":"login","actor_id":"62d17eda-195d-49ba-80db-2756690548a5","actor_username":"will.c.cook@icloud.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-08-26 21:15:42.83443+00', ''),
	('00000000-0000-0000-0000-000000000000', '38fee05c-70aa-4944-b8a1-cbd6c87a9d2f', '{"action":"token_refreshed","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-27 13:21:16.428674+00', ''),
	('00000000-0000-0000-0000-000000000000', '888dfd1a-6159-4e38-9c95-8324429e512b', '{"action":"token_revoked","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-27 13:21:16.443654+00', ''),
	('00000000-0000-0000-0000-000000000000', '78630183-084c-40b1-bd5a-2ddf6164a79c', '{"action":"token_refreshed","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-27 13:21:16.480576+00', ''),
	('00000000-0000-0000-0000-000000000000', '1a021921-807a-4872-8801-da54a96cc7ca', '{"action":"token_refreshed","actor_id":"62d17eda-195d-49ba-80db-2756690548a5","actor_username":"will.c.cook@icloud.com","actor_via_sso":false,"log_type":"token"}', '2025-08-27 17:18:33.824688+00', ''),
	('00000000-0000-0000-0000-000000000000', '14e81b4d-ea7e-4ae2-b6b0-30b8535bd91f', '{"action":"token_revoked","actor_id":"62d17eda-195d-49ba-80db-2756690548a5","actor_username":"will.c.cook@icloud.com","actor_via_sso":false,"log_type":"token"}', '2025-08-27 17:18:33.845838+00', ''),
	('00000000-0000-0000-0000-000000000000', 'fc5972f4-d616-4d4b-bd59-1fb1dd04017e', '{"action":"token_refreshed","actor_id":"62d17eda-195d-49ba-80db-2756690548a5","actor_username":"will.c.cook@icloud.com","actor_via_sso":false,"log_type":"token"}', '2025-08-27 17:18:45.364038+00', ''),
	('00000000-0000-0000-0000-000000000000', '565207b5-8bed-4b74-adba-5ee4887d1bd5', '{"action":"login","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-08-27 17:18:57.748982+00', ''),
	('00000000-0000-0000-0000-000000000000', '8457dee3-0c94-4f31-a2af-888c00cfc8fc', '{"action":"token_refreshed","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-27 18:41:05.732869+00', ''),
	('00000000-0000-0000-0000-000000000000', 'c7e65db7-edca-43cc-ac3d-aaab8a1d7de6', '{"action":"token_revoked","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"token"}', '2025-08-27 18:41:05.756868+00', ''),
	('00000000-0000-0000-0000-000000000000', '573a971d-c84e-4659-9aa0-6a09f85124c1', '{"action":"login","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-08-27 18:41:40.935416+00', ''),
	('00000000-0000-0000-0000-000000000000', 'e7264ad9-68a0-4001-a672-f70f1cbc0068', '{"action":"login","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-08-28 15:26:22.374867+00', ''),
	('00000000-0000-0000-0000-000000000000', 'cb438f2c-b652-4f5c-bc32-a1c3c5a9c8ce', '{"action":"token_refreshed","actor_id":"62d17eda-195d-49ba-80db-2756690548a5","actor_username":"will.c.cook@icloud.com","actor_via_sso":false,"log_type":"token"}', '2025-08-28 15:48:16.081076+00', ''),
	('00000000-0000-0000-0000-000000000000', '228f20f6-4b70-47da-aeac-2a29dc6dec78', '{"action":"token_revoked","actor_id":"62d17eda-195d-49ba-80db-2756690548a5","actor_username":"will.c.cook@icloud.com","actor_via_sso":false,"log_type":"token"}', '2025-08-28 15:48:16.095739+00', ''),
	('00000000-0000-0000-0000-000000000000', 'ce503022-1611-4827-b953-d7c24735c969', '{"action":"token_refreshed","actor_id":"62d17eda-195d-49ba-80db-2756690548a5","actor_username":"will.c.cook@icloud.com","actor_via_sso":false,"log_type":"token"}', '2025-08-28 15:48:25.036073+00', ''),
	('00000000-0000-0000-0000-000000000000', '45f9574b-a31b-4a88-811f-663f8ace431f', '{"action":"login","actor_id":"f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb","actor_username":"johnecook@me.com","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}', '2025-08-28 16:05:20.675805+00', '');


--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', '0b6fdbff-83a2-478f-bdd2-242167c4b734', 'authenticated', 'authenticated', 'hollisbailey511@gmail.com', '$2a$10$MvH3X0Buwfq/Qw15YuY3keWQZXbeCTbNmBNzj2gKnBs2ZnoO6Plti', '2025-08-14 20:33:38.041407+00', NULL, '', NULL, '', NULL, '', '', NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2025-08-14 20:33:38.036248+00', '2025-08-14 20:33:38.042795+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '16c33085-eeaf-4cc1-ac9b-4dc5d77d30ba', 'authenticated', 'authenticated', 'elizabeth85bailey@gmail.com', '$2a$10$3R1N5lBCy5pfI8Xr49Sere0.LWrDiSUt.G769ZNsdaphZS6BKpZl2', '2025-08-14 20:34:00.946219+00', NULL, '', NULL, '', NULL, '', '', NULL, NULL, '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2025-08-14 20:34:00.941733+00', '2025-08-14 20:34:00.948173+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '62d17eda-195d-49ba-80db-2756690548a5', 'authenticated', 'authenticated', 'will.c.cook@icloud.com', '$2a$10$QBxCvqguuMo2AESKDwUHM.XPsne4i/0BvPOq/2aJg71Jx1RneUg4W', '2025-08-14 20:33:11.573027+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-08-26 21:15:42.835733+00', '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2025-08-14 20:33:11.549384+00', '2025-08-28 15:48:16.113885+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', 'authenticated', 'authenticated', 'johnecook@me.com', '$2a$10$T1atd0LbmJEYzemyon9BneAa16LE2pxAvyizYwNBlz8SKPjE0mvTC', '2025-08-14 14:29:22.155443+00', NULL, '', NULL, '', NULL, '', '', NULL, '2025-08-28 16:05:20.705533+00', '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2025-08-14 14:29:22.075956+00', '2025-08-28 16:05:20.749998+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', '{"sub": "f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb", "email": "johnecook@me.com", "email_verified": false, "phone_verified": false}', 'email', '2025-08-14 14:29:22.126928+00', '2025-08-14 14:29:22.128239+00', '2025-08-14 14:29:22.128239+00', '08887704-1557-43a3-b4cd-ac8c2a64953f'),
	('62d17eda-195d-49ba-80db-2756690548a5', '62d17eda-195d-49ba-80db-2756690548a5', '{"sub": "62d17eda-195d-49ba-80db-2756690548a5", "email": "will.c.cook@icloud.com", "email_verified": false, "phone_verified": false}', 'email', '2025-08-14 20:33:11.563423+00', '2025-08-14 20:33:11.563489+00', '2025-08-14 20:33:11.563489+00', '2e23a6d9-5dc9-4f2a-b20f-ec0d2c491f79'),
	('0b6fdbff-83a2-478f-bdd2-242167c4b734', '0b6fdbff-83a2-478f-bdd2-242167c4b734', '{"sub": "0b6fdbff-83a2-478f-bdd2-242167c4b734", "email": "hollisbailey511@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2025-08-14 20:33:38.038824+00', '2025-08-14 20:33:38.038875+00', '2025-08-14 20:33:38.038875+00', '29ec31a0-1bc0-43de-9dfc-a84a18176a9c'),
	('16c33085-eeaf-4cc1-ac9b-4dc5d77d30ba', '16c33085-eeaf-4cc1-ac9b-4dc5d77d30ba', '{"sub": "16c33085-eeaf-4cc1-ac9b-4dc5d77d30ba", "email": "elizabeth85bailey@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2025-08-14 20:34:00.943037+00', '2025-08-14 20:34:00.943087+00', '2025-08-14 20:34:00.943087+00', 'bcc6a583-58fe-4ac5-948e-6ea98c897562');


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag") VALUES
	('0374a537-3e85-4145-8dff-9ebc4db39b2c', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', '2025-08-14 19:42:36.076997+00', '2025-08-15 13:18:47.622478+00', NULL, 'aal1', NULL, '2025-08-15 13:18:47.622406', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36', '67.20.5.250', NULL),
	('a88799f4-ec38-4907-9c4f-6782834cea2f', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', '2025-08-15 13:18:49.716169+00', '2025-08-15 14:33:19.885469+00', NULL, 'aal1', NULL, '2025-08-15 14:33:19.884735', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36', '67.20.5.250', NULL),
	('e31a9f74-703a-4078-b2ea-349ec1aacbf2', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', '2025-08-14 17:26:01.405614+00', '2025-08-26 20:46:39.466025+00', NULL, 'aal1', NULL, '2025-08-26 20:46:39.465947', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36', '67.20.5.250', NULL),
	('492032b2-77a9-4953-8c08-bd485c1aacad', '62d17eda-195d-49ba-80db-2756690548a5', '2025-08-26 21:08:13.008429+00', '2025-08-26 21:08:13.008429+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36', '67.20.5.250', NULL),
	('16ccecce-c75c-41d8-802c-b9d053bdbdd4', '62d17eda-195d-49ba-80db-2756690548a5', '2025-08-26 21:09:18.236283+00', '2025-08-26 21:09:18.236283+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36', '67.20.5.250', NULL),
	('648f9ca8-c77d-45d9-9433-c308d71b8134', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', '2025-08-26 21:11:50.298184+00', '2025-08-26 21:11:50.298184+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36', '67.20.5.250', NULL),
	('b907a6e6-9369-40a3-a4ee-0257e532ff6f', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', '2025-08-14 14:46:55.217406+00', '2025-08-26 21:13:21.135756+00', NULL, 'aal1', NULL, '2025-08-26 21:13:21.135687', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15', '67.20.5.250', NULL),
	('8032165b-31e5-4c19-b6ee-5397ab99eb7f', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', '2025-08-15 14:33:21.225799+00', '2025-08-26 21:15:20.101976+00', NULL, 'aal1', NULL, '2025-08-26 21:15:20.101881', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36', '67.20.5.250', NULL),
	('bcece17b-ffb2-43ee-9dc5-1191fd3688f8', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', '2025-08-26 21:13:36.019019+00', '2025-08-27 13:21:16.483117+00', NULL, 'aal1', NULL, '2025-08-27 13:21:16.48302', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15', '67.20.5.250', NULL),
	('133964f8-6fb4-48d0-8956-9eadf5c7c23c', '62d17eda-195d-49ba-80db-2756690548a5', '2025-08-26 21:15:42.835809+00', '2025-08-27 17:18:45.366095+00', NULL, 'aal1', NULL, '2025-08-27 17:18:45.366006', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36', '67.20.5.250', NULL),
	('40af861f-8cca-477e-9c79-efe8285ea36d', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', '2025-08-27 17:18:57.751508+00', '2025-08-27 18:41:05.788221+00', NULL, 'aal1', NULL, '2025-08-27 18:41:05.788139', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36', '67.20.5.250', NULL),
	('1cdcb5fa-d0fa-4022-b474-496e5bf37c1a', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', '2025-08-27 18:41:40.937701+00', '2025-08-27 18:41:40.937701+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36', '67.20.5.250', NULL),
	('56b9ffa0-caaa-4de4-b673-a6725f17d361', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', '2025-08-28 15:26:22.408246+00', '2025-08-28 15:26:22.408246+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36', '67.20.5.250', NULL),
	('6f865996-dc2a-4348-aff9-ea35b098e786', '62d17eda-195d-49ba-80db-2756690548a5', '2025-08-26 21:12:46.030733+00', '2025-08-28 15:48:25.037388+00', NULL, 'aal1', NULL, '2025-08-28 15:48:25.037322', 'node', '67.20.5.250', NULL),
	('949fccb8-c177-4b9d-aca7-e999265e57a4', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', '2025-08-28 16:05:20.707679+00', '2025-08-28 16:05:20.707679+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36', '67.20.5.250', NULL);


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") VALUES
	('b907a6e6-9369-40a3-a4ee-0257e532ff6f', '2025-08-14 14:46:55.269305+00', '2025-08-14 14:46:55.269305+00', 'password', '1d95dd91-bad8-4f6b-b724-66b2848e3e9d'),
	('e31a9f74-703a-4078-b2ea-349ec1aacbf2', '2025-08-14 17:26:01.456857+00', '2025-08-14 17:26:01.456857+00', 'password', 'efa2f526-c7bf-4f18-a783-225324fe8b9c'),
	('0374a537-3e85-4145-8dff-9ebc4db39b2c', '2025-08-14 19:42:36.113164+00', '2025-08-14 19:42:36.113164+00', 'password', '2fae97d0-63e0-4a6c-a14c-ffdbc5fd2b78'),
	('a88799f4-ec38-4907-9c4f-6782834cea2f', '2025-08-15 13:18:49.721057+00', '2025-08-15 13:18:49.721057+00', 'password', '87658f72-4f75-48dc-bf42-269c35166a45'),
	('8032165b-31e5-4c19-b6ee-5397ab99eb7f', '2025-08-15 14:33:21.234137+00', '2025-08-15 14:33:21.234137+00', 'password', 'b30c11a9-d211-46f1-8d6b-f6049cdc6d77'),
	('492032b2-77a9-4953-8c08-bd485c1aacad', '2025-08-26 21:08:13.036648+00', '2025-08-26 21:08:13.036648+00', 'password', 'd42c02b3-0394-488c-aceb-618c3c501c76'),
	('16ccecce-c75c-41d8-802c-b9d053bdbdd4', '2025-08-26 21:09:18.239113+00', '2025-08-26 21:09:18.239113+00', 'password', '9f0a428f-90db-4b9e-b66f-1177bc8e7699'),
	('648f9ca8-c77d-45d9-9433-c308d71b8134', '2025-08-26 21:11:50.329354+00', '2025-08-26 21:11:50.329354+00', 'password', '030937bc-9c21-40ce-9ff9-b6ac34cbfb4b'),
	('6f865996-dc2a-4348-aff9-ea35b098e786', '2025-08-26 21:12:46.033412+00', '2025-08-26 21:12:46.033412+00', 'password', 'c7a14c38-09ac-4470-a9ed-386bc6d72d9b'),
	('bcece17b-ffb2-43ee-9dc5-1191fd3688f8', '2025-08-26 21:13:36.021493+00', '2025-08-26 21:13:36.021493+00', 'password', '14d07bd8-5ae8-458c-adbf-4d7706c20039'),
	('133964f8-6fb4-48d0-8956-9eadf5c7c23c', '2025-08-26 21:15:42.837912+00', '2025-08-26 21:15:42.837912+00', 'password', '2e09a4f7-4aa7-421f-b91f-47e5b80a8994'),
	('40af861f-8cca-477e-9c79-efe8285ea36d', '2025-08-27 17:18:57.760294+00', '2025-08-27 17:18:57.760294+00', 'password', '0cb451fe-55b8-45ef-8e68-c86dbf7edecb'),
	('1cdcb5fa-d0fa-4022-b474-496e5bf37c1a', '2025-08-27 18:41:40.947431+00', '2025-08-27 18:41:40.947431+00', 'password', '04d8e99c-f839-4a3b-bf66-a48cbae17178'),
	('56b9ffa0-caaa-4de4-b673-a6725f17d361', '2025-08-28 15:26:22.491075+00', '2025-08-28 15:26:22.491075+00', 'password', 'e87977b3-d013-4685-a712-ffd355964e93'),
	('949fccb8-c177-4b9d-aca7-e999265e57a4', '2025-08-28 16:05:20.754947+00', '2025-08-28 16:05:20.754947+00', 'password', '1f3573c7-2384-45c2-99f8-9186fce90d16');


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") VALUES
	('00000000-0000-0000-0000-000000000000', 2, 'pyuf3ej54poi', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', true, '2025-08-14 17:26:01.41956+00', '2025-08-14 19:29:59.690772+00', NULL, 'e31a9f74-703a-4078-b2ea-349ec1aacbf2'),
	('00000000-0000-0000-0000-000000000000', 4, 'g7iaiyo3jr52', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', true, '2025-08-14 19:42:36.090367+00', '2025-08-15 13:18:33.717851+00', NULL, '0374a537-3e85-4145-8dff-9ebc4db39b2c'),
	('00000000-0000-0000-0000-000000000000', 5, '5qivm4athhgf', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', false, '2025-08-15 13:18:33.726008+00', '2025-08-15 13:18:33.726008+00', 'g7iaiyo3jr52', '0374a537-3e85-4145-8dff-9ebc4db39b2c'),
	('00000000-0000-0000-0000-000000000000', 6, 'j2a7udmx464a', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', true, '2025-08-15 13:18:49.719753+00', '2025-08-15 14:32:48.202774+00', NULL, 'a88799f4-ec38-4907-9c4f-6782834cea2f'),
	('00000000-0000-0000-0000-000000000000', 7, 'jkjfn34ojoce', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', false, '2025-08-15 14:32:48.219947+00', '2025-08-15 14:32:48.219947+00', 'j2a7udmx464a', 'a88799f4-ec38-4907-9c4f-6782834cea2f'),
	('00000000-0000-0000-0000-000000000000', 8, 'gzkzlbjbguhg', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', true, '2025-08-15 14:33:21.232854+00', '2025-08-15 17:18:44.421268+00', NULL, '8032165b-31e5-4c19-b6ee-5397ab99eb7f'),
	('00000000-0000-0000-0000-000000000000', 3, '57bdevsy3zi4', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', true, '2025-08-14 19:29:59.693946+00', '2025-08-26 19:39:03.068362+00', 'pyuf3ej54poi', 'e31a9f74-703a-4078-b2ea-349ec1aacbf2'),
	('00000000-0000-0000-0000-000000000000', 10, '7kclcqo3hvme', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', true, '2025-08-26 19:39:03.081617+00', '2025-08-26 20:46:39.437868+00', '57bdevsy3zi4', 'e31a9f74-703a-4078-b2ea-349ec1aacbf2'),
	('00000000-0000-0000-0000-000000000000', 11, '3vnwjzz67xrh', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', false, '2025-08-26 20:46:39.450193+00', '2025-08-26 20:46:39.450193+00', '7kclcqo3hvme', 'e31a9f74-703a-4078-b2ea-349ec1aacbf2'),
	('00000000-0000-0000-0000-000000000000', 12, 'ugpuisbayd52', '62d17eda-195d-49ba-80db-2756690548a5', false, '2025-08-26 21:08:13.018183+00', '2025-08-26 21:08:13.018183+00', NULL, '492032b2-77a9-4953-8c08-bd485c1aacad'),
	('00000000-0000-0000-0000-000000000000', 13, 'wmavffojagsm', '62d17eda-195d-49ba-80db-2756690548a5', false, '2025-08-26 21:09:18.237085+00', '2025-08-26 21:09:18.237085+00', NULL, '16ccecce-c75c-41d8-802c-b9d053bdbdd4'),
	('00000000-0000-0000-0000-000000000000', 14, 'rbqygil6nlvv', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', false, '2025-08-26 21:11:50.309281+00', '2025-08-26 21:11:50.309281+00', NULL, '648f9ca8-c77d-45d9-9433-c308d71b8134'),
	('00000000-0000-0000-0000-000000000000', 1, 'czkijbuhs2ay', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', true, '2025-08-14 14:46:55.235864+00', '2025-08-26 21:13:12.935314+00', NULL, 'b907a6e6-9369-40a3-a4ee-0257e532ff6f'),
	('00000000-0000-0000-0000-000000000000', 16, '5kxcmzeqixz6', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', false, '2025-08-26 21:13:12.93877+00', '2025-08-26 21:13:12.93877+00', 'czkijbuhs2ay', 'b907a6e6-9369-40a3-a4ee-0257e532ff6f'),
	('00000000-0000-0000-0000-000000000000', 9, 'plehncy4aq7z', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', true, '2025-08-15 17:18:44.432684+00', '2025-08-26 21:15:10.280008+00', 'gzkzlbjbguhg', '8032165b-31e5-4c19-b6ee-5397ab99eb7f'),
	('00000000-0000-0000-0000-000000000000', 18, 'sj75bcbkkaeq', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', false, '2025-08-26 21:15:10.281961+00', '2025-08-26 21:15:10.281961+00', 'plehncy4aq7z', '8032165b-31e5-4c19-b6ee-5397ab99eb7f'),
	('00000000-0000-0000-0000-000000000000', 17, 'g44oa7rbjcwu', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', true, '2025-08-26 21:13:36.020326+00', '2025-08-27 13:21:16.444916+00', NULL, 'bcece17b-ffb2-43ee-9dc5-1191fd3688f8'),
	('00000000-0000-0000-0000-000000000000', 20, 'cq4wgfshgqoc', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', false, '2025-08-27 13:21:16.456618+00', '2025-08-27 13:21:16.456618+00', 'g44oa7rbjcwu', 'bcece17b-ffb2-43ee-9dc5-1191fd3688f8'),
	('00000000-0000-0000-0000-000000000000', 19, 'h3ervjymqnuu', '62d17eda-195d-49ba-80db-2756690548a5', true, '2025-08-26 21:15:42.836692+00', '2025-08-27 17:18:33.847686+00', NULL, '133964f8-6fb4-48d0-8956-9eadf5c7c23c'),
	('00000000-0000-0000-0000-000000000000', 21, 'plddsojhlhna', '62d17eda-195d-49ba-80db-2756690548a5', false, '2025-08-27 17:18:33.867336+00', '2025-08-27 17:18:33.867336+00', 'h3ervjymqnuu', '133964f8-6fb4-48d0-8956-9eadf5c7c23c'),
	('00000000-0000-0000-0000-000000000000', 22, 'venbsg3wedaw', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', true, '2025-08-27 17:18:57.75912+00', '2025-08-27 18:41:05.757585+00', NULL, '40af861f-8cca-477e-9c79-efe8285ea36d'),
	('00000000-0000-0000-0000-000000000000', 23, 'nfufoo4fjqfg', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', false, '2025-08-27 18:41:05.77331+00', '2025-08-27 18:41:05.77331+00', 'venbsg3wedaw', '40af861f-8cca-477e-9c79-efe8285ea36d'),
	('00000000-0000-0000-0000-000000000000', 24, '624vizlqztvv', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', false, '2025-08-27 18:41:40.944879+00', '2025-08-27 18:41:40.944879+00', NULL, '1cdcb5fa-d0fa-4022-b474-496e5bf37c1a'),
	('00000000-0000-0000-0000-000000000000', 25, '5em5izdffweo', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', false, '2025-08-28 15:26:22.433568+00', '2025-08-28 15:26:22.433568+00', NULL, '56b9ffa0-caaa-4de4-b673-a6725f17d361'),
	('00000000-0000-0000-0000-000000000000', 15, 'woqi5ralqvsj', '62d17eda-195d-49ba-80db-2756690548a5', true, '2025-08-26 21:12:46.031584+00', '2025-08-28 15:48:16.096964+00', NULL, '6f865996-dc2a-4348-aff9-ea35b098e786'),
	('00000000-0000-0000-0000-000000000000', 26, 'ngua2idmepdh', '62d17eda-195d-49ba-80db-2756690548a5', false, '2025-08-28 15:48:16.109185+00', '2025-08-28 15:48:16.109185+00', 'woqi5ralqvsj', '6f865996-dc2a-4348-aff9-ea35b098e786'),
	('00000000-0000-0000-0000-000000000000', 27, 'vpekbd7wxfud', 'f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', false, '2025-08-28 16:05:20.722305+00', '2025-08-28 16:05:20.722305+00', NULL, '949fccb8-c177-4b9d-aca7-e999265e57a4');


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: households; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."households" ("id", "name", "created_at", "timezone", "allowance_anchor_date", "pay_period_days") VALUES
	('39a01a0f-05f4-46da-9de6-4c1eabb0c1d3', 'Home', '2025-08-14 19:34:29.749437+00', 'America/Chicago', '2025-08-29', 14);


--
-- Data for Name: chores; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."chores" ("id", "household_id", "title", "points", "frequency", "active", "created_at", "default_amount") VALUES
	('26b790b6-68b2-44ab-9e34-ad707d85597b', '39a01a0f-05f4-46da-9de6-4c1eabb0c1d3', 'Load Dishwasher', 1, 'adhoc', true, '2025-08-14 20:25:37.739952+00', 1.00),
	('1ac1ca34-18f9-4506-a766-d2b82e4b1b52', '39a01a0f-05f4-46da-9de6-4c1eabb0c1d3', 'All A''s & B''s', 1, 'adhoc', true, '2025-08-15 13:52:06.076226+00', 1.00),
	('9329e3a4-c3c4-44ea-bdce-8dda657b8744', '39a01a0f-05f4-46da-9de6-4c1eabb0c1d3', 'Remove all clothes, rags, and extra towels from bathroom', 1, 'adhoc', true, '2025-08-15 14:46:02.381887+00', 0.50);


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."profiles" ("id", "display_name", "role", "household_id", "created_at") VALUES
	('f411690b-f8ce-470f-8ccb-6b8e0ec8b6bb', 'John', 'parent', '39a01a0f-05f4-46da-9de6-4c1eabb0c1d3', '2025-08-14 14:29:22.073291+00'),
	('62d17eda-195d-49ba-80db-2756690548a5', 'Will', 'kid', '39a01a0f-05f4-46da-9de6-4c1eabb0c1d3', '2025-08-14 20:33:11.549026+00'),
	('16c33085-eeaf-4cc1-ac9b-4dc5d77d30ba', 'Elizabeth', 'parent', '39a01a0f-05f4-46da-9de6-4c1eabb0c1d3', '2025-08-14 20:34:00.941327+00'),
	('0b6fdbff-83a2-478f-bdd2-242167c4b734', 'Hollis', 'kid', '39a01a0f-05f4-46da-9de6-4c1eabb0c1d3', '2025-08-14 20:33:38.035922+00');


--
-- Data for Name: assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."assignments" ("id", "chore_id", "kid_id", "days_of_week", "created_at", "due_at", "rrule", "amount_override") VALUES
	('0498362b-3048-4720-bb6e-c33fd8b073b3', '1ac1ca34-18f9-4506-a766-d2b82e4b1b52', '62d17eda-195d-49ba-80db-2756690548a5', '{}', '2025-08-15 13:53:10.502685+00', NULL, 'FREQ=WEEKLY;INTERVAL=1;BYDAY=SU', NULL),
	('25014304-e935-4058-8667-d2b154257c4c', '26b790b6-68b2-44ab-9e34-ad707d85597b', '62d17eda-195d-49ba-80db-2756690548a5', '{}', '2025-08-26 21:12:16.982696+00', NULL, 'FREQ=DAILY;INTERVAL=1', NULL);


--
-- Data for Name: checkins; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: payouts; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: ledger_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: rewards; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: redemptions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 27, true);


--
-- PostgreSQL database dump complete
--

RESET ALL;
