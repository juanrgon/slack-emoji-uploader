// Options page: the list of Slack workspaces emoji can be added to.

import { checkTeam, normalizeTeam, teamUrl, type TeamStatus } from "./lib/slack";
import { getTeams, setTeams } from "./lib/storage";

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

const form = byId<HTMLFormElement>("form");
const teamList = byId<HTMLUListElement>("teams");
const addButton = byId<HTMLButtonElement>("add-team");
const saveStatus = byId<HTMLSpanElement>("save-status");
const rowTemplate = byId<HTMLTemplateElement>("team-row");

type RowState = "" | "ok" | "warning" | "invalid";

const STATUS_TEXT: Record<TeamStatus, string> = {
  "signed-in": "Signed in",
  "signed-out": "Not signed in. Sign in to Slack in this browser to add emoji.",
  unreachable: "Couldn't open this workspace. Check the name, or sign in to Slack.",
};

const rows: TeamRow[] = [];

function addRow(team = ""): TeamRow {
  const row = new TeamRow(team);
  rows.push(row);
  return row;
}

class TeamRow {
  private readonly element: HTMLLIElement;
  private readonly input: HTMLInputElement;
  private readonly status: HTMLElement;
  private readonly signIn: HTMLButtonElement;

  constructor(team: string) {
    const fragment = rowTemplate.content.cloneNode(true) as DocumentFragment;
    this.element = fragment.querySelector("li")!;
    this.input = fragment.querySelector("input")!;
    this.status = fragment.querySelector(".team-status")!;
    this.signIn = fragment.querySelector(".team-sign-in")!;
    this.input.value = team;
    this.input.addEventListener("input", () => this.show("", ""));
    this.signIn.addEventListener("click", () => {
      const current = normalizeTeam(this.input.value);
      if (current) void chrome.tabs.create({ url: teamUrl(current) });
    });
    fragment.querySelector(".remove")!.addEventListener("click", () => this.remove());
    teamList.append(fragment);
  }

  get value(): string {
    return this.input.value.trim();
  }

  set value(team: string) {
    this.input.value = team;
  }

  focus(): void {
    this.input.focus();
  }

  show(state: RowState, text: string, offerSignIn = false): void {
    this.element.className = `team ${state}`;
    this.status.textContent = text;
    this.signIn.hidden = !offerSignIn;
  }

  /** Asks Slack whether this workspace exists and is signed in, and shows the answer. */
  async check(team: string): Promise<void> {
    this.show("", "Checking…");
    try {
      const status = await checkTeam(team);
      this.show(status === "signed-in" ? "ok" : "warning", STATUS_TEXT[status], status !== "signed-in");
    } catch {
      this.show("warning", "Couldn't reach Slack to check this workspace.");
    }
  }

  private remove(): void {
    this.element.remove();
    rows.splice(rows.indexOf(this), 1);
    if (rows.length === 0) addRow();
  }
}

async function save(): Promise<void> {
  const teams: string[] = [];
  const saved: Array<{ row: TeamRow; team: string }> = [];
  let invalid = false;

  for (const row of rows) {
    if (row.value === "") {
      row.show("", "");
      continue;
    }
    const team = normalizeTeam(row.value);
    if (!team) {
      row.show("invalid", "That doesn't look like a workspace address.");
      invalid = true;
    } else if (teams.includes(team)) {
      row.show("", "Already listed above.");
    } else {
      row.value = team;
      teams.push(team);
      saved.push({ row, team });
    }
  }

  if (invalid) {
    saveStatus.textContent = "Not saved. Fix the workspace marked above first.";
    return;
  }

  await setTeams(teams);
  saveStatus.textContent = "Saved";
  await Promise.all(saved.map(({ row, team }) => row.check(team)));
}

async function main(): Promise<void> {
  const teams = await getTeams();
  for (const team of teams) addRow(team);
  if (teams.length === 0) addRow().focus();

  addButton.addEventListener("click", () => addRow().focus());
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void save();
  });
}

void main();
