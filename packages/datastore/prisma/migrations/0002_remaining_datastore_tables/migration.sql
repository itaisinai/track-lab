CREATE TABLE "remix_results" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artists" TEXT NOT NULL,
    "remix_artist" TEXT,
    "album" TEXT,
    "genre" TEXT,
    "sub_genre" TEXT,
    "bpm" DOUBLE PRECISION,
    "uploaded_at" TEXT,
    "duration_ms" INTEGER,
    "confidence" DOUBLE PRECISION NOT NULL,
    "relevance_reason" TEXT NOT NULL,
    "original_track_json" TEXT NOT NULL,
    "requested_genre" TEXT,
    "candidate_json" TEXT NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "remix_results_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "remix_results_provider_link_key" ON "remix_results"("provider", "link");

CREATE TABLE "agent_sessions" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_messages" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_tool_calls" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "request_message_id" INTEGER NOT NULL,
    "assistant_message_id" INTEGER,
    "tool_call_id" TEXT,
    "tool_name" TEXT NOT NULL,
    "arguments_json" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result_json" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "agent_tool_calls_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "track_analysis_jobs" (
    "id" SERIAL NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload_json" TEXT NOT NULL,
    "result_json" TEXT,
    "error_message" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "notification_read_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "track_analysis_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_agent_messages_session_created" ON "agent_messages"("session_id", "created_at", "id");
CREATE INDEX "idx_agent_tool_calls_session_started" ON "agent_tool_calls"("session_id", "started_at", "id");
CREATE INDEX "idx_track_analysis_jobs_status_created" ON "track_analysis_jobs"("status", "created_at", "id");
CREATE INDEX "idx_track_analysis_jobs_unresolved" ON "track_analysis_jobs"("resolved_at", "completed_at", "id");

ALTER TABLE "agent_messages"
  ADD CONSTRAINT "agent_messages_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "agent_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_tool_calls"
  ADD CONSTRAINT "agent_tool_calls_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "agent_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_tool_calls"
  ADD CONSTRAINT "agent_tool_calls_request_message_id_fkey"
  FOREIGN KEY ("request_message_id") REFERENCES "agent_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_tool_calls"
  ADD CONSTRAINT "agent_tool_calls_assistant_message_id_fkey"
  FOREIGN KEY ("assistant_message_id") REFERENCES "agent_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
