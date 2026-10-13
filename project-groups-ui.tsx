import { isValidElement, useState, type ReactNode } from "react";
import {
  ProjectMoveProvider,
  ProjectMoveEntry,
  ProjectGroupDropTarget,
  ProjectTopLevelDropTarget,
} from "./project-moves-ui";
import { useRpc } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "./server";
import type { ProjectGroup } from "./project-groups";
import { t } from "./i18n";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Icon } from "./components/ui/icon";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./components/ui/dropdown-menu";

const collapseKey = "project-folders:project-groups-collapsed";
function readCollapsed(): Record<string, boolean> {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(collapseKey) ?? "{}",
    );
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(([, v]) => v === true),
    );
  } catch {
    return {};
  }
}

/** Wrap existing project rows without changing their BB identity or actions. */
export function GroupedProjects({
  groups,
  projects,
  entries,
  refresh,
  unreadProjects = [],
  onManualOrder,
}: {
  groups: ProjectGroup[];
  projects: { id: string; name: string }[];
  entries: { projectId: string; element: ReactNode }[];
  refresh(): void;
  unreadProjects?: string[];
  onManualOrder?(): Promise<void>;
}) {
  const rpc = useRpc<typeof rpcContract>();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [editing, setEditing] = useState<ProjectGroup | "new" | null>(null);
  const [removing, setRemoving] = useState<ProjectGroup | null>(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const open = (group: ProjectGroup | "new") => {
    setEditing(group);
    setName(group === "new" ? "" : group.name);
    const available = new Set(projects.map((p) => p.id));
    setSelected(
      group === "new" ? [] : group.projectIds.filter((id) => available.has(id)),
    );
    setError("");
  };
  const save = async () => {
    if (!editing || busy) return;
    setBusy(true);
    setError("");
    try {
      await rpc.call("project_group_save", {
        ...(editing === "new" ? {} : { id: editing.id }),
        name,
        projectIds: selected,
      });
      setEditing(null);
      refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!removing || busy) return;
    setBusy(true);
    setError("");
    try {
      await rpc.call("project_group_remove", { id: removing.id });
      setRemoving(null);
      refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const memberships = new Set(groups.flatMap((g) => g.projectIds));
  const renderEntry = (e: (typeof entries)[number], index: number) => (
    <ProjectMoveEntry
      key={
        isValidElement(e.element)
          ? (e.element.key ?? `${e.projectId}:${index}`)
          : `${e.projectId}:${index}`
      }
      projectId={e.projectId}
    >
      {e.element}
    </ProjectMoveEntry>
  );
  return (
    <ProjectMoveProvider
      groups={groups}
      projects={projects}
      visibleIds={entries.map((e) => e.projectId)}
      refresh={refresh}
      onManualOrder={onManualOrder}
      onMoved={(groupId) => {
        if (groupId)
          setCollapsed((old) => {
            const next = { ...old, [groupId]: false };
            try {
              localStorage.setItem(collapseKey, JSON.stringify(next));
            } catch {}
            return next;
          });
      }}
    >
      <Button
        variant="ghost"
        className="mb-2 w-full justify-start"
        onClick={() => open("new")}
      >
        <Icon name="Layers" />
        {t("Новая группа проектов")}
      </Button>
      {groups.map((group) => {
        const members = group.projectIds.flatMap((id) =>
          entries.filter((e) => e.projectId === id),
        );
        const unread = unreadProjects.some((id) =>
          group.projectIds.includes(id),
        );
        return (
          <ProjectGroupDropTarget key={group.id} groupId={group.id}>
            <div
              className="pf-project-group"
              data-project-group-id={group.id}
              key={group.id}
            >
              <div className="pf-heading">
                <button
                  className={"pf-label" + (unread ? " pf-unread" : "")}
                  aria-expanded={!collapsed[group.id]}
                  onClick={() =>
                    setCollapsed((old) => {
                      const next = { ...old, [group.id]: !old[group.id] };
                      try {
                        localStorage.setItem(collapseKey, JSON.stringify(next));
                      } catch {}
                      return next;
                    })
                  }
                >
                  <Icon
                    name={collapsed[group.id] ? "ChevronRight" : "ChevronDown"}
                    className="pf-chevron"
                  />
                  <Icon name="Layers" />
                  <span>{group.name}</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="pf-icon"
                      aria-label={`${t("Действия")}: ${group.name}`}
                    >
                      <Icon name="MoreHorizontal" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => open(group)}>
                      <Icon name="Edit" />
                      {t("Изменить группу")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setRemoving(group);
                        setError("");
                      }}
                    >
                      <Icon name="Layers" />
                      {t("Убрать группу")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {!collapsed[group.id] && (
                <div className="pf-children">{members.map(renderEntry)}</div>
              )}
            </div>
          </ProjectGroupDropTarget>
        );
      })}
      {entries.filter((e) => !memberships.has(e.projectId)).map(renderEntry)}
      <ProjectTopLevelDropTarget />
      <Dialog
        open={editing !== null}
        onOpenChange={(value) => {
          if (!value && !busy) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing === "new"
                ? t("Новая группа проектов")
                : t("Изменить группу")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "Объединяет существующие проекты в дереве. Чаты и рабочие папки остаются на своих местах.",
              )}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label className="pf-project-group-name">
              {t("Название группы")}
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                disabled={busy}
                autoFocus
              />
            </label>
            <fieldset className="pf-project-group-options" disabled={busy}>
              <legend>{t("Проекты в группе")}</legend>
              {projects.map((project) => {
                const other = groups.find(
                  (g) =>
                    g.id !== (editing === "new" ? null : editing?.id) &&
                    g.projectIds.includes(project.id),
                );
                return (
                  <label key={project.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(project.id)}
                      onChange={(e) =>
                        setSelected((old) =>
                          e.target.checked
                            ? [...old, project.id]
                            : old.filter((id) => id !== project.id),
                        )
                      }
                    />
                    <span>{project.name}</span>
                    {other && (
                      <small>
                        {t("В группе:")} {other.name}
                      </small>
                    )}
                  </label>
                );
              })}
            </fieldset>
            {error && (
              <p role="alert" className="pf-error">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setEditing(null)}
              >
                {t("Отмена")}
              </Button>
              <Button type="submit" disabled={busy || !name.trim()}>
                {editing === "new" ? t("Создать") : t("Сохранить")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={removing !== null}
        onOpenChange={(value) => {
          if (!value && !busy) setRemoving(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("Убрать группу")} «{removing?.name}»
            </DialogTitle>
            <DialogDescription>
              {t(
                "Проекты вернутся на верхний уровень. Чаты и файлы сохранятся.",
              )}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="pf-error">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setRemoving(null)}
            >
              {t("Отмена")}
            </Button>
            <Button disabled={busy} onClick={() => void remove()}>
              {t("Убрать группу")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProjectMoveProvider>
  );
}
