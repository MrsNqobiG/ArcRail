/**
 * F0 money-safe JSON (src/dfns/json.ts): strict parsing with numbers kept as
 * text, canonical serialisation, and the shape readers.
 */
import { describe, expect, it } from 'vitest';
import {
  JSON_MAX_DEPTH,
  JsonArray,
  JsonNumber,
  JsonObject,
  JsonShapeError,
  JsonSyntaxError,
  asArray,
  asObject,
  canonicalJson,
  jsonObject,
  optString,
  parseJson,
  reqInteger,
  reqString,
} from '../../src/dfns/json.js';

const obj = (text: string): JsonObject => asObject(parseJson(text), 'test');

describe('parseJson: values', () => {
  it('parses literals, strings and numbers without floats', () => {
    expect(parseJson('null')).toBeNull();
    expect(parseJson('true')).toBe(true);
    expect(parseJson('false')).toBe(false);
    expect(parseJson('"abc"')).toBe('abc');
    const n = parseJson('-12.50e+3');
    expect(n).toBeInstanceOf(JsonNumber);
    expect((n as JsonNumber).raw).toBe('-12.50e+3');
  });

  it.each(['1e5', '1E5', '1e+5', '1e-5', '-0.5e10', '10', '0'])('accepts the number %s as text', (text) => {
    expect((parseJson(text) as JsonNumber).raw).toBe(text);
    expect((parseJson(`[${text}]`) as JsonArray).items).toHaveLength(1);
  });
  it.each(['1e', '1e+', '1x5', '1ee5', '1e5.5'])('rejects the number %s', (text) => {
    expect(() => parseJson(text)).toThrow(JsonSyntaxError);
  });
  it('a string piece list keeps long runs and mixed escapes', () => {
    // JSON text: a run of three unicode escapes, then a mix of unicode and simple escapes.
    expect(parseJson('"ab\\u0041\\u0042\\u0043cd"')).toBe('abABCcd');
    expect(parseJson('"\\u0041\\n\\u0042"')).toBe('A\nB');
    // An escaped backslash followed by u0041 is not a unicode escape.
    expect(parseJson('"x\\\\u0041"')).toBe('x\\u0041');
    expect(parseJson('[null]')).toBeInstanceOf(JsonArray);
    expect((parseJson('[null]') as JsonArray).items).toEqual([null]);
  });
  it('keeps a number above 2^53 exact (as text)', () => {
    const o = obj('{"wei": 123456789012345678901234567890}');
    expect((o.get('wei') as JsonNumber).raw).toBe('123456789012345678901234567890');
    expect(reqInteger(o, 'wei')).toBe(123456789012345678901234567890n);
  });

  it('parses nested objects and arrays, with whitespace anywhere', () => {
    const v = parseJson(' {\n\t"a" : [ 1 , {"b":[]} , [] ] ,\r "c":{} } ');
    const o = asObject(v, 'v');
    const a = asArray(o.get('a'), 'a');
    expect(a).toHaveLength(3);
    expect((a[0] as JsonNumber).raw).toBe('1');
    expect(asArray(asObject(a[1], 'a1').get('b'), 'b')).toEqual([]);
    expect(asArray(a[2], 'a2')).toEqual([]);
    expect([...asObject(o.get('c'), 'c').entries.keys()]).toEqual([]);
  });

  it('decodes every escape, including surrogate pairs', () => {
    expect(parseJson('"\\"\\\\\\/\\b\\f\\n\\r\\t"')).toBe('"\\/\b\f\n\r\t');
    expect(parseJson('"caf\\u00e9 \\u00E9"')).toBe('café é');
    expect(parseJson('"\\ud83d\\ude00!"')).toBe('😀!');
    expect(parseJson('"a\\u0041b"')).toBe('aAb');
    expect(parseJson('"plain é"')).toBe('plain é');
  });

  it('treats __proto__ as plain data', () => {
    const o = obj('{"__proto__": {"x": true}}');
    expect(o.get('__proto__')).toBeInstanceOf(JsonObject);
    expect(({} as Record<string, unknown>)['x']).toBeUndefined();
  });

  it.each([
    ['', 'unexpected end'],
    ['{', 'expected an object key'],
    ['{"a"', 'expected ":"'],
    ['{"a":1', 'expected "," or "}"'],
    ['{"a":1,}', 'expected an object key'],
    ['{"a" 1}', 'expected ":"'],
    ['{"a":1 "b":2}', 'expected "," or "}"'],
    ['{"a":1,"a":2}', 'duplicate key "a"'],
    ['{1:2}', 'expected an object key'],
    ['[1,]', 'unexpected token "]"'],
    ['[1 2]', 'expected "," or "]"'],
    ['[1', 'expected "," or "]"'],
    ['01', 'trailing data'],
    ['1 2', 'trailing data'],
    ['nul', 'unexpected token "n"'],
    ['truex', 'trailing data'],
    ['"abc', 'unexpected token "\\""'],
    ['"a\\x"', 'unexpected token'],
    ['"tab\there"', 'unexpected token'],
    ['-', 'unexpected token "-"'],
    ['1.', 'trailing data'],
    ['.5', 'unexpected token "."'],
    ['+1', 'unexpected token "+"'],
    [':', 'unexpected token ":"'],
    ['NaN', 'unexpected token "N"'],
  ])('rejects %j (%s)', (text, message) => {
    expect(() => parseJson(text)).toThrow(JsonSyntaxError);
    expect(() => parseJson(text)).toThrow(message);
  });

  it('error messages start with "invalid JSON"', () => {
    expect(() => parseJson('[')).toThrow(/^invalid JSON: unexpected end of input$/);
    try {
      parseJson('x');
    } catch (e: unknown) {
      expect((e as Error).name).toBe('JsonSyntaxError');
    }
  });

  it(`accepts nesting up to depth ${JSON_MAX_DEPTH} and rejects deeper`, () => {
    expect(JSON_MAX_DEPTH).toBe(64n);
    const ok = `${'['.repeat(64)}${']'.repeat(64)}`;
    expect(parseJson(ok)).toBeInstanceOf(JsonArray);
    const deep = `${'['.repeat(65)}${']'.repeat(65)}`;
    expect(() => parseJson(deep)).toThrow('nesting too deep');
    const deepObj = '{"a":'.repeat(65) + '1' + '}'.repeat(65);
    expect(() => parseJson(deepObj)).toThrow('nesting too deep');
    expect(parseJson('{"a":'.repeat(64) + '1' + '}'.repeat(64))).toBeInstanceOf(JsonObject);
  });
});

