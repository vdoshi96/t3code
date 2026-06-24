import {
  ProviderDriverKind,
  ProviderInstanceId,
  type ServerProviderModel,
} from "@t3tools/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { ProviderModelsSection } from "./ProviderModelsSection";

function model(input: {
  readonly slug: string;
  readonly name: string;
  readonly isCustom?: boolean;
}): ServerProviderModel {
  return {
    slug: input.slug,
    name: input.name,
    isCustom: input.isCustom ?? false,
    capabilities: null,
  };
}

describe("ProviderModelsSection", () => {
  it("renders hidden custom models with show and remove controls", () => {
    const markup = renderToStaticMarkup(
      <ProviderModelsSection
        instanceId={ProviderInstanceId.make("codex")}
        driverKind={ProviderDriverKind.make("codex")}
        models={[
          model({ slug: "gpt-5-codex", name: "GPT-5 Codex" }),
          model({ slug: "custom-codex", name: "Custom Codex", isCustom: true }),
        ]}
        customModels={["custom-codex"]}
        hiddenModels={["custom-codex"]}
        favoriteModels={[]}
        modelOrder={[]}
        onChange={() => {}}
        onCustomModelRemove={() => {}}
        onHiddenModelsChange={() => {}}
        onFavoriteModelsChange={() => {}}
        onModelOrderChange={() => {}}
      />,
    );

    expect(markup).toContain("Custom Codex");
    expect(markup).toContain("hidden");
    expect(markup).toContain("custom");
    expect(markup).toContain('aria-label="Show Custom Codex"');
    expect(markup).toContain('aria-label="Remove custom-codex"');
  });
});
