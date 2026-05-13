# AI Terminology Guidelines

Track Lab uses precise AI engineering terminology. Avoid calling deterministic
application code "agentic" or naming internal provider orchestration as "tools."

## Terms

- **Provider**: External API, website, datastore, or evidence source. Examples:
  Spotify metadata lookup, Beatport lookup, SoundCloud search, GetSongBPM, and
  Wikipedia context.
- **Planner**: Decision layer that selects an execution path or provider set.
  A planner may use an LLM, but it does not fetch evidence itself.
- **Service**: Deterministic application or domain logic.
- **Pipeline**: Multi-step execution flow owned by application code or a worker.
- **Tool**: Capability directly callable by an LLM or agent runtime, such as a
  LangChain tool, OpenAI function-calling tool, MCP tool, or Agents SDK tool.
- **Agent**: Autonomous runtime with iterative reasoning and tool-calling.

## Naming Rules

- Use `Provider` for external metadata and search sources.
- Use `Planner` or `ExecutionPlanner` for routing and orchestration decisions.
- Use `Service` for deterministic domain logic.
- Use `Pipeline` for multi-step worker-owned flows.
- Use `Tool` only for capabilities exposed directly to an LLM or agent runtime.
- Use `Agent` only for autonomous LLM runtimes that can iteratively call tools.

## Examples

- `MetadataProviderPlan`, not `MetadataToolPlan`.
- `planMetadataProviders`, not `planMetadataTools`.
- `providersToRun`, not `toolsToRun`.
- `providersUsed`, not `toolsUsed`, for provider execution status.
- `enrichTrackMetadataTool` remains correct because it is a real LangChain tool.
