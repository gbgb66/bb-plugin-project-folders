import images from "./assets/gods/avatars.json";
import {
  GOD_AVATAR_IDS,
  GOD_AVATAR_NAMES,
  godAvatarId,
} from "./god-avatar-catalog";

/** Embedded vector emblems work on every device without an external image host. */
export const GOD_AVATARS = GOD_AVATAR_IDS.map((id) => ({
  id,
  name: GOD_AVATAR_NAMES[id],
  src: images[id],
}));
export function godAvatar(icon: string) {
  const id = godAvatarId(icon);
  return id ? GOD_AVATARS.find((avatar) => avatar.id === id) : undefined;
}
