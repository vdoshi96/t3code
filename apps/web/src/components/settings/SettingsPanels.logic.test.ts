import {
  DEFAULT_SERVER_SETTINGS,
  DEFAULT_UNIFIED_SETTINGS,
  ProviderDriverKind,
  ProviderInstanceId,
  type ProviderInstanceConfig,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import {
  buildProviderInstanceModelsUpdatePatch,
  buildProviderInstanceUpdatePatch,
  formatDiagnosticsDescription,
  mergeProviderInstanceFavorites,
} from "./SettingsPanels.logic";

describe("formatDiagnosticsDescription", () => {
  it("collapses trace and metric URLs that share the same OTEL base path", () => {
    expect(
      formatDiagnosticsDescription({
        localTracingEnabled: true,
        otlpTracesEnabled: true,
        otlpTracesUrl: "http://localhost:4318/v1/traces",
        otlpMetricsEnabled: true,
        otlpMetricsUrl: "http://localhost:4318/v1/metrics",
      }),
    ).toBe("Local trace file. Exporting OTEL to http://localhost:4318/v1/{traces,metrics}.");
  });

  it("keeps separate trace and metric URLs when their base paths differ", () => {
    expect(
      formatDiagnosticsDescription({
        localTracingEnabled: true,
        otlpTracesEnabled: true,
        otlpTracesUrl: "http://localhost:4318/v1/traces",
        otlpMetricsEnabled: true,
        otlpMetricsUrl: "http://localhost:9000/v1/metrics",
      }),
    ).toBe(
      "Local trace file. Exporting OTEL traces to http://localhost:4318/v1/traces and metrics to http://localhost:9000/v1/metrics.",
    );
  });

  it("omits OTEL text when no exporter is enabled", () => {
    expect(
      formatDiagnosticsDescription({
        localTracingEnabled: true,
        otlpTracesEnabled: false,
        otlpMetricsEnabled: false,
      }),
    ).toBe("Local trace file.");
  });
});

describe("buildProviderInstanceUpdatePatch", () => {
  it("promotes an edited default provider into providerInstances and resets the legacy provider", () => {
    const instanceId = ProviderInstanceId.make("codex");
    const nextInstance = {
      driver: ProviderDriverKind.make("codex"),
      enabled: true,
      config: {
        binaryPath: "/opt/t3/codex",
      },
    } satisfies ProviderInstanceConfig;

    const patch = buildProviderInstanceUpdatePatch({
      settings: {
        ...DEFAULT_SERVER_SETTINGS,
        providers: {
          ...DEFAULT_SERVER_SETTINGS.providers,
          codex: {
            ...DEFAULT_SERVER_SETTINGS.providers.codex,
            binaryPath: "/legacy/codex",
          },
        },
      },
      instanceId,
      instance: nextInstance,
      driver: ProviderDriverKind.make("codex"),
      isDefault: true,
    });

    expect(patch.providerInstances?.[instanceId]).toEqual(nextInstance);
    expect(patch.providers?.codex).toEqual(DEFAULT_SERVER_SETTINGS.providers.codex);
  });

  it("updates custom instances without touching legacy provider settings", () => {
    const instanceId = ProviderInstanceId.make("codex_personal");
    const nextInstance = {
      driver: ProviderDriverKind.make("codex"),
      enabled: true,
      config: {
        homePath: "/Users/example/.codex-personal",
      },
    } satisfies ProviderInstanceConfig;

    const patch = buildProviderInstanceUpdatePatch({
      settings: DEFAULT_SERVER_SETTINGS,
      instanceId,
      instance: nextInstance,
      driver: ProviderDriverKind.make("codex"),
      isDefault: false,
    });

    expect(patch.providerInstances?.[instanceId]).toEqual(nextInstance);
    expect(patch.providers).toBeUndefined();
  });
});

describe("mergeProviderInstanceFavorites", () => {
  it("preserves cross-provider favorite order and appends newly favorited models", () => {
    const codex = ProviderInstanceId.make("codex");
    const claude = ProviderInstanceId.make("claudeAgent");
    const grok = ProviderInstanceId.make("grok");

    expect(
      mergeProviderInstanceFavorites({
        favorites: [
          { provider: codex, model: "gpt-5.5" },
          { provider: claude, model: "claude-opus-4-6" },
          { provider: codex, model: "gpt-5.4-mini" },
          { provider: grok, model: "grok-4" },
        ],
        instanceId: codex,
        nextFavoriteModels: ["gpt-5.4-mini", "crest-alpha"],
      }),
    ).toEqual([
      { provider: claude, model: "claude-opus-4-6" },
      { provider: codex, model: "gpt-5.4-mini" },
      { provider: grok, model: "grok-4" },
      { provider: codex, model: "crest-alpha" },
    ]);
  });
});

describe("buildProviderInstanceModelsUpdatePatch", () => {
  it("removes a custom model from config, preferences, and favorites in one patch", () => {
    const instanceId = ProviderInstanceId.make("codex");
    const nextInstance = {
      driver: ProviderDriverKind.make("codex"),
      enabled: true,
      config: {
        customModels: ["custom-beta"],
      },
    } satisfies ProviderInstanceConfig;

    const patch = buildProviderInstanceModelsUpdatePatch({
      settings: {
        ...DEFAULT_UNIFIED_SETTINGS,
        providerInstances: {
          [instanceId]: {
            driver: ProviderDriverKind.make("codex"),
            enabled: true,
            config: {
              customModels: ["custom-alpha", "custom-beta"],
            },
          },
        },
        providerModelPreferences: {
          [instanceId]: {
            hiddenModels: ["custom-alpha", "custom-beta"],
            modelOrder: ["custom-beta", "custom-alpha"],
          },
        },
        favorites: [
          { provider: instanceId, model: "custom-alpha" },
          { provider: ProviderInstanceId.make("claudeAgent"), model: "claude-opus-4-6" },
          { provider: instanceId, model: "custom-beta" },
        ],
      },
      instanceId,
      instance: nextInstance,
      driver: ProviderDriverKind.make("codex"),
      isDefault: true,
      hiddenModels: ["custom-beta"],
      modelOrder: ["custom-beta"],
      favoriteModels: ["custom-beta"],
    });

    expect(patch.providerInstances?.[instanceId]).toEqual(nextInstance);
    expect(patch.providerModelPreferences?.[instanceId]).toEqual({
      hiddenModels: ["custom-beta"],
      modelOrder: ["custom-beta"],
    });
    expect(patch.favorites).toEqual([
      { provider: ProviderInstanceId.make("claudeAgent"), model: "claude-opus-4-6" },
      { provider: instanceId, model: "custom-beta" },
    ]);
  });
});
