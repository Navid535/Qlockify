export type QueryParamUpdateValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number>;

type QueryParamDefaults = Record<string, string | number | boolean | undefined>;

const normalizeScalar = (value: string | number | boolean) => {
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }

  return String(value);
};

export const readStringParam = (
  searchParams: URLSearchParams,
  key: string,
  fallback = "",
) => searchParams.get(key) ?? fallback;

export const readNumberParam = (
  searchParams: URLSearchParams,
  key: string,
  fallback: number,
) => {
  const rawValue = searchParams.get(key);
  if (!rawValue) return fallback;

  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue)) return fallback;

  return parsedValue;
};

export const readBooleanParam = (
  searchParams: URLSearchParams,
  key: string,
  fallback = false,
) => {
  const rawValue = searchParams.get(key);
  if (rawValue === null) return fallback;

  return rawValue === "1" || rawValue === "true";
};

export const readArrayParam = (searchParams: URLSearchParams, key: string) =>
  searchParams
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

export const updateQueryParams = (
  currentParams: URLSearchParams,
  updates: Record<string, QueryParamUpdateValue>,
  defaults: QueryParamDefaults = {},
) => {
  const nextParams = new URLSearchParams(currentParams);

  Object.entries(updates).forEach(([key, value]) => {
    nextParams.delete(key);

    if (Array.isArray(value)) {
      const normalizedValues = value
        .map((item) => String(item).trim())
        .filter(Boolean);

      normalizedValues.forEach((item) => nextParams.append(key, item));
      return;
    }

    if (value === null || value === undefined) return;

    const normalizedValue =
      typeof value === "string" ? value.trim() : normalizeScalar(value);
    const defaultValue = defaults[key];

    if (!normalizedValue.length) return;
    if (
      defaultValue !== undefined &&
      normalizedValue === normalizeScalar(defaultValue)
    ) {
      return;
    }

    nextParams.set(key, normalizedValue);
  });

  return nextParams;
};
