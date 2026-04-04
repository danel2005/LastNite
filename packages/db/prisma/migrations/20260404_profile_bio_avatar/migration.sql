-- Add bio and avatarUrl fields to profiles table
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "bio" VARCHAR(200);
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;
