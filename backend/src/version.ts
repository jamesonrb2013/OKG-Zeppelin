import { readFileSync } from "node:fs";

// The repository root package.json is the single source of truth for the running bot version.
// This path resolves from backend/dist/version.js in the production image.
const packageJsonUrl = new URL("../../package.json", import.meta.url);
const changelogUrl = new URL("../../CHANGELOG.md", import.meta.url);

const packageJson = JSON.parse(readFileSync(packageJsonUrl, "utf8")) as { version?: unknown };

if (typeof packageJson.version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(packageJson.version)) {
  throw new Error("The root package.json does not contain a valid semantic version.");
}

export const BOT_VERSION = packageJson.version;

export function getReleaseNotes(version: string): string {
  const changelog = readFileSync(changelogUrl, "utf8");
  const lines = changelog.split(/\r?\n/);
  const escapedVersion = version.replaceAll(".", "\\.");
  const heading = new RegExp("^##\\s+\\[?" + escapedVersion + "\\]?\\s*$");
  const start = lines.findIndex((line) => heading.test(line));

  if (start === -1) return "";

  const nextSection = lines.findIndex((line, index) => index > start && /^#{1,2}\s+/.test(line));
  return lines.slice(start + 1, nextSection === -1 ? undefined : nextSection).join("\n").trim();
}
