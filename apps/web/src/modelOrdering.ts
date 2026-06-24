import type { ProviderInstanceId } from "@t3tools/contracts";
import * as Arr from "effect/Array";
import * as Order from "effect/Order";

export interface ModelSlugItem {
  readonly slug: string;
}

export interface ProviderModelItem extends ModelSlugItem {
  readonly instanceId: ProviderInstanceId;
}

export interface ProviderModelFavorite {
  readonly provider: ProviderInstanceId;
  readonly model: string;
}

export function providerModelKey(instanceId: ProviderInstanceId, slug: string): string {
  return `${instanceId}:${slug}`;
}

export function providerModelFavoriteKey(favorite: ProviderModelFavorite): string {
  return providerModelKey(favorite.provider, favorite.model);
}

function rankByValue(values: ReadonlyArray<string>): ReadonlyMap<string, number> {
  return new Map(Arr.map(values, (value, index) => [value, index] as const));
}

function toSet(
  values: ReadonlySet<string> | ReadonlyArray<string> | undefined,
): ReadonlySet<string> {
  return values instanceof Set ? values : new Set(values ?? []);
}

function byOptionalRank<T>(rank: (item: T) => number | undefined): Order.Order<T> {
  return Order.mapInput(Order.Number, (item: T) => rank(item) ?? Number.POSITIVE_INFINITY);
}

function byTrueFirst<T>(predicate: (item: T) => boolean): Order.Order<T> {
  return Order.mapInput(Order.flip(Order.Boolean), predicate);
}

export function sortModelsForProviderInstance<T extends ModelSlugItem>(
  models: ReadonlyArray<T>,
  options?: {
    readonly modelOrder?: ReadonlyArray<string>;
    readonly favoriteModels?: ReadonlySet<string> | ReadonlyArray<string>;
    readonly groupFavorites?: boolean;
  },
): T[] {
  const modelOrder = options?.modelOrder ?? [];
  const favoriteModels = toSet(options?.favoriteModels);
  const orderBySlug = rankByValue(modelOrder);
  const originalOrder = rankByValue(Arr.map(models, (model) => model.slug));
  const orders: Array<Order.Order<T>> = [
    ...(options?.groupFavorites === true
      ? [byTrueFirst<T>((model) => favoriteModels.has(model.slug))]
      : []),
    byOptionalRank((model) => orderBySlug.get(model.slug)),
    byOptionalRank((model) => originalOrder.get(model.slug)),
  ];

  return Arr.sort(models, Order.combineAll(orders));
}

export function sortProviderModelItems<T extends ProviderModelItem>(
  items: ReadonlyArray<T>,
  options?: {
    readonly favoriteModelKeys?: ReadonlySet<string> | ReadonlyArray<string>;
    readonly groupFavorites?: boolean;
    readonly modelKeyOrder?: ReadonlyArray<string>;
    readonly instanceOrder?: ReadonlyArray<ProviderInstanceId>;
  },
): T[] {
  const favoriteModelKeys = toSet(options?.favoriteModelKeys);
  const modelKeyOrder = rankByValue(options?.modelKeyOrder ?? []);
  const instanceOrder = new Map(
    Arr.map(options?.instanceOrder ?? [], (instanceId, index) => [instanceId, index] as const),
  );
  const originalOrder = rankByValue(
    Arr.map(items, (item) => providerModelKey(item.instanceId, item.slug)),
  );
  const orders: Array<Order.Order<T>> = [
    ...(options?.groupFavorites === true
      ? [
          byTrueFirst<T>((item) =>
            favoriteModelKeys.has(providerModelKey(item.instanceId, item.slug)),
          ),
        ]
      : []),
    byOptionalRank((item) => modelKeyOrder.get(providerModelKey(item.instanceId, item.slug))),
    byOptionalRank((item) => instanceOrder.get(item.instanceId)),
    byOptionalRank((item) => originalOrder.get(providerModelKey(item.instanceId, item.slug))),
  ];

  return Arr.sort(items, Order.combineAll(orders));
}

export function moveProviderModelFavorite(
  favorites: ReadonlyArray<ProviderModelFavorite>,
  modelKey: string,
  direction: -1 | 1,
  visibleModelKeys?: ReadonlyArray<string>,
): ProviderModelFavorite[] {
  const visibleOrder = visibleModelKeys ?? favorites.map(providerModelFavoriteKey);
  const visibleIndex = visibleOrder.indexOf(modelKey);
  const targetVisibleKey = visibleOrder[visibleIndex + direction];
  if (visibleIndex < 0 || targetVisibleKey === undefined) {
    return [...favorites];
  }

  const movingIndex = favorites.findIndex(
    (favorite) => providerModelFavoriteKey(favorite) === modelKey,
  );
  const targetIndex = favorites.findIndex(
    (favorite) => providerModelFavoriteKey(favorite) === targetVisibleKey,
  );
  if (movingIndex < 0 || targetIndex < 0 || movingIndex === targetIndex) {
    return [...favorites];
  }

  const next = [...favorites];
  [next[movingIndex], next[targetIndex]] = [next[targetIndex]!, next[movingIndex]!];
  return next;
}
