import type {
  AgentMessage,
  AgentToolCall,
  RemixSearchCandidate,
} from "@track-lab/api-types";
import { useEffect, useRef } from "react";
import { SparkIcon } from "../../../app/layout/sidebar/icons";
import { useJobsContext } from "../../../app/providers/app-contexts";
import { TrashIcon } from "../../../shared/icons/TrashIcon";
import type { TrackAnalysisJob } from "../../../types";
import { useAgentChat } from "../hooks/useAgentChat";
import "./AgentChat.css";

export function AgentChat() {
  const chat = useAgentChat();
  const jobs = useJobsContext();
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const latestMessageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!chat.isOpen) {
      return;
    }

    latestMessageRef.current?.scrollIntoView({
      block: "end",
      behavior: "smooth",
    });
  }, [
    chat.isOpen,
    chat.messages.length,
    chat.sendMessageMutation.isPending,
    chat.trackAnalysisStatusVersion,
  ]);

  return (
    <>
      <button
        className="agent-chat-launcher"
        type="button"
        onClick={() => chat.setIsOpen(!chat.isOpen)}
        aria-label="Open Track Lab assistant"
      >
        <SparkIcon />
      </button>

      {chat.isOpen && (
        <aside className="agent-chat-drawer" aria-label="Track Lab assistant">
          <header className="agent-chat-header">
            <div>
              <span>Agent</span>
              <strong>{chat.selectedSession?.title ?? "Track Lab Assistant"}</strong>
            </div>
            <button
              className="secondary compact"
              type="button"
              onClick={() => chat.setIsOpen(false)}
            >
              Close
            </button>
          </header>

          <div className="agent-chat-body">
            <section className="agent-session-list" aria-label="Agent sessions">
              <button
                className="compact"
                type="button"
                onClick={() => void chat.createSession()}
                disabled={chat.createSessionMutation.isPending}
              >
                New chat
              </button>
              <div className="agent-session-scroll">
                {chat.sessions.map((session) => (
                  <div
                    className={
                      session.id === chat.selectedSessionId
                        ? "agent-session-row active"
                        : "agent-session-row"
                    }
                    key={session.id}
                  >
                    <button
                      className="agent-session-item"
                      type="button"
                      onClick={() => chat.setSelectedSessionId(session.id)}
                    >
                      <span>{session.title}</span>
                      <small>{formatDate(session.updatedAt)}</small>
                    </button>
                    <button
                      className="agent-session-delete"
                      type="button"
                      aria-label={`Delete ${session.title}`}
                      title="Delete chat"
                      disabled={chat.deleteSessionMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete "${session.title}" and its conversation history?`,
                          )
                        ) {
                          void chat.deleteSession(session.id);
                        }
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="agent-conversation" aria-label="Conversation">
              <div className="agent-message-list" ref={messageListRef}>
                {chat.isLoading ? (
                  <p className="agent-empty">Loading assistant history...</p>
                ) : chat.messages.length ? (
                  chat.messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      isSavingAnalysis={chat.savingMessageId === message.id}
                      isSavedAnalysis={chat.savedMessageIds.has(message.id)}
                      saveError={chat.saveErrorByMessageId.get(message.id) ?? ""}
                      trackAnalysisJobsById={chat.trackAnalysisJobsById}
                      toolCalls={chat.toolCallsByMessageId.get(message.id) ?? []}
                      onOpenJob={jobs.onOpenJob}
                      onSaveAnalysis={chat.saveAnalysisResult}
                    />
                  ))
                ) : (
                  <p className="agent-empty">
                    Ask for track analysis or remix discovery.
                  </p>
                )}
                {chat.sendMessageMutation.isPending && (
                  <p className="agent-empty">Working...</p>
                )}
                <div className="agent-latest-message-anchor" ref={latestMessageRef} />
              </div>

              <form
                className="agent-composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  void chat.sendMessage();
                }}
              >
                <textarea
                  value={chat.draft}
                  onChange={(event) => chat.setDraft(event.target.value)}
                  placeholder="Analyze Strobe by deadmau5 or find remixes for..."
                  rows={3}
                />
                <button
                  type="submit"
                  disabled={!chat.draft.trim() || chat.sendMessageMutation.isPending}
                >
                  Send
                </button>
              </form>
            </section>
          </div>
        </aside>
      )}
    </>
  );
}

function MessageBubble({
  isSavingAnalysis,
  isSavedAnalysis,
  message,
  onSaveAnalysis,
  onOpenJob,
  saveError,
  trackAnalysisJobsById,
  toolCalls,
}: {
  isSavingAnalysis: boolean;
  isSavedAnalysis: boolean;
  message: AgentMessage;
  onSaveAnalysis: (messageId: number, result: unknown) => void;
  onOpenJob: (job: TrackAnalysisJob) => void;
  saveError: string;
  trackAnalysisJobsById: Map<number, TrackAnalysisJob>;
  toolCalls: AgentToolCall[];
}) {
  return (
    <article className={`agent-message ${message.role}`}>
      <p>{message.content}</p>
      {toolCalls.length > 0 && (
        <div className="agent-tool-list">
          {toolCalls.map((call) => (
            <ToolCallCard key={call.id} call={call} />
          ))}
        </div>
      )}
      {Boolean(message.metadata.analysisResult) && (
        <AnalysisResultCard
          isSaving={isSavingAnalysis}
          isSaved={isSavedAnalysis}
          result={message.metadata.analysisResult}
          saveError={saveError}
          onSave={() => onSaveAnalysis(message.id, message.metadata.analysisResult)}
        />
      )}
      {message.metadata.queuedTrackAnalysisJob && (
        <QueuedTrackAnalysisJobCard
          job={
            trackAnalysisJobsById.get(message.metadata.queuedTrackAnalysisJob.id) ??
            message.metadata.queuedTrackAnalysisJob
          }
          onOpenJob={onOpenJob}
        />
      )}
      {message.metadata.remixSearchResult && (
        <RemixSearchResultCard
          candidates={message.metadata.remixSearchResult.candidates}
        />
      )}
    </article>
  );
}

function QueuedTrackAnalysisJobCard({
  job,
  onOpenJob,
}: {
  job: {
    id: number;
    operation: string;
    status: string;
  } | TrackAnalysisJob;
  onOpenJob: (job: TrackAnalysisJob) => void;
}) {
  const copy = getQueuedJobCopy(job.operation, job.status);
  const canOpenJob = isTrackAnalysisJob(job) && job.status === "completed";

  return (
    <div className={`agent-queued-job-card ${job.status}`}>
      <span>{copy.label}</span>
      <strong>#{job.id}</strong>
      <small>
        {job.operation} · {job.status}
      </small>
      <p>{copy.description}</p>
      {canOpenJob && (
        <button
          className="compact"
          type="button"
          onClick={() => onOpenJob(job)}
        >
          Open result
        </button>
      )}
    </div>
  );
}

function isTrackAnalysisJob(
  job: { id: number; operation: string; status: string } | TrackAnalysisJob,
): job is TrackAnalysisJob {
  return "payload" in job && "createdAt" in job;
}

function ToolCallCard({ call }: { call: AgentToolCall }) {
  const queuedJob = getQueuedJobResult(call.result);
  const statusLabel = queuedJob ? `queued job #${queuedJob.id}` : call.status;

  return (
    <div className={`agent-tool-card ${call.status}`}>
      <span>{call.toolName}</span>
      <strong>{statusLabel}</strong>
      {call.errorMessage && <small>{call.errorMessage}</small>}
    </div>
  );
}

function getQueuedJobResult(result: unknown) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return null;
  }

  const job = (result as { job?: unknown }).job;
  if (!job || typeof job !== "object" || Array.isArray(job)) {
    return null;
  }

  const id = (job as { id?: unknown }).id;
  return typeof id === "number" ? { id } : null;
}

function getQueuedJobCopy(operation: string, status: string) {
  const isRemixSearch = operation === "remix_search";

  if (status === "completed") {
    return {
      label: isRemixSearch ? "Remix search completed" : "Track analysis completed",
      description: isRemixSearch
        ? "The worker finished this remix search. Open the results to inspect and save candidates."
        : "The worker finished this analysis. Open the review queue to inspect and save the result.",
    };
  }

  if (status === "failed" || status === "dead_lettered") {
    return {
      label: isRemixSearch ? "Remix search failed" : "Track analysis failed",
      description: isRemixSearch
        ? "The worker could not complete this remix search. Check the queue for retry options."
        : "The worker could not complete this analysis. Check the review queue for retry options.",
    };
  }

  if (status === "analyzing" || status === "processing") {
    return {
      label: isRemixSearch
        ? "Remix search in progress"
        : "Track analysis in progress",
      description: isRemixSearch
        ? "The worker is searching providers and ranking remix candidates."
        : "The worker is querying providers and building the analysis result.",
    };
  }

  return {
    label: isRemixSearch ? "Remix search queued" : "Track analysis queued",
    description: isRemixSearch
      ? "The request is waiting for the worker. Remix candidates will appear when it completes."
      : "The request is waiting for the worker. No analysis result is available yet.",
  };
}

function AnalysisResultCard({
  isSaving,
  isSaved,
  result,
  saveError,
  onSave,
}: {
  isSaving: boolean;
  isSaved: boolean;
  result: unknown;
  saveError: string;
  onSave: () => void;
}) {
  if (!result || typeof result !== "object") {
    return null;
  }

  const details = result as {
    bpm?: number | null;
    genre?: string | null;
    subGenre?: string | null;
    key?: string | null;
    status?: string;
  };

  return (
    <div className="agent-analysis-card">
      <div className="agent-result-grid">
        <Metric label="BPM" value={details.bpm ?? "Unknown"} />
        <Metric label="Genre" value={details.genre ?? "Unknown"} />
        <Metric label="Subgenre" value={details.subGenre ?? "Unknown"} />
        <Metric label="Key" value={details.key ?? "Unknown"} />
        <Metric label="Status" value={details.status ?? "Complete"} />
      </div>
      <div className="agent-analysis-actions">
        <button
          className="compact"
          type="button"
          onClick={onSave}
          disabled={isSaving || isSaved}
        >
          {isSaved ? "Saved" : isSaving ? "Saving..." : "Save analysis"}
        </button>
        {saveError && <small>{saveError}</small>}
      </div>
    </div>
  );
}

function RemixSearchResultCard({
  candidates,
}: {
  candidates: RemixSearchCandidate[];
}) {
  return (
    <div className="agent-remix-list">
      {candidates.slice(0, 5).map((candidate) => (
        <a
          href={candidate.link}
          target="_blank"
          rel="noreferrer"
          key={`${candidate.provider}-${candidate.link}`}
        >
          <strong>{candidate.title}</strong>
          <span>{candidate.artists}</span>
          <small>
            {candidate.provider} · {Math.round(candidate.confidence * 100)}%
          </small>
        </a>
      ))}
      {candidates.length === 0 && <span>No strong remix candidates found.</span>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <span>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
