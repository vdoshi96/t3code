import { describe, expect, it } from "vite-plus/test";
import { ProviderInstanceId } from "@t3tools/contracts";

import {
  moveProviderModelFavorite,
  providerModelFavoriteKey,
  providerModelKey,
  sortModelsForProviderInstance,
  sortProviderModelItems,
} from "./modelOrdering";

const CODEX_WORK_ID = ProviderInstanceId.make("codex_work");
const CLAUDE_ID = ProviderInstanceId.make("claudeAgent");

describe("model ordering", () => {
  it("groups favorites first while preserving provider model order inside each group", () => {
    const models = [
      { slug: "gpt-5.5" },
      { slug: "gpt-5.4-mini" },
      { slug: "crest-alpha" },
      { slug: "gpt-5.3-codex" },
    ];

    expect(
      sortModelsForProviderInstance(models, {
        favoriteModels: ["gpt-5.5", "gpt-5.4-mini", "crest-alpha"],
        groupFavorites: true,
        modelOrder: ["gpt-5.4-mini", "gpt-5.5", "crest-alpha", "gpt-5.3-codex"],
      }).map((model) => model.slug),
    ).toEqual(["gpt-5.4-mini", "gpt-5.5", "crest-alpha", "gpt-5.3-codex"]);
  });

  it("sorts the favorites view by persisted favorite order", () => {
    const items = [
      { instanceId: CODEX_WORK_ID, slug: "gpt-5.4-mini" },
      { instanceId: CODEX_WORK_ID, slug: "gpt-5.5" },
      { instanceId: CODEX_WORK_ID, slug: "crest-alpha" },
      { instanceId: CLAUDE_ID, slug: "claude-opus-4-6" },
    ];
    const favoriteKeys = [
      providerModelKey(CODEX_WORK_ID, "gpt-5.5"),
      providerModelKey(CLAUDE_ID, "claude-opus-4-6"),
      providerModelKey(CODEX_WORK_ID, "gpt-5.4-mini"),
      providerModelKey(CODEX_WORK_ID, "crest-alpha"),
    ];

    expect(
      sortProviderModelItems(items, {
        favoriteModelKeys: favoriteKeys,
        modelKeyOrder: favoriteKeys,
        instanceOrder: [CODEX_WORK_ID, CLAUDE_ID],
      }).map((item) => item.slug),
    ).toEqual(["gpt-5.5", "claude-opus-4-6", "gpt-5.4-mini", "crest-alpha"]);
  });

  it("moves favorites by visible favorite order while preserving hidden entries", () => {
    const favorites = [
      { provider: CODEX_WORK_ID, model: "gpt-5.5" },
      { provider: ProviderInstanceId.make("grok"), model: "grok-4" },
      { provider: CLAUDE_ID, model: "claude-opus-4-6" },
      { provider: CODEX_WORK_ID, model: "gpt-5.4-mini" },
    ];

    const next = moveProviderModelFavorite(
      favorites,
      providerModelKey(CLAUDE_ID, "claude-opus-4-6"),
      -1,
      [
        providerModelKey(CODEX_WORK_ID, "gpt-5.5"),
        providerModelKey(CLAUDE_ID, "claude-opus-4-6"),
        providerModelKey(CODEX_WORK_ID, "gpt-5.4-mini"),
      ],
    );

    expect(next.map(providerModelFavoriteKey)).toEqual([
      providerModelKey(CLAUDE_ID, "claude-opus-4-6"),
      providerModelKey(ProviderInstanceId.make("grok"), "grok-4"),
      providerModelKey(CODEX_WORK_ID, "gpt-5.5"),
      providerModelKey(CODEX_WORK_ID, "gpt-5.4-mini"),
    ]);
  });
});
