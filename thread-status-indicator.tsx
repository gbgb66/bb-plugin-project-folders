import { t } from "./i18n";
import { getThreadIndicator, type ThreadIndicatorInput } from "./thread-status";

const colors = {
  running: "bg-orange-600",
  ready: "bg-green-600",
  error: "bg-red-600",
  idle: "bg-muted-foreground/40",
} as const;

export function ThreadStatusIndicator({
  thread,
}: {
  thread: ThreadIndicatorInput;
}) {
  const { state, label } = getThreadIndicator(thread);
  const text = t(label);
  return (
    <span
      className={`pf-status ${colors[state]}`}
      data-thread-status={state}
      role="img"
      aria-label={text}
      title={text}
    />
  );
}
