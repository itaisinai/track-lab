export const queryKeys = {
  results: ["results"] as const,
  activeJobs: ["track-analysis-jobs", "active"] as const,
  notificationJobs: ["track-analysis-jobs", "notifications"] as const,
  reviewJobs: ["track-analysis-jobs", "review"] as const,
  allJobs: ["track-analysis-jobs", "all"] as const,
};
