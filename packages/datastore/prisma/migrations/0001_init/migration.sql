CREATE TABLE "track_results" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "artists" TEXT NOT NULL,
    "album" TEXT,
    "title_key" TEXT NOT NULL,
    "artists_key" TEXT NOT NULL,
    "bpm" DOUBLE PRECISION,
    "genre" TEXT,
    "sub_genre" TEXT,
    "track_key" TEXT,
    "summary" TEXT,
    "status" TEXT NOT NULL,
    "providers_used_json" TEXT NOT NULL,
    "errors_json" TEXT NOT NULL,
    "response_json" TEXT NOT NULL,
    "raw_response" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "track_results_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "track_results_title_key_artists_key_key" ON "track_results"("title_key", "artists_key");
