import type {
  ProviderDriverKind,
  ProviderInstanceConfig,
  ProviderInstanceId,
  ServerSettings,
  UnifiedSettings,
} from "@t3tools/contracts";
import { DEFAULT_UNIFIED_SETTINGS } from "@t3tools/contracts/settings";

export interface ProviderModelFavorite {
  readonly provider: ProviderInstanceId;
  readonly model: string;
}

function collapseOtelSignalsUrl(input: {
  readonly tracesUrl: string;
  readonly metricsUrl: string;
}): string | null {
  const tracesSuffix = "/traces";
  const metricsSuffix = "/metrics";
  if (!input.tracesUrl.endsWith(tracesSuffix) || !input.metricsUrl.endsWith(metricsSuffix)) {
    return null;
  }

  const tracesBase = input.tracesUrl.slice(0, -tracesSuffix.length);
  const metricsBase = input.metricsUrl.slice(0, -metricsSuffix.length);
  if (tracesBase !== metricsBase) {
    return null;
  }

  return `${tracesBase}/{traces,metrics}`;
}

export function formatDiagnosticsDescription(input: {
  readonly localTracingEnabled: boolean;
  readonly otlpTracesEnabled: boolean;
  readonly otlpTracesUrl?: string | undefined;
  readonly otlpMetricsEnabled: boolean;
  readonly otlpMetricsUrl?: string | undefined;
}): string {
  const mode = input.localTracingEnabled ? "Local trace file" : "Terminal logs only";
  const tracesUrl = input.otlpTracesEnabled ? input.otlpTracesUrl : undefined;
  const metricsUrl = input.otlpMetricsEnabled ? input.otlpMetricsUrl : undefined;

  if (tracesUrl && metricsUrl) {
    const collapsedUrl = collapseOtelSignalsUrl({ tracesUrl, metricsUrl });
    return collapsedUrl
      ? `${mode}. Exporting OTEL to ${collapsedUrl}.`
      : `${mode}. Exporting OTEL traces to ${tracesUrl} and metrics to ${metricsUrl}.`;
  }

  if (tracesUrl) {
    return `${mode}. Exporting OTEL traces to ${tracesUrl}.`;
  }

  if (metricsUrl) {
    return `${mode}. Exporting OTEL metrics to ${metricsUrl}.`;
  }

  return `${mode}.`;
}

export function buildProviderInstanceUpdatePatch(input: {
  readonly settings: Pick<ServerSettings, "providers" | "providerInstances">;
  readonly instanceId: ProviderInstanceId;
  readonly instance: ProviderInstanceConfig;
  readonly driver: ProviderDriverKind;
  readonly isDefault: boolean;
  readonly textGenerationModelSelection?:
    | ServerSettings["textGenerationModelSelection"]
    | undefined;
}): Partial<UnifiedSettings> {
  type LegacyProviderSettings = ServerSettings["providers"][keyof ServerSettings["providers"]];
  const legacyProviderDefaults = DEFAULT_UNIFIED_SETTINGS.providers as Record<
    string,
    LegacyProviderSettings | undefined
  >;
  const legacyProviderDefault = input.isDefault ? legacyProviderDefaults[input.driver] : undefined;
  return {
    ...(legacyProviderDefault !== undefined
      ? {
          providers: {
            ...input.settings.providers,
            [input.driver]: legacyProviderDefault,
          } as ServerSettings["providers"],
        }
      : {}),
    providerInstances: {
      ...input.settings.providerInstances,
      [input.instanceId]: input.instance,
    },
    ...(input.textGenerationModelSelection !== undefined
      ? { textGenerationModelSelection: input.textGenerationModelSelection }
      : {}),
  };
}

function withoutProviderInstanceKey<V>(
  record: Readonly<Record<ProviderInstanceId, V>> | undefined,
  key: ProviderInstanceId,
): Record<ProviderInstanceId, V> {
  const next = { ...record } as Record<ProviderInstanceId, V>;
  delete next[key];
  return next;
}

function cleanModelSlugList(slugs: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const slug of slugs) {
    const trimmedSlug = slug.trim();
    if (trimmedSlug.length === 0 || seen.has(trimmedSlug)) {
      continue;
    }
    seen.add(trimmedSlug);
    cleaned.push(trimmedSlug);
  }
  return cleaned;
}

export function buildProviderInstanceModelsUpdatePatch(input: {
  readonly settings: Pick<
    UnifiedSettings,
    "providers" | "providerInstances" | "providerModelPreferences" | "favorites"
  >;
  readonly instanceId: ProviderInstanceId;
  readonly instance: ProviderInstanceConfig;
  readonly driver: ProviderDriverKind;
  readonly isDefault: boolean;
  readonly hiddenModels: ReadonlyArray<string>;
  readonly modelOrder: ReadonlyArray<string>;
  readonly favoriteModels: ReadonlyArray<string>;
}): Partial<UnifiedSettings> {
  const hiddenModels = cleanModelSlugList(input.hiddenModels);
  const modelOrder = cleanModelSlugList(input.modelOrder);
  const favoriteModels = cleanModelSlugList(input.favoriteModels);
  const rest = withoutProviderInstanceKey(
    input.settings.providerModelPreferences,
    input.instanceId,
  );

  return {
    ...buildProviderInstanceUpdatePatch({
      settings: input.settings,
      instanceId: input.instanceId,
      instance: input.instance,
      driver: input.driver,
      isDefault: input.isDefault,
    }),
    providerModelPreferences:
      hiddenModels.length === 0 && modelOrder.length === 0
        ? rest
        : {
            ...rest,
            [input.instanceId]: {
              hiddenModels,
              modelOrder,
            },
          },
    favorites: mergeProviderInstanceFavorites({
      favorites: input.settings.favorites ?? [],
      instanceId: input.instanceId,
      nextFavoriteModels: favoriteModels,
    }),
  };
}

export function mergeProviderInstanceFavorites(input: {
  readonly favorites: ReadonlyArray<ProviderModelFavorite>;
  readonly instanceId: ProviderInstanceId;
  readonly nextFavoriteModels: ReadonlyArray<string>;
}): ProviderModelFavorite[] {
  const nextFavoriteModelSet = new Set(input.nextFavoriteModels);
  const seenInstanceModels = new Set<string>();
  const merged: ProviderModelFavorite[] = [];

  for (const favorite of input.favorites) {
    if (favorite.provider !== input.instanceId) {
      merged.push(favorite);
      continue;
    }
    if (!nextFavoriteModelSet.has(favorite.model) || seenInstanceModels.has(favorite.model)) {
      continue;
    }
    merged.push(favorite);
    seenInstanceModels.add(favorite.model);
  }

  for (const model of input.nextFavoriteModels) {
    if (seenInstanceModels.has(model)) {
      continue;
    }
    merged.push({ provider: input.instanceId, model });
    seenInstanceModels.add(model);
  }

  return merged;
}
