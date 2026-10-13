import { z } from "zod";

export const PROJECT_GROUPS_KEY = "project_groups";
export const projectGroupSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(120),
    projectIds: z.array(z.string().min(1)).max(1000),
  })
  .strict();
export type ProjectGroup = z.infer<typeof projectGroupSchema>;
export const projectGroupSaveSchema = projectGroupSchema
  .omit({ id: true })
  .extend({
    id: z.string().min(1).optional(),
  })
  .strict();
export const projectGroupPlaceSchema = z
  .object({
    projectId: z.string().min(1),
    groupId: z.string().min(1).nullable(),
  })
  .strict();
export const projectGroupRemoveSchema = z
  .object({ id: z.string().min(1) })
  .strict();
const stateSchema = z
  .object({
    version: z.literal(1),
    groups: z.array(projectGroupSchema),
  })
  .strict();

/** Only sidebar metadata: BB project ids, sources, chats and rules never change. */
export function makeProjectGroups(store: {
  read(): string | undefined;
  write(data: string): void;
  newId(): string;
}) {
  const read = (): ProjectGroup[] => {
    const raw = store.read();
    if (raw === undefined) return [];
    try {
      const { groups } = stateSchema.parse(JSON.parse(raw));
      const ids = new Set<string>();
      const projects = new Set<string>();
      for (const g of groups) {
        if (ids.has(g.id)) throw new Error("Duplicate group id.");
        ids.add(g.id);
        for (const id of g.projectIds) {
          if (projects.has(id))
            throw new Error("Duplicate project membership.");
          projects.add(id);
        }
      }
      return groups;
    } catch {
      throw new Error(
        "Project groups data is invalid. Restore a plugin backup.",
      );
    }
  };
  const write = (groups: ProjectGroup[]) =>
    store.write(JSON.stringify({ version: 1, groups }));
  return {
    list: read,
    save(input: z.input<typeof projectGroupSaveSchema>) {
      const value = projectGroupSaveSchema.parse(input);
      if (new Set(value.projectIds).size !== value.projectIds.length)
        throw new Error("A project can appear only once in a group.");
      const groups = read();
      if (value.id && !groups.some((g) => g.id === value.id))
        throw new Error("Project group not found.");
      if (
        groups.some(
          (g) =>
            g.id !== value.id &&
            g.name.toLowerCase() === value.name.toLowerCase(),
        )
      )
        throw new Error("A project group with this name already exists.");
      const group = { ...value, id: value.id ?? store.newId() };
      const selected = new Set(value.projectIds);
      const next = groups.map((g) =>
        g.id === group.id
          ? group
          : {
              ...g,
              projectIds: g.projectIds.filter((id) => !selected.has(id)),
            },
      );
      if (!value.id) next.push(group);
      write(next);
      return group;
    },
    place(input: z.input<typeof projectGroupPlaceSchema>) {
      const { projectId, groupId } = projectGroupPlaceSchema.parse(input);
      const groups = read();
      if (groupId && !groups.some((g) => g.id === groupId))
        throw new Error("Project group not found.");
      write(
        groups.map((g) => ({
          ...g,
          projectIds:
            g.id === groupId
              ? [...g.projectIds.filter((id) => id !== projectId), projectId]
              : g.projectIds.filter((id) => id !== projectId),
        })),
      );
    },
    remove(input: z.input<typeof projectGroupRemoveSchema>) {
      const { id } = projectGroupRemoveSchema.parse(input);
      const groups = read();
      if (!groups.some((g) => g.id === id))
        throw new Error("Project group not found.");
      write(groups.filter((g) => g.id !== id));
    },
  };
}
