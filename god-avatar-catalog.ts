export const GOD_AVATAR_IDS = [
  "zeus",
  "neptune",
  "hermes",
  "athena",
  "hephaestus",
  "prometheus",
] as const;
export type GodAvatarId = (typeof GOD_AVATAR_IDS)[number];
export const GOD_AVATAR_NAMES = {
  zeus: "Зевс",
  neptune: "Нептун",
  hermes: "Гермес",
  athena: "Афина",
  hephaestus: "Гефест",
  prometheus: "Прометей",
} as const;
export function godAvatarId(icon: string): GodAvatarId | undefined {
  return GOD_AVATAR_IDS.find((id) => icon === `avatar:${id}`);
}
