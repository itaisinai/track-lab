import type { TrackAnalysisJobStatus } from "@track-lab/api-types";

export const apiRoutes = {
  agent: "/agent",
  remixSearch: "/remix-search",
  savedRemixes: "/remix-search/saved",
  results: "/results",
  result: (id: number) => `/results/${id}`,
  enrichResult: (id: number) => `/results/${id}/enrich`,
  trackAnalysisJobs: (options: TrackAnalysisJobListOptions = {}) => {
    const params = new URLSearchParams();

    if (options.statuses?.length) {
      params.set("status", options.statuses.join(","));
    }

    if (options.unresolved) {
      params.set("unresolved", "true");
    }

    if (options.unread) {
      params.set("unread", "true");
    }

    const query = params.toString();
    return `/track-analysis/jobs${query ? `?${query}` : ""}`;
  },
  trackAnalysisJob: (id: number) => `/track-analysis/jobs/${id}`,
  retryTrackAnalysisJob: (id: number) => `/track-analysis/jobs/${id}/retry`,
  resolveTrackAnalysisJob: (id: number) =>
    `/track-analysis/jobs/${id}/resolve`,
  markTrackAnalysisNotificationRead: (id: number) =>
    `/track-analysis/jobs/${id}/notification-read`,
};

type TrackAnalysisJobListOptions = {
  statuses?: TrackAnalysisJobStatus[];
  unresolved?: boolean;
  unread?: boolean;
};
