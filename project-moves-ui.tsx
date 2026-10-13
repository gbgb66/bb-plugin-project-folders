import {
  createContext,
  useContext,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { useRpc } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "./server";
import type { ProjectGroup } from "./project-groups";
import { t } from "./i18n";
import { Icon } from "./components/ui/icon";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from "./components/ui/dropdown-menu";

export const PROJECT_DRAG_TYPE = "application/x-bb-project-folders-project";
type Drop = {
  kind: "project" | "group" | "root";
  id: string;
  groupId: string | null;
  beforeProjectId?: string | null;
  position?: "above" | "below";
};
type Moves = {
  groups: ProjectGroup[];
  projects: { id: string; name: string }[];
  dragged: string | null;
  busy: boolean;
  drop: Drop | null;
  groupOf(id: string): string | null;
  siblings(id: string): string[];
  start(id: string, event: DragEvent): void;
  end(): void;
  highlight(drop: Drop | null): void;
  accept(event: DragEvent): boolean;
  move(
    id: string,
    groupId: string | null,
    beforeProjectId?: string | null,
  ): Promise<void>;
};
const Context = createContext<Moves | null>(null);

export function ProjectMoveProvider({
  groups,
  projects,
  visibleIds,
  refresh,
  onManualOrder,
  onMoved,
  children,
}: {
  groups: ProjectGroup[];
  projects: { id: string; name: string }[];
  visibleIds: string[];
  refresh(): void;
  onManualOrder?(): Promise<void>;
  onMoved?(groupId: string | null): void;
  children: ReactNode;
}) {
  const rpc = useRpc<typeof rpcContract>();
  const [dragged, setDragged] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const groupOf = (id: string) =>
    groups.find((g) => g.projectIds.includes(id))?.id ?? null;
  const known = new Set(projects.map((p) => p.id));
  const visible = [...new Set(visibleIds)].filter((id) => known.has(id));
  const siblings = (id: string) => {
    const groupId = groupOf(id);
    return groupId
      ? groups
          .find((g) => g.id === groupId)!
          .projectIds.filter((p) => visible.includes(p))
      : visible.filter((p) => groupOf(p) === null);
  };
  const end = () => {
    setDragged(null);
    setDrop(null);
  };
  const move = async (
    id: string,
    groupId: string | null,
    beforeProjectId?: string | null,
  ) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    end();
    setError("");
    setNotice("");
    try {
      await rpc.call("project_group_place", {
        projectId: id,
        groupId,
        ...(beforeProjectId === undefined ? {} : { beforeProjectId }),
      });
      onMoved?.(groupId);
      refresh();
      if (groupId === null && beforeProjectId !== undefined)
        await onManualOrder?.();
      setNotice(
        `${t("Проект перемещён")}: ${projects.find((p) => p.id === id)?.name ?? id}`,
      );
    } catch (e) {
      setError(String(e));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const value: Moves = {
    groups,
    projects,
    dragged,
    busy,
    drop,
    groupOf,
    siblings,
    move,
    end,
    highlight: setDrop,
    start: (id, event) => {
      event.stopPropagation();
      if (pending.current || !known.has(id)) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.setData(PROJECT_DRAG_TYPE, id);
      event.dataTransfer.effectAllowed = "move";
      setDragged(id);
      setDrop(null);
      setError("");
      setNotice("");
    },
    accept: (event) =>
      !!dragged &&
      !pending.current &&
      event.dataTransfer.getData(PROJECT_DRAG_TYPE) === dragged,
  };
  return (
    <Context.Provider value={value}>
      {error && (
        <p role="alert" className="pf-error pf-project-move-feedback">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="pf-project-move-feedback">
          {notice}
        </p>
      )}
      {children}
    </Context.Provider>
  );
}

/** Only the project icon starts this drag; chat and section drags keep their behavior. */
export function ProjectDragHandle({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const moves = useContext(Context);
  if (!moves) return <>{children}</>;
  return (
    <span
      className="pf-project-drag-handle"
      aria-hidden="true"
      data-project-drag-handle={projectId}
      title={`${t("Перетащить проект")}: ${moves.projects.find((p) => p.id === projectId)?.name ?? ""}`}
      draggable={!moves.busy}
      onDragStart={(e) => moves.start(projectId, e)}
      onDragEnd={(e) => {
        e.stopPropagation();
        moves.end();
      }}
    >
      {children}
    </span>
  );
}

/** Capture project drops before a nested section/chat handler can consume them. */
export function ProjectMoveEntry({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const moves = useContext(Context);
  const highlighted =
    moves?.drop?.kind === "project" && moves.drop.id === projectId;
  return (
    <div
      className={
        "pf-project-move-entry" +
        (highlighted ? ` pf-project-drop-${moves.drop!.position}` : "")
      }
      data-tree-project-id={projectId}
      onDragStartCapture={(e) => {
        const row = e.currentTarget.querySelector(".pf-heading, .pf-side-row");
        if (moves && row && e.target instanceof Node && row.contains(e.target))
          moves.start(projectId, e);
      }}
      onDragEndCapture={(e) => {
        if (moves?.dragged === projectId) {
          e.stopPropagation();
          moves.end();
        }
      }}
      onDragOverCapture={(e) => {
        if (
          !moves?.dragged ||
          moves.busy ||
          !moves.projects.some((p) => p.id === projectId)
        )
          return;
        const row = e.currentTarget.querySelector(".pf-heading, .pf-side-row");
        if (!row || !(e.target instanceof Node) || !row.contains(e.target))
          return;
        e.stopPropagation();
        if (moves.dragged === projectId) {
          moves.highlight(null);
          return;
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const rect = row.getBoundingClientRect();
        const above = e.clientY < rect.top + rect.height / 2;
        const siblings = moves
          .siblings(projectId)
          .filter((p) => p !== moves.dragged);
        const at = siblings.indexOf(projectId);
        moves.highlight({
          kind: "project",
          id: projectId,
          groupId: moves.groupOf(projectId),
          beforeProjectId: above ? projectId : (siblings[at + 1] ?? null),
          position: above ? "above" : "below",
        });
      }}
      onDropCapture={(e) => {
        if (
          !moves?.accept(e) ||
          !moves.drop ||
          moves.drop.kind !== "project" ||
          moves.drop.id !== projectId
        )
          return;
        e.preventDefault();
        e.stopPropagation();
        void moves.move(
          moves.dragged!,
          moves.drop.groupId,
          moves.drop.beforeProjectId,
        );
      }}
      onDragLeave={(e) => {
        if (
          highlighted &&
          (!(e.relatedTarget instanceof Node) ||
            !e.currentTarget.contains(e.relatedTarget))
        )
          moves?.highlight(null);
      }}
    >
      {children}
    </div>
  );
}

export function ProjectGroupDropTarget({
  groupId,
  children,
}: {
  groupId: string;
  children: ReactNode;
}) {
  const moves = useContext(Context);
  const highlighted =
    moves?.drop?.kind === "group" && moves.drop.id === groupId;
  return (
    <div
      className={
        "pf-project-group-drop-target" +
        (highlighted ? " pf-project-drop-into" : "")
      }
      data-project-group-drop-target={groupId}
      onDragOver={(e) => {
        if (!moves?.dragged || moves.busy) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        moves.highlight({ kind: "group", id: groupId, groupId });
      }}
      onDropCapture={(e) => {
        if (
          !moves?.accept(e) ||
          moves.drop?.kind !== "group" ||
          moves.drop.id !== groupId
        )
          return;
        e.preventDefault();
        e.stopPropagation();
        void moves.move(moves.dragged!, groupId);
      }}
      onDragLeave={(e) => {
        if (
          highlighted &&
          (!(e.relatedTarget instanceof Node) ||
            !e.currentTarget.contains(e.relatedTarget))
        )
          moves?.highlight(null);
      }}
    >
      {children}
    </div>
  );
}

export function ProjectTopLevelDropTarget() {
  const moves = useContext(Context);
  if (!moves?.dragged) return null;
  return (
    <div
      className={
        "pf-project-root-drop" +
        (moves.drop?.kind === "root" ? " pf-project-drop-into" : "")
      }
      data-project-root-drop-target=""
      onDragOver={(e) => {
        if (moves.busy) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        moves.highlight({ kind: "root", id: "root", groupId: null });
      }}
      onDrop={(e) => {
        if (!moves.accept(e)) return;
        e.preventDefault();
        e.stopPropagation();
        void moves.move(moves.dragged!, null, null);
      }}
      onDragLeave={() => {
        if (moves.drop?.kind === "root") moves.highlight(null);
      }}
    >
      <Icon name="Folder" />
      {t("Вне групп")}
    </div>
  );
}

/** Keyboard/touch alternative to dragging: select a group or move one row. */
export function ProjectMoveMenu({ projectId }: { projectId: string }) {
  const moves = useContext(Context);
  if (!moves) return null;
  const groupId = moves.groupOf(projectId);
  const siblings = moves.siblings(projectId);
  const at = siblings.indexOf(projectId);
  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger disabled={moves.busy}>
          <Icon name="MoveTo" />
          {t("Переместить в группу…")}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem
            disabled={moves.busy || groupId === null}
            onSelect={() => void moves.move(projectId, null)}
          >
            <Icon name="Folder" />
            {t("Вне групп")}
          </DropdownMenuItem>
          {moves.groups.map((g) => (
            <DropdownMenuItem
              key={g.id}
              disabled={moves.busy || g.id === groupId}
              onSelect={() => void moves.move(projectId, g.id)}
            >
              <Icon name={g.id === groupId ? "Check" : "Layers"} />
              {g.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuItem
        disabled={moves.busy || at <= 0}
        onSelect={() => void moves.move(projectId, groupId, siblings[at - 1])}
      >
        <Icon name="ChevronRight" className="-rotate-90" />
        {t("Выше")}
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={moves.busy || at < 0 || at === siblings.length - 1}
        onSelect={() =>
          void moves.move(projectId, groupId, siblings[at + 2] ?? null)
        }
      >
        <Icon name="ChevronDown" />
        {t("Ниже")}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
    </>
  );
}
