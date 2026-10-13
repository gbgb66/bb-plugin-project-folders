import { describe, expect, it } from "vitest";
import { getThreadIndicator, type ThreadIndicatorInput } from "./thread-status";

export const idleThread: ThreadIndicatorInput = {
  status: "idle",
  runtimeStatus: "idle",
  queuedWork: "none",
  indicator: "none",
  hasPendingInteraction: false,
  activity: {
    workflows: 0,
    backgroundAgents: 0,
    backgroundCommands: 0,
    planMode: 0,
    goals: 0,
  },
  createdAt: 100,
  latestAttentionAt: 200,
};

describe("thread status indicator", () => {
  it.each(["active", "starting", "stopping"] as const)(
    "shows work during %s, even with a stale unread result",
    (status) => {
      expect(
        getThreadIndicator({
          ...idleThread,
          status,
          indicator: "unread-error",
        }),
      ).toEqual({ state: "running", label: "Работает" });
    },
  );

  it.each(["active", "starting", "stopping", "provisioning"] as const)(
    "shows work while the runtime is %s",
    (runtimeStatus) => {
      expect(getThreadIndicator({ ...idleThread, runtimeStatus }).state).toBe(
        "running",
      );
    },
  );

  it.each([
    "workflows",
    "backgroundAgents",
    "backgroundCommands",
    "planMode",
    "goals",
  ] as const)(
    "keeps %s work in the running state after the main turn is idle",
    (activity) => {
      expect(
        getThreadIndicator({
          ...idleThread,
          activity: { ...idleThread.activity, [activity]: 1 },
        }).state,
      ).toBe("running");
    },
  );

  it.each([
    { status: "error" },
    { runtimeStatus: "error" },
    { queuedWork: "failed" },
    { indicator: "queued-failed" },
    { indicator: "unread-error" },
  ] as const)(
    "keeps a failure red independently of read state: %j",
    (failure) => {
      expect(getThreadIndicator({ ...idleThread, ...failure })).toEqual({
        state: "error",
        label: "Ошибка",
      });
    },
  );

  it("does not hide a queued send failure behind an active runtime", () => {
    expect(
      getThreadIndicator({
        ...idleThread,
        status: "active",
        queuedWork: "failed",
      }).state,
    ).toBe("error");
  });

  it("keeps a completed answer green after it has been read", () => {
    expect(
      getThreadIndicator({ ...idleThread, indicator: "unread-success" }),
    ).toEqual({
      state: "ready",
      label: "Ответ готов",
    });
    expect(getThreadIndicator(idleThread)).toEqual({
      state: "ready",
      label: "Ответ готов",
    });
  });

  it("keeps a new or merely opened chat neutral", () => {
    expect(
      getThreadIndicator({
        ...idleThread,
        latestAttentionAt: idleThread.createdAt,
      }).state,
    ).toBe("idle");
    expect(getThreadIndicator({ ...idleThread, status: "pending" }).state).toBe(
      "idle",
    );
  });

  it("labels waiting for the user's response instead of claiming completion", () => {
    expect(
      getThreadIndicator({ ...idleThread, hasPendingInteraction: true }),
    ).toEqual({
      state: "running",
      label: "Ожидает вашего ответа",
    });
  });

  it.each([
    { queuedWork: "waiting" },
    { indicator: "queued-waiting" },
    { runtimeStatus: "waiting-for-host" },
  ] as const)("labels queued work: %j", (queue) => {
    expect(getThreadIndicator({ ...idleThread, ...queue })).toEqual({
      state: "running",
      label: "В очереди",
    });
  });

  it("degrades to a neutral dot for fields absent in an older sidebar snapshot", () => {
    expect(getThreadIndicator({} as ThreadIndicatorInput).state).toBe("idle");
  });
});
