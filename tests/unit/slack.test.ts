import { describe, expect, it } from "vitest";
import { extractApiToken, normalizeTeam } from "../../src/lib/slack";

describe("normalizeTeam", () => {
  it.each([
    ["acme", "acme"],
    ["  Acme ", "acme"],
    ["acme.slack.com", "acme"],
    ["https://acme-corp.slack.com/customize/emoji", "acme-corp"],
    ["acme.enterprise", "acme.enterprise"],
  ])("reads %j as %j", (input, team) => {
    expect(normalizeTeam(input)).toBe(team);
  });

  it.each(["", "my team", "-acme", "acme!", "https://"])("rejects %j", (input) => {
    expect(normalizeTeam(input)).toBeNull();
  });
});

describe("extractApiToken", () => {
  it.each([
    ['{"api_token":"xoxc-123-abc_DEF"}', "xoxc-123-abc_DEF"],
    ["boot_data = { api_token: 'xoxs-9' }", "xoxs-9"],
    ['"api_token" : "xoxc-1"', "xoxc-1"],
  ])("finds the token in %j", (html, token) => {
    expect(extractApiToken(html)).toBe(token);
  });

  it("returns null for a page without a session", () => {
    expect(extractApiToken("<html>Sign in to Acme</html>")).toBeNull();
  });
});
