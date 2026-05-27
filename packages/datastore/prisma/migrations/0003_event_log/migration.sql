ALTER TABLE "track_analysis_jobs"
  ADD COLUMN "command_id" UUID,
  ADD COLUMN "correlation_id" UUID;

CREATE INDEX "idx_track_analysis_jobs_correlation_id"
  ON "track_analysis_jobs"("correlation_id");

CREATE TABLE "event_log" (
  "id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "occurred_at" TIMESTAMPTZ NOT NULL,
  "correlation_id" UUID NOT NULL,
  "causation_id" UUID,
  "producer" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "event_log_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_log_idempotency_key_key"
  ON "event_log"("idempotency_key");

CREATE INDEX "idx_event_log_correlation_id"
  ON "event_log"("correlation_id");

CREATE INDEX "idx_event_log_event_type_occurred"
  ON "event_log"("event_type", "occurred_at");
