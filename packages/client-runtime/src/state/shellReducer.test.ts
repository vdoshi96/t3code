import { describe, expect, it } from "vite-plus/test";
import { ProjectId, ThreadId } from "@t3tools/contracts";

import { applyShellStreamEvent } from "./shellReducer.ts";
import { v2Project, v2ShellSnapshot, v2ThreadShell } from "./orchestrationV2TestFixtures.ts";

describe("applyShellStreamEvent", () => {
  it("applies project updates and removals", () => {
    const updated = applyShellStreamEvent(v2ShellSnapshot, {
      kind: "project.updated",
      sequence: 1,
      project: { ...v2Project, title: "Updated" },
    });
    expect(updated.projects[0]?.title).toBe("Updated");
    expect(updated.snapshotSequence).toBe(1);

    const removed = applyShellStreamEvent(updated, {
      kind: "project.removed",
      sequence: 2,
      projectId: ProjectId.make(v2Project.id),
    });
    expect(removed.projects).toEqual([]);
  });

  it("moves a thread between active and archive without duplicating it", () => {
    const archived = applyShellStreamEvent(v2ShellSnapshot, {
      kind: "thread.updated",
      sequence: 3,
      location: "archive",
      thread: { ...v2ThreadShell, archivedAt: v2ThreadShell.updatedAt },
    });
    expect(archived.threads).toEqual([]);
    expect(archived.archivedThreads).toHaveLength(1);

    const active = applyShellStreamEvent(archived, {
      kind: "thread.updated",
      sequence: 4,
      location: "active",
      thread: v2ThreadShell,
    });
    expect(active.threads).toHaveLength(1);
    expect(active.archivedThreads).toEqual([]);
  });

  it("removes a thread from either collection", () => {
    const next = applyShellStreamEvent(v2ShellSnapshot, {
      kind: "thread.removed",
      sequence: 5,
      location: "active",
      threadId: ThreadId.make(v2ThreadShell.id),
    });
    expect(next.threads).toEqual([]);
    expect(next.snapshotSequence).toBe(5);
  });
});
