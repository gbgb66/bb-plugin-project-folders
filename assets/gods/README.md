# Graphic god avatars

Active avatars are compact vector emblems drawn for a 24px sidebar: Zeus’s lightning, Neptune’s trident, Hermes’s winged helmet, Athena’s owl, Hephaestus’s hammer and Prometheus’s flame. Each uses one large high-contrast symbol on a distinct solid background, without text or tiny portrait details. SVGs stay crisp at any display scale.

The six `*.svg` files are embedded as data URLs in `avatars.json`. Run `node scripts/embed-god-avatars.mjs` after changing a symbol, then build. Stored choices remain `avatar:<id>`, so existing projects pick up new symbols automatically. Earlier generated PNG portraits remain as source references; the app uses the SVG emblems.
