// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ThreadStatusIndicator } from "./thread-status-indicator";
import type { ThreadIndicatorInput } from "./thread-status";

const thread: ThreadIndicatorInput = {
  status: "active",
  runtimeStatus: "active",
  queuedWork: "none",
  indicator: "runtime",
  hasPendingInteraction: false,
  activity: {
    workflows: 0,
    backgroundAgents: 0,
    backgroundCommands: 0,
    planMode: 0,
    goals: 0,
  },
  createdAt: 100,
  latestAttentionAt: 100,
};

afterEach(() => {
  cleanup();
  localStorage.clear();
});

it("updates the visible color and accessible label as a turn finishes, is read, fails and retries", () => {
  const view = render(<ThreadStatusIndicator thread={thread} />);
  expect(
    view
      .getByRole("img", { name: "Working" })
      .classList.contains("bg-orange-600"),
  ).toBe(true);

  const completed: ThreadIndicatorInput = {
    ...thread,
    status: "idle",
    runtimeStatus: "idle",
    indicator: "unread-success",
    latestAttentionAt: 200,
  };
  view.rerender(<ThreadStatusIndicator thread={completed} />);
  expect(
    view
      .getByRole("img", { name: "Answer ready" })
      .classList.contains("bg-green-600"),
  ).toBe(true);

  view.rerender(
    <ThreadStatusIndicator thread={{ ...completed, indicator: "none" }} />,
  );
  expect(view.getByRole("img", { name: "Answer ready" })).toBeTruthy();

  view.rerender(
    <ThreadStatusIndicator
      thread={{ ...completed, status: "error", indicator: "none" }}
    />,
  );
  expect(
    view.getByRole("img", { name: "Error" }).classList.contains("bg-red-600"),
  ).toBe(true);

  view.rerender(
    <ThreadStatusIndicator thread={{ ...thread, indicator: "unread-error" }} />,
  );
  expect(view.getByRole("img", { name: "Working" })).toBeTruthy();
});

it("provides Russian labels and an explanatory tooltip for waiting", () => {
  localStorage.setItem("project-folders:language", "ru");
  const view = render(
    <ThreadStatusIndicator
      thread={{ ...thread, hasPendingInteraction: true }}
    />,
  );
  const dot = view.getByRole("img", { name: "Ожидает вашего ответа" });
  expect(dot.getAttribute("title")).toBe("Ожидает вашего ответа");
  expect(dot.classList.contains("bg-orange-600")).toBe(true);
});
