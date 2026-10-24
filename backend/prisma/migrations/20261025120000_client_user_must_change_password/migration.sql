-- Forces a client-portal user off the agency-generated temporary password on
-- first sign-in. See ClientUser.mustChangePassword.
--
-- Defaults to false so every pre-existing client account (already using a
-- password the client set, or still on an admin temp password from before this
-- feature) is left untouched and is NOT forced through a change on next login.
-- Only accounts created after this migration are flagged true at creation.
ALTER TABLE "ClientUser" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;
