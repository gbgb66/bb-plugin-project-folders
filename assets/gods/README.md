# God portrait avatars

Six original portraits generated with the built-in `image_gen` tool for this fork: Zeus, Neptune, Hermes, Athena, Hephaestus and Prometheus. Source PNGs are 128×128; the interface crops them to a 24px circle. The portraits are painterly illustrations with large faces, classical clothing, recognizable mythological attributes, distinct muted backgrounds, and no text or watermark.

`avatars.json` embeds the PNGs as data URLs so the sidebar works on local and remote devices without an external image service. After changing a PNG, run `node scripts/embed-god-avatars.mjs` before building. Choices are saved as `avatar:<id>` in item styles, not as arbitrary image URLs.
