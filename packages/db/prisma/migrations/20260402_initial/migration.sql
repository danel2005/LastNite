-- LastNite — Initial Migration
-- Generated from: prisma/schema.prisma
-- Run against a real DB: prisma migrate deploy (from packages/db)

-- CreateEnum
CREATE TYPE "EventState" AS ENUM ('draft', 'scheduled', 'live', 'ending', 'processing', 'completed', 'archived', 'cancelled');
CREATE TYPE "EventTemplate" AS ENUM ('house_party', 'night_out', 'birthday', 'bachelor_bachelorette', 'trip', 'festival');
CREATE TYPE "MissionCategory" AS ENUM ('selfie', 'group_selfie', 'duo', 'target_person', 'object_hunt', 'environment', 'food_drink', 'mood_vibe', 'chaos', 'public_social', 'finale', 'everyone_now', 'custom');
CREATE TYPE "MissionMediaType" AS ENUM ('photo', 'video', 'any');
CREATE TYPE "MissionAssignmentStatus" AS ENUM ('pending', 'active', 'completed', 'expired', 'skipped');
CREATE TYPE "SubmissionAssetType" AS ENUM ('photo', 'video');
CREATE TYPE "SubmissionAssetStatus" AS ENUM ('pending_upload', 'uploaded', 'failed');
CREATE TYPE "ModerationStatus" AS ENUM ('pending', 'approved', 'flagged', 'removed');
CREATE TYPE "ExportJobType" AS ENUM ('photo_pack', 'highlight_reel');
CREATE TYPE "ExportJobStatus" AS ENUM ('pending', 'processing', 'ready', 'failed');
CREATE TYPE "NotificationType" AS ENUM ('event_starting_soon', 'event_started', 'mission_assigned', 'mission_expiring_soon', 'group_mission_live', 'event_ending_soon', 'reveal_ready', 'export_ready');
CREATE TYPE "ReportCategory" AS ENUM ('inappropriate', 'harmful', 'spam', 'other');
CREATE TYPE "ReportStatus" AS ENUM ('pending', 'reviewed', 'resolved', 'dismissed');

-- CreateTable: users
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateTable: profiles
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" VARCHAR(50) NOT NULL,
    "avatar_storage_key" TEXT,
    "expo_push_token" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- CreateTable: user_mission_preferences
CREATE TABLE "user_mission_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "disable_public_social" BOOLEAN NOT NULL DEFAULT false,
    "disable_alcohol_refs" BOOLEAN NOT NULL DEFAULT false,
    "disable_intensity_above" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "user_mission_preferences_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_mission_preferences_user_id_key" ON "user_mission_preferences"("user_id");

-- CreateTable: events
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "host_id" TEXT NOT NULL,
    "state" "EventState" NOT NULL DEFAULT 'draft',
    "template" "EventTemplate" NOT NULL DEFAULT 'house_party',
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "mission_interval_minutes" INTEGER NOT NULL DEFAULT 30,
    "mission_intensity" INTEGER NOT NULL DEFAULT 3,
    "allow_custom_missions" BOOLEAN NOT NULL DEFAULT true,
    "allow_public_social_missions" BOOLEAN NOT NULL DEFAULT false,
    "safe_mode" BOOLEAN NOT NULL DEFAULT false,
    "invite_code" VARCHAR(10) NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "events_invite_code_key" ON "events"("invite_code");
CREATE INDEX "events_state_starts_at_idx" ON "events"("state", "starts_at");
CREATE INDEX "events_state_ends_at_idx" ON "events"("state", "ends_at");
CREATE INDEX "events_host_id_idx" ON "events"("host_id");
CREATE INDEX "events_invite_code_idx" ON "events"("invite_code");

-- CreateTable: participants
CREATE TABLE "participants" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "is_host" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMPTZ,
    "removed_at" TIMESTAMPTZ,
    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "participants_event_id_user_id_key" ON "participants"("event_id", "user_id");
CREATE INDEX "participants_user_id_idx" ON "participants"("user_id");
CREATE INDEX "participants_event_id_idx" ON "participants"("event_id");

-- CreateTable: invites
CREATE TABLE "invites" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "invites_code_key" ON "invites"("code");
CREATE INDEX "invites_code_idx" ON "invites"("code");

