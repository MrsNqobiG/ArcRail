/**
 * F0 Money-safe JSON for the DFNS adapter (NOVA_ARC_DESIGN §8).
 *
 * Every DFNS response and webhook body is JSON, and `JSON.parse` turns JSON
 * numbers into floats (RUBRIC MC-01). This module parses JSON without ever
 * producing a `number`: a JSON number is kept as its exact source text in a
 * `JsonNumber`, and a reader that needs an integer converts that text with
 * `BigInt` after checking it is an integer. DFNS sends amounts as decimal
 * strings anyway [DF:transfer `amount` `^\d+$`]; the only numbers we read are
 * integers such as the webhook `timestampSent` [DF:webhooks-guide].
 *
 * Fail closed: anything that is not strict RFC 8259 JSON is a `JsonSyntaxError`,
 * and so is a duplicate object key (two readers could otherwise disagree on
 * which value counts). Objects are `Map`s, so a `__proto__` key is plain data.
 *
 * `canonicalJson` is the one serialiser: keys sorted (UTF-16 code-unit order),
 * no whitespace, numbers as received. Request bodies and payload digests use it,
 * so the bytes we sign are the bytes we send.
 */

/** A JSON number, kept as its exact source text. Never converted to a float. */
export class JsonNumber {
  constructor(readonly raw: string) {}
}

/** A JSON array. */
export class JsonArray {
  constructor(readonly items: readonly JsonValue[]) {}
}

/** A JSON object; keys are unique. */
export class JsonObject {
  constructor(readonly entries: ReadonlyMap<string, JsonValue>) {}

  get(key: string): JsonValue | undefined {
    return this.entries.get(key);
  }
}

export type JsonValue = null | boolean | string | JsonNumber | JsonArray | JsonObject;

export class JsonSyntaxError extends Error {
  override readonly name = 'JsonSyntaxError';
}

/** Deepest nesting accepted (arrays and objects). DFNS bodies nest a handful of levels. */
export const JSON_MAX_DEPTH = 64n;

/**
 * One token per match: whitespace, a punctuator, a complete string, a number,
 * a literal, or (last) any single other character, which the parser rejects.
 * The sticky flag makes the matches contiguous, so nothing is skipped.
 */
