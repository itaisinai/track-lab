import { useEffect, useMemo, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useCreateAgentSessionMutation } from "../../../api/mutations/useCreateAgentSessionMutation";
import { useSaveEnrichmentResponseMutation } from "../../../api/mutations/useSaveEnrichmentResponseMutation";
import { useSendAgentMessageMutation } from "../../../api/mutations/useSendAgentMessageMutation";
import { useAgentSessionQuery } from "../../../api/queries/useAgentSessionQuery";
import { useAgentSessionsQuery } from "../../../api/queries/useAgentSessionsQuery";
import { queryKeys } from "../../../api/queries/queryKeys";
import { request } from "../../../api/request";
import { apiRoutes } from "../../../api/routes";
import type { TrackAnalysisJob } from "../../../types";

const SELECTED_SESSION_KEY = "track-lab-agent-session-id";
const ASSISTANT_OPEN_KEY = "track-lab-agent-open";

export function useAgentChat() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(
    () => window.localStorage.getItem(ASSISTANT_OPEN_KEY) === "true",
  );
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(() => {
    const saved = window.localStorage.getItem(SELECTED_SESSION_KEY);
    return saved ? Number(saved) : null;
  });
  const [draft, setDraft] = useState("");
  const sessionsQuery = useAgentSessionsQuery();
  const sessionQuery = useAgentSessionQuery(selectedSessionId);
  const createSessionMutation = useCreateAgentSessionMutation();
  const saveEnrichmentResponseMutation = useSaveEnrichmentResponseMutation();
  const sendMessageMutation = useSendAgentMessageMutation();
  const [savingMessageId, setSavingMessageId] = useState<number | null>(null);
  const [savedMessageIds, setSavedMessageIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [saveErrorByMessageId, setSaveErrorByMessageId] = useState<
    Map<number, string>
  >(() => new Map());
  const sessions = sessionsQuery.data ?? [];
  const selectedSession = sessionQuery.data?.session ?? null;
  const messages = sessionQuery.data?.messages ?? [];
  const toolCalls = sessionQuery.data?.toolCalls ?? [];
  const queuedTrackAnalysisJobIds = useMemo(
    () =>
      Array.from(
        new Set(
          messages
            .map((message) => message.metadata.queuedTrackAnalysisJob?.id)
            .filter((id): id is number => typeof id === "number"),
        ),
      ),
    [messages],
  );
  const queuedTrackAnalysisJobQueries = useQueries({
    queries: queuedTrackAnalysisJobIds.map((jobId) => ({
      queryKey: queryKeys.trackAnalysisJob(jobId),
      queryFn: () => getTrackAnalysisJob(jobId),
      refetchInterval: (query: { state: { data?: TrackAnalysisJob } }) =>
        query.state.data?.status === "queued" ||
        query.state.data?.status === "processing"
          ? 1000
          : false,
    })),
  });
  const trackAnalysisJobsById = useMemo(() => {
    const byId = new Map<number, TrackAnalysisJob>();

    for (const query of queuedTrackAnalysisJobQueries) {
      if (query.data) {
        byId.set(query.data.id, query.data);
      }
    }

    return byId;
  }, [queuedTrackAnalysisJobQueries]);
  const trackAnalysisStatusVersion = useMemo(
    () =>
      queuedTrackAnalysisJobQueries
        .map((query) =>
          query.data ? `${query.data.id}:${query.data.status}` : "loading",
        )
        .join("|"),
    [queuedTrackAnalysisJobQueries],
  );

  useEffect(() => {
    window.localStorage.setItem(ASSISTANT_OPEN_KEY, String(isOpen));
  }, [isOpen]);

  useEffect(() => {
    if (selectedSessionId) {
      window.localStorage.setItem(SELECTED_SESSION_KEY, String(selectedSessionId));
      return;
    }

    window.localStorage.removeItem(SELECTED_SESSION_KEY);
  }, [selectedSessionId]);

  useEffect(() => {
    if (!selectedSessionId && sessions[0]) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [selectedSessionId, sessions]);

  const toolCallsByMessageId = useMemo(() => {
    const byMessage = new Map<number, typeof toolCalls>();

    for (const call of toolCalls) {
      const messageId = call.assistantMessageId ?? call.requestMessageId;
      byMessage.set(messageId, [...(byMessage.get(messageId) ?? []), call]);
    }

    return byMessage;
  }, [toolCalls]);

  async function createSession() {
    const response = await createSessionMutation.mutateAsync();
    setSelectedSessionId(response.session.id);
    await queryClient.invalidateQueries({ queryKey: queryKeys.agentSessions });
  }

  async function sendMessage() {
    const content = draft.trim();
    if (!content || sendMessageMutation.isPending) {
      return;
    }

    let sessionId = selectedSessionId;
    if (!sessionId) {
      const response = await createSessionMutation.mutateAsync();
      sessionId = response.session.id;
      setSelectedSessionId(sessionId);
    }

    setDraft("");
    const response = await sendMessageMutation.mutateAsync({
      sessionId,
      request: { content },
    });
    queryClient.setQueryData(queryKeys.agentSession(sessionId), response);
    await queryClient.invalidateQueries({ queryKey: queryKeys.agentSessions });
  }

  async function saveAnalysisResult(messageId: number, analysisResult: unknown) {
    if (!analysisResult || savingMessageId) {
      return;
    }

    setSavingMessageId(messageId);
    setSaveErrorByMessageId((current) => {
      const next = new Map(current);
      next.delete(messageId);
      return next;
    });

    try {
      await saveEnrichmentResponseMutation.mutateAsync(analysisResult);
      setSavedMessageIds((current) => new Set(current).add(messageId));
      await queryClient.invalidateQueries({ queryKey: queryKeys.results });
    } catch (error) {
      setSaveErrorByMessageId((current) =>
        new Map(current).set(
          messageId,
          error instanceof Error ? error.message : "Could not save result.",
        ),
      );
    } finally {
      setSavingMessageId(null);
    }
  }

  return {
    createSession,
    createSessionMutation,
    draft,
    isLoading:
      sessionsQuery.isLoading ||
      (Boolean(selectedSessionId) && sessionQuery.isLoading),
    isOpen,
    messages,
    selectedSession,
    selectedSessionId,
    sendMessage,
    sendMessageMutation,
    saveAnalysisResult,
    saveErrorByMessageId,
    savedMessageIds,
    savingMessageId,
    sessions,
    setDraft,
    setIsOpen,
    setSelectedSessionId,
    trackAnalysisJobsById,
    trackAnalysisStatusVersion,
    toolCallsByMessageId,
  };
}

async function getTrackAnalysisJob(jobId: number) {
  const data = await request<{ job: TrackAnalysisJob }>(
    apiRoutes.trackAnalysisJob(jobId),
  );
  return data.job;
}
