import type { PluginSidebarThread } from "@get-bb/plugin-sdk/app";

export type ThreadIndicatorState = "running" | "ready" | "error" | "idle";
export type ThreadIndicatorInput = Pick<
  PluginSidebarThread,
  | "status"
  | "runtimeStatus"
  | "queuedWork"
  | "indicator"
  | "hasPendingInteraction"
  | "activity"
  | "createdAt"
  | "latestAttentionAt"
>;

export function getThreadIndicator(thread: ThreadIndicatorInput): {
  state: ThreadIndicatorState;
  label:
    | "Работает"
    | "Ответ готов"
    | "Ошибка"
    | "Ожидает вашего ответа"
    | "В очереди"
    | "Нет готового ответа";
} {
  if (
    thread.status === "error" ||
    thread.runtimeStatus === "error" ||
    thread.queuedWork === "failed" ||
    thread.indicator === "queued-failed"
  ) {
    return { state: "error", label: "Ошибка" };
  }

  if (
    thread.hasPendingInteraction ||
    thread.indicator === "waiting-for-input"
  ) {
    return { state: "running", label: "Ожидает вашего ответа" };
  }

  // Real execution wins over an unread result left over from an earlier turn.
  if (
    ["active", "starting", "stopping"].includes(thread.status) ||
    ["active", "starting", "stopping", "provisioning"].includes(
      thread.runtimeStatus,
    ) ||
    [
      "runtime",
      "workflow",
      "background-agent",
      "background-command",
      "goal",
      "plan-mode",
      "working-draft",
    ].includes(thread.indicator) ||
    Object.values(thread.activity ?? {}).some((count) => count > 0)
  ) {
    return { state: "running", label: "Работает" };
  }

  if (
    thread.queuedWork === "waiting" ||
    thread.indicator === "queued-waiting" ||
    thread.runtimeStatus === "waiting-for-host"
  ) {
    return { state: "running", label: "В очереди" };
  }

  if (thread.indicator === "unread-error") {
    return { state: "error", label: "Ошибка" };
  }

  // Reading a finished chat clears its unread glyph, but keeps its result.
  // Creation/read/rename timestamps alone are not evidence of a ready answer.
  if (
    thread.indicator === "unread-success" ||
    (thread.status === "idle" && thread.latestAttentionAt > thread.createdAt)
  ) {
    return { state: "ready", label: "Ответ готов" };
  }

  return { state: "idle", label: "Нет готового ответа" };
}