const TOKEN = /[ \t\n\r]+|[{}[\],:]|"(?:[^"\\\u0000-\u001f]|\\["\\/bfnrt]|\\u[0-9a-fA-F]{4})*"|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?|true|false|null|[^]/gy;
const WHITESPACE = /^[ \t\n\r]+$/;
const STRING_TOKEN = /^"(?:[^"\\\u0000-\u001f]|\\["\\/bfnrt]|\\u[0-9a-fA-F]{4})*"$/;
const NUMBER_TOKEN = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/;
const STRING_PIECE = /(?:\\u[0-9a-fA-F]{4})+|\\["\\/bfnrt]|[^\\]+/g;
const UNICODE_ESCAPE = /\\u([0-9a-fA-F]{4})/g;
const SIMPLE_ESCAPES: ReadonlyMap<string, string> = new Map([
  ['\\"', '"'],
  ['\\\\', '\\'],
  ['\\/', '/'],
  ['\\b', '\b'],
  ['\\f', '\f'],
  ['\\n', '\n'],
  ['\\r', '\r'],
  ['\\t', '\t'],
]);

/** Decode one run of `\uXXXX` escapes as UTF-16 code units (surrogate pairs join up). */
function decodeUnicodeRun(run: string): string {
  const littleEndianHex = [...run.matchAll(UNICODE_ESCAPE)]
    .map((m) => {
      const unit = `${m[1]}`;
      return unit.slice(2) + unit.slice(0, 2);
    })
    .join('');
  return Buffer.from(littleEndianHex, 'hex').toString('utf16le');
}

/** The value of a complete string token (quotes included), escapes decoded. */
function stringValue(token: string): string {
  const inner = token.slice(1, -1);
  return [...inner.matchAll(STRING_PIECE)]
    .map((m) => {
      const piece = m[0];
      if (piece.startsWith('\\u')) return decodeUnicodeRun(piece);
      return SIMPLE_ESCAPES.get(piece) ?? piece;
    })
    .join('');
}

function fail(detail: string): never {
  throw new JsonSyntaxError(`invalid JSON: ${detail}`);
}

function parseValue(q: string[], depth: bigint): JsonValue {
  const t = q.shift();
  if (t === undefined) fail('unexpected end of input');
  if (t === '{' || t === '[') {
    if (depth >= JSON_MAX_DEPTH) fail('nesting too deep');
    return t === '{' ? parseObject(q, depth + 1n) : parseArray(q, depth + 1n);
  }
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (STRING_TOKEN.test(t)) return stringValue(t);
  if (NUMBER_TOKEN.test(t)) return new JsonNumber(t);
  return fail(`unexpected token ${JSON.stringify(t)}`);
}

function parseObject(q: string[], depth: bigint): JsonObject {
  const out = new Map<string, JsonValue>();
  if (q[0] === '}') {
    q.shift();
    return new JsonObject(out);
  }
  for (;;) {
    const k = q.shift();
    if (k === undefined || !STRING_TOKEN.test(k)) fail('expected an object key');
    const key = stringValue(k);
    if (out.has(key)) fail(`duplicate key ${JSON.stringify(key)}`);
    if (q.shift() !== ':') fail('expected ":"');
    out.set(key, parseValue(q, depth));
    const sep = q.shift();
    if (sep === '}') return new JsonObject(out);
    if (sep !== ',') fail('expected "," or "}"');
  }
}

function parseArray(q: string[], depth: bigint): JsonArray {
  if (q[0] === ']') {
    q.shift();
    return new JsonArray([]);
  }
  let items: readonly JsonValue[] = [];
  for (;;) {
    items = [...items, parseValue(q, depth)];
    const sep = q.shift();
    if (sep === ']') return new JsonArray(items);
    if (sep !== ',') fail('expected "," or "]"');
  }
}

/** Parse strict JSON text. Numbers stay as text (`JsonNumber`); never a float. */
export function parseJson(text: string): JsonValue {
  const q = [...text.matchAll(TOKEN)].map((m) => m[0]).filter((t) => !WHITESPACE.test(t));
  const value = parseValue(q, 0n);
  if (q.length > 0) fail('trailing data');
  return value;
}

/** Canonical text: sorted keys, no whitespace, numbers as received. */
export function canonicalJson(v: JsonValue): string {
  if (v === null) return 'null';
  if (v === true) return 'true';
  if (v === false) return 'false';
  if (typeof v === 'string') return JSON.stringify(v);
  if (v instanceof JsonNumber) return v.raw;
  if (v instanceof JsonArray) return `[${v.items.map(canonicalJson).join(',')}]`;
  const keys = [...v.entries.keys()].sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(v.entries.get(k) ?? null)}`).join(',')}}`;
}

/** Build an object from entries (a later duplicate key is a programming error). */
export function jsonObject(entries: readonly (readonly [string, JsonValue])[]): JsonObject {
  const m = new Map<string, JsonValue>();
  for (const [k, v] of entries) {
    if (m.has(k)) throw new JsonSyntaxError(`invalid JSON: duplicate key ${JSON.stringify(k)} in jsonObject`);
    m.set(k, v);
  }
  return new JsonObject(m);
}

/** Thrown by the readers below when a decoded body does not have the expected shape. */
export class JsonShapeError extends Error {
  override readonly name = 'JsonShapeError';
}

function shape(detail: string): never {
  throw new JsonShapeError(detail);
}

/** The value as an object, or throw. */
export function asObject(v: JsonValue | undefined, what: string): JsonObject {
  return v instanceof JsonObject ? v : shape(`${what}: expected an object`);
}

/** The value as an array, or throw. */
export function asArray(v: JsonValue | undefined, what: string): readonly JsonValue[] {
  return v instanceof JsonArray ? v.items : shape(`${what}: expected an array`);
}

/** A required string field, optionally checked against a pattern. */
export function reqString(o: JsonObject, key: string, pattern?: RegExp): string {
  const v = o.get(key);
  if (typeof v !== 'string') return shape(`${key}: expected a string`);
  if (pattern !== undefined && !pattern.test(v)) return shape(`${key}: does not match ${pattern.source}`);
  return v;
}

/** An optional string field (absent or null → null), optionally checked against a pattern. */
export function optString(o: JsonObject, key: string, pattern?: RegExp): string | null {
  const v = o.get(key);
  if (v === undefined || v === null) return null;
  return reqString(o, key, pattern);
}

/** A required JSON integer field (a `JsonNumber` with no fraction or exponent), as bigint. */
export function reqInteger(o: JsonObject, key: string): bigint {
  const v = o.get(key);
  if (!(v instanceof JsonNumber) || !/^-?(?:0|[1-9][0-9]*)$/.test(v.raw)) return shape(`${key}: expected an integer`);
  return BigInt(v.raw);
}
