import { readFileSync, writeFileSync } from "node:fs";

const ids = ["zeus", "neptune", "hermes", "athena", "hephaestus", "prometheus"];
const data = Object.fromEntries(
  ids.map((id) => [
    id,
    "data:image/png;base64," +
      readFileSync(
        new URL(`../assets/gods/${id}.png`, import.meta.url),
      ).toString("base64"),
  ]),
);
writeFileSync(
  new URL("../assets/gods/avatars.json", import.meta.url),
  JSON.stringify(data, null, 2) + "\n",
);
console.log("Embedded six god portrait avatars.");