describe('canonicalJson', () => {
  it('sorts keys, drops whitespace and keeps numbers as received', () => {
    const v = parseJson('{ "b": [true, false, null, 1.50], "a": {"y": "x\\n", "x": -0} }');
    expect(canonicalJson(v)).toBe('{"a":{"x":-0,"y":"x\\n"},"b":[true,false,null,1.50]}');
  });

  it('round-trips its own output', () => {
    const text = '{"a":[{"k":"v"},2],"z":"é"}';
    expect(canonicalJson(parseJson(text))).toBe(text);
  });

  it('jsonObject builds objects and refuses duplicate keys', () => {
    expect(canonicalJson(jsonObject([['b', '1'], ['a', null]]))).toBe('{"a":null,"b":"1"}');
    expect(() => jsonObject([['a', '1'], ['a', '2']])).toThrow('duplicate key "a" in jsonObject');
  });
});

describe('shape readers', () => {
  const o = obj('{"s":"abc","n":5,"f":1.5,"e":1e3,"neg":-7,"z":null,"o":{},"a":[]}');

  it('asObject / asArray', () => {
    expect(() => asObject(parseJson('[]'), 'thing')).toThrow(new JsonShapeError('thing: expected an object'));
    expect(() => asObject(undefined, 'thing')).toThrow(JsonShapeError);
    expect(() => asArray(parseJson('{}'), 'list')).toThrow('list: expected an array');
    expect(asArray(o.get('a'), 'a')).toEqual([]);
  });

  it('reqString checks type and pattern', () => {
    expect(reqString(o, 's')).toBe('abc');
    expect(reqString(o, 's', /^abc$/)).toBe('abc');
    expect(() => reqString(o, 's', /^x$/)).toThrow('s: does not match ^x$');
    expect(() => reqString(o, 'n')).toThrow('n: expected a string');
    expect(() => reqString(o, 'missing')).toThrow(JsonShapeError);
  });

  it('optString maps absent and null to null', () => {
    expect(optString(o, 'missing')).toBeNull();
    expect(optString(o, 'z')).toBeNull();
    expect(optString(o, 's', /^a/)).toBe('abc');
    expect(() => optString(o, 'n')).toThrow('n: expected a string');
    expect(() => optString(o, 's', /^b/)).toThrow('does not match');
  });

  it('reqInteger accepts only integers', () => {
    expect(reqInteger(o, 'n')).toBe(5n);
    expect(reqInteger(o, 'neg')).toBe(-7n);
    for (const k of ['f', 'e', 's', 'z', 'missing']) expect(() => reqInteger(o, k)).toThrow(`${k}: expected an integer`);
  });
});
