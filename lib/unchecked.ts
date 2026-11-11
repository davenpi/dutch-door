// Types and checks for input that has not been looked at yet: request bodies,
// tokens, anything a visitor sent. No dependencies.

/**
 * The field names of T with nothing known about the values. A function that
 * takes this must check each value before it uses it.
 */
export type Unchecked<T> = { [K in keyof T]?: unknown };

/** True for any object that is not null. Arrays count. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
