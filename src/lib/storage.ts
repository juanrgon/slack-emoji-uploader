import { normalizeTeam } from "./slack";

const TEAMS_KEY = "teamDomains";
/** Where versions before 1.3.0 kept their single workspace. */
const LEGACY_TEAM_KEY = "team_domain";
const PENDING_PREFIX = "pending:";

/** An image someone asked to add, handed from the service worker to the "add emoji" window. */
export interface PendingEmoji {
  imageUrl: string;
  /** Workspaces to tick by default. */
  teams: string[];
  suggestedName: string;
}

function toTeams(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const teams = value.flatMap((item) => (typeof item === "string" ? (normalizeTeam(item) ?? []) : []));
  return [...new Set(teams)];
}

/** The Slack workspaces saved on the options page. Synced across the user's browsers. */
export async function getTeams(): Promise<string[]> {
  const stored = await chrome.storage.sync.get(TEAMS_KEY);
  return toTeams(stored[TEAMS_KEY]);
}

export async function setTeams(teams: string[]): Promise<void> {
  await chrome.storage.sync.set({ [TEAMS_KEY]: toTeams(teams) });
}

/** Calls `listener` whenever the saved workspaces change, including changes synced from another browser. */
export function onTeamsChanged(listener: () => void): void {
  chrome.storage.sync.onChanged.addListener((changes) => {
    if (TEAMS_KEY in changes) listener();
  });
}

/** Carries a workspace saved by a pre-1.3.0 version over to the current format. */
export async function migrateLegacyTeam(): Promise<void> {
  const stored = await chrome.storage.sync.get([LEGACY_TEAM_KEY, TEAMS_KEY]);
  const legacy = stored[LEGACY_TEAM_KEY];
  if (typeof legacy === "string" && toTeams(stored[TEAMS_KEY]).length === 0) {
    await setTeams([legacy]);
  }
  await chrome.storage.sync.remove(LEGACY_TEAM_KEY);
}

/**
 * Stashes a request in session storage and returns an id for it. Image URLs
 * can be multi-megabyte data: URLs, which is too much for a query string.
 */
export async function savePending(pending: PendingEmoji): Promise<string> {
  const id = crypto.randomUUID();
  await chrome.storage.session.set({ [PENDING_PREFIX + id]: pending });
  return id;
}

/** Reads a stashed request and removes it. Returns null if it is gone, e.g. after a browser restart. */
export async function takePending(id: string): Promise<PendingEmoji | null> {
  const key = PENDING_PREFIX + id;
  const stored = await chrome.storage.session.get(key);
  await chrome.storage.session.remove(key);
  return (stored[key] as PendingEmoji | undefined) ?? null;
}
