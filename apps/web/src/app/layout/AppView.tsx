import { DataStoreView } from "../../features/datastore/DataStoreView";
import { EnrichView } from "../../features/enrichment/EnrichView";
import { RemixSearchView } from "../../features/remix-search/RemixSearchView";
import { ResultDrawer } from "../../features/results/ResultDrawer";
import { ResultsView } from "../../features/results/ResultsView";
import { ReviewQueueView } from "../../features/review-queue/ReviewQueueView";
import { ActiveJobStrip } from "./ActiveJobStrip";
import {
  useAppShell,
  useEnrichmentContext,
  useJobsContext,
  useResultsContext,
} from "../providers/app-contexts";
import { TopBar } from "./TopBar";

export function AppView() {
  const {
    activeJobs,
    currentReviewJobId,
    jobsError,
    notificationJobs,
    view,
    onAnalyzeClick,
    onDataStoreClick,
    onNotificationsClick,
    onRemixSearchClick,
    onReviewClick,
    onSavedResultsClick,
  } = useAppShell();
  const enrichment = useEnrichmentContext();
  const resultsState = useResultsContext();
  const jobs = useJobsContext();
  return (
    <>
      <div className="page">
        <main className="page-content">
          <TopBar
            currentReviewJobId={currentReviewJobId}
            notificationCount={notificationJobs.length}
            view={view}
            onAnalyzeClick={onAnalyzeClick}
            onDataStoreClick={onDataStoreClick}
            onNotificationsClick={onNotificationsClick}
            onRemixSearchClick={onRemixSearchClick}
            onReviewClick={onReviewClick}
            onSavedResultsClick={onSavedResultsClick}
          />

          <ActiveJobStrip activeJobs={activeJobs} error={jobsError} />

          {view === "remix-search" ? (
            <RemixSearchView />
          ) : view === "enrich" ? (
            <EnrichView
              title={enrichment.title}
              artists={enrichment.artists}
              response={enrichment.response}
              error={enrichment.error}
              saveMessage={enrichment.saveMessage}
              isLoading={enrichment.isLoading}
              isSaving={enrichment.isSaving}
              canSave={enrichment.canSave}
              canDismiss={Boolean(enrichment.currentReviewJobId)}
              showSearchForm={enrichment.showSearchForm}
              trackDetails={enrichment.trackDetails}
              onTitleChange={enrichment.onTitleChange}
              onArtistsChange={enrichment.onArtistsChange}
              onSubmit={enrichment.onSubmit}
              onEnrich={enrichment.onEnrich}
              onSave={enrichment.onSaveCurrentJob}
              onDismiss={enrichment.onDismissCurrentJob}
            />
          ) : view === "results" ? (
            <ResultsView
              results={resultsState.results}
              error={resultsState.resultsError}
              isLoading={resultsState.isResultsLoading}
              reenrichingId={resultsState.reenrichingId}
              activeJobs={resultsState.activeJobs}
              onRefresh={resultsState.onRefreshResults}
              onMore={resultsState.onMoreResult}
              onReenrich={resultsState.onReenrichResult}
              onDelete={resultsState.onDeleteResult}
            />
          ) : view === "review" ? (
            <ReviewQueueView
              jobs={jobs.reviewJobs}
              notifications={jobs.notificationJobs}
              error={jobs.jobsError}
              onRefresh={jobs.onRefreshJobs}
              onOpen={jobs.onOpenJob}
              onRetry={jobs.onRetryJob}
              onDismiss={jobs.onDismissJob}
            />
          ) : (
            <DataStoreView
              jobs={jobs.allJobs}
              results={jobs.results}
              error={jobs.jobsError}
              onRefresh={jobs.onRefreshDataStore}
            />
          )}
        </main>
      </div>

      {resultsState.selectedResult && (
        <ResultDrawer
          result={resultsState.selectedResult}
          state={resultsState.drawerState}
          isEnriching={
            resultsState.reenrichingId === resultsState.selectedResult.id
          }
          onClose={resultsState.onCloseDrawer}
          onEnrich={resultsState.onReenrichResult}
          onDelete={resultsState.onDeleteResult}
        />
      )}
    </>
  );
}