-- CreateTable: mission_definitions
CREATE TABLE "mission_definitions" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "category" "MissionCategory" NOT NULL,
    "media_type" "MissionMediaType" NOT NULL DEFAULT 'any',
    "intensity" INTEGER NOT NULL,
    "is_social" BOOLEAN NOT NULL DEFAULT false,
    "default_is_secret" BOOLEAN NOT NULL DEFAULT false,
    "min_duration_ms" INTEGER,
    "max_duration_ms" INTEGER,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT,
    "event_id" TEXT,
    "target_user_id" TEXT,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "mission_definitions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "mission_definitions_is_system_category_idx" ON "mission_definitions"("is_system", "category");
CREATE INDEX "mission_definitions_event_id_idx" ON "mission_definitions"("event_id");
CREATE INDEX "mission_definitions_created_by_user_id_idx" ON "mission_definitions"("created_by_user_id");

-- CreateTable: mission_packs
CREATE TABLE "mission_packs" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "mission_packs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "mission_packs_slug_key" ON "mission_packs"("slug");

-- CreateTable: mission_pack_definitions
CREATE TABLE "mission_pack_definitions" (
    "id" TEXT NOT NULL,
    "pack_id" TEXT NOT NULL,
    "definition_id" TEXT NOT NULL,
    CONSTRAINT "mission_pack_definitions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "mission_pack_definitions_pack_id_definition_id_key" ON "mission_pack_definitions"("pack_id", "definition_id");

-- CreateTable: event_mission_packs
CREATE TABLE "event_mission_packs" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "pack_id" TEXT NOT NULL,
    CONSTRAINT "event_mission_packs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "event_mission_packs_event_id_pack_id_key" ON "event_mission_packs"("event_id", "pack_id");

-- CreateTable: mission_instances
CREATE TABLE "mission_instances" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "definition_id" TEXT NOT NULL,
    "is_finale" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mission_instances_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "mission_instances_event_id_definition_id_key" ON "mission_instances"("event_id", "definition_id");
CREATE INDEX "mission_instances_event_id_idx" ON "mission_instances"("event_id");

-- CreateTable: mission_assignments
CREATE TABLE "mission_assignments" (
    "id" TEXT NOT NULL,
    "mission_instance_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "is_secret" BOOLEAN NOT NULL DEFAULT false,
    "status" "MissionAssignmentStatus" NOT NULL DEFAULT 'active',
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "completed_at" TIMESTAMPTZ,
    "skipped_at" TIMESTAMPTZ,
    CONSTRAINT "mission_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "mission_assignments_user_id_mission_instance_id_key" ON "mission_assignments"("user_id", "mission_instance_id");
CREATE INDEX "mission_assignments_event_id_user_id_status_idx" ON "mission_assignments"("event_id", "user_id", "status");
CREATE INDEX "mission_assignments_status_expires_at_idx" ON "mission_assignments"("status", "expires_at");
CREATE INDEX "mission_assignments_event_id_idx" ON "mission_assignments"("event_id");

-- CreateTable: submissions
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "submissions_assignment_id_key" ON "submissions"("assignment_id");
CREATE INDEX "submissions_event_id_created_at_idx" ON "submissions"("event_id", "created_at");
CREATE INDEX "submissions_user_id_event_id_idx" ON "submissions"("user_id", "event_id");

-- CreateTable: submission_assets
CREATE TABLE "submission_assets" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "asset_type" "SubmissionAssetType" NOT NULL,
    "status" "SubmissionAssetStatus" NOT NULL DEFAULT 'pending_upload',
    "storage_key" TEXT NOT NULL,
    "mime_type" VARCHAR(50) NOT NULL,
    "file_size_bytes" BIGINT,
    "width_px" INTEGER,
    "height_px" INTEGER,
    "duration_ms" INTEGER,
    "captured_at" TIMESTAMPTZ,
    "moderation_status" "ModerationStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "submission_assets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "submission_assets_submission_id_idx" ON "submission_assets"("submission_id");
CREATE INDEX "submission_assets_moderation_status_idx" ON "submission_assets"("moderation_status");

-- CreateTable: reactions
CREATE TABLE "reactions" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "emoji" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "reactions_submission_id_user_id_key" ON "reactions"("submission_id", "user_id");
CREATE INDEX "reactions_submission_id_idx" ON "reactions"("submission_id");

-- CreateTable: notifications
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_id" TEXT,
    "type" "NotificationType" NOT NULL,
    "payload" JSONB NOT NULL,
    "sent_at" TIMESTAMPTZ,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notifications_user_id_sent_at_idx" ON "notifications"("user_id", "sent_at");
CREATE INDEX "notifications_event_id_type_idx" ON "notifications"("event_id", "type");

-- CreateTable: recap_artifacts
CREATE TABLE "recap_artifacts" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "generated_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recap_artifacts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "recap_artifacts_event_id_key" ON "recap_artifacts"("event_id");

-- CreateTable: export_jobs
CREATE TABLE "export_jobs" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "type" "ExportJobType" NOT NULL,
    "status" "ExportJobStatus" NOT NULL DEFAULT 'pending',
    "result_payload" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "export_jobs_event_id_idx" ON "export_jobs"("event_id");
CREATE INDEX "export_jobs_status_created_at_idx" ON "export_jobs"("status", "created_at");

-- CreateTable: moderation_reports
CREATE TABLE "moderation_reports" (
    "id" TEXT NOT NULL,
    "reported_by_user_id" TEXT NOT NULL,
    "submission_asset_id" TEXT,
    "category" "ReportCategory" NOT NULL,
    "description" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'pending',
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "moderation_reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "moderation_reports_status_created_at_idx" ON "moderation_reports"("status", "created_at");

-- AddForeignKey (all FK constraints)
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_mission_preferences" ADD CONSTRAINT "user_mission_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON UPDATE CASCADE;
ALTER TABLE "participants" ADD CONSTRAINT "participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "participants" ADD CONSTRAINT "participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE CASCADE;
ALTER TABLE "invites" ADD CONSTRAINT "invites_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invites" ADD CONSTRAINT "invites_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON UPDATE CASCADE;
ALTER TABLE "mission_definitions" ADD CONSTRAINT "mission_definitions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON UPDATE CASCADE;
ALTER TABLE "mission_definitions" ADD CONSTRAINT "mission_definitions_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON UPDATE CASCADE;
ALTER TABLE "mission_definitions" ADD CONSTRAINT "mission_definitions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON UPDATE CASCADE;
ALTER TABLE "mission_pack_definitions" ADD CONSTRAINT "mission_pack_definitions_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "mission_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mission_pack_definitions" ADD CONSTRAINT "mission_pack_definitions_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "mission_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_mission_packs" ADD CONSTRAINT "event_mission_packs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_mission_packs" ADD CONSTRAINT "event_mission_packs_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "mission_packs"("id") ON UPDATE CASCADE;
ALTER TABLE "mission_instances" ADD CONSTRAINT "mission_instances_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mission_instances" ADD CONSTRAINT "mission_instances_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "mission_definitions"("id") ON UPDATE CASCADE;
ALTER TABLE "mission_assignments" ADD CONSTRAINT "mission_assignments_mission_instance_id_fkey" FOREIGN KEY ("mission_instance_id") REFERENCES "mission_instances"("id") ON UPDATE CASCADE;
ALTER TABLE "mission_assignments" ADD CONSTRAINT "mission_assignments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON UPDATE CASCADE;
ALTER TABLE "mission_assignments" ADD CONSTRAINT "mission_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE CASCADE;
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON UPDATE CASCADE;
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE CASCADE;
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "mission_assignments"("id") ON UPDATE CASCADE;
ALTER TABLE "submission_assets" ADD CONSTRAINT "submission_assets_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON UPDATE CASCADE;
ALTER TABLE "recap_artifacts" ADD CONSTRAINT "recap_artifacts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON UPDATE CASCADE;
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON UPDATE CASCADE;
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON UPDATE CASCADE;
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_reported_by_user_id_fkey" FOREIGN KEY ("reported_by_user_id") REFERENCES "users"("id") ON UPDATE CASCADE;
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_submission_asset_id_fkey" FOREIGN KEY ("submission_asset_id") REFERENCES "submission_assets"("id") ON UPDATE CASCADE;
