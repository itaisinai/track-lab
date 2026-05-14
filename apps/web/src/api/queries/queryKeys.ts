export const queryKeys = {
  agentSessions: ["agent", "sessions"] as const,
  agentSession: (id: number) => ["agent", "sessions", id] as const,
  results: ["results"] as const,
  savedRemixes: ["remix-search", "saved"] as const,
  activeJobs: ["track-analysis-jobs", "active"] as const,
  notificationJobs: ["track-analysis-jobs", "notifications"] as const,
  reviewJobs: ["track-analysis-jobs", "review"] as const,
  allJobs: ["track-analysis-jobs", "all"] as const,
  trackAnalysisJob: (id: number) => ["track-analysis-jobs", id] as const,
};
