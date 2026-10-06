/**
 * Scripted diff of the CBS port (src/cbs) against docs/CONTRACT.md §3 and §4.
 *
 * It parses the contract tables and compares them with the port's types, read
 * through the TypeScript type checker (so nested and aliased types are
 * resolved, not grepped):
 * - §3: the operation set equals `CbsPort`'s methods; for each operation, the
 *   request (first parameter) and the `OK` response have exactly the
 *   contract's field names, the same optional markers (`?`), the same string
 *   literal unions (`"DR"|"CR"`), and the same nested shapes (`refs:{…}`,
 *   `legs:[{…}]`);
 * - m17: every compared request/response/payload type has no index signature
 *   (except `Record<string, never>`, the empty object), and no required field
 *   admits `undefined`; every `CbsPort` method has exactly one call signature
 *   (no overloads; any extra overload is compared too) with exactly the
 *   parameters `(req, meta: CallMeta{callId})`, none optional or rest;
 * - §3 `createCase` reasons and §1.4 REJECTED codes equal their TS unions;
 * - §4: `submitPayoutInstruction` (payload, `amount:CBS_MINOR`, REJECTED codes)
 *   and every event payload; events may add only their `type` discriminator,
 *   and `CbsEvent` holds exactly the CBS → adapter events.
 *
 * Returns a list of problems; an empty list means no drift. `overrides`
 * replaces file contents in memory (used by the drift self-tests), so nothing
 * is ever written into src/.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const CONTRACT_PATH = `${ROOT}docs/CONTRACT.md`;
export const PORT_PATH = `${ROOT}src/cbs/port.ts`;
export const EVENTS_PATH = `${ROOT}src/cbs/events.ts`;
const ENTRY = `${ROOT}src/cbs/index.ts`;

/* ------------------------------------------------------------------ */
/* Contract notation parser: {a, b?, c:{…}, d:[{…}], e:"X"|"Y", f:T}   */
/* ------------------------------------------------------------------ */

export interface Field {
  readonly optional: boolean;
  readonly literals?: readonly string[];
  readonly child?: Shape;
  readonly ident?: string;
  /** written as `[…]` or `[{…}]` in CONTRACT */
  readonly array?: boolean;
}
export type Shape = Map<string, Field>;

function parseShape(src: string): Shape {
  const s = src.replace(/\\\|/g, '|');
  let i = 0;
  const ws = (): void => {
    while (i < s.length && /\s/.test(s[i] as string)) i += 1;
  };
  const expect = (c: string): void => {
    ws();
    if (s[i] !== c) throw new Error(`contract parse: expected "${c}" at ${i} in ${s}`);
    i += 1;
  };
  const ident = (): string => {
    ws();
    const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
    if (!m) throw new Error(`contract parse: expected a name at ${i} in ${s}`);
    i += m[0].length;
    return m[0];
  };
  const object = (): Shape => {
    expect('{');
    const shape: Shape = new Map();
    ws();
    if (s[i] === '}') {
      i += 1;
      return shape;
    }
    for (;;) {
      const name = ident();
      let optional = false;
      ws();
      if (s[i] === '?') {
        optional = true;
        i += 1;
      }
      ws();
      let field: Field = { optional };
      if (s[i] === ':') {
        i += 1;
        ws();
        field = { optional, ...value() };
      }
      if (shape.has(name)) throw new Error(`contract parse: duplicate field ${name}`);
      shape.set(name, field);
      ws();
      if (s[i] === ',') {
        i += 1;
        continue;
      }
      expect('}');
      return shape;
    }
  };
  const value = (): Omit<Field, 'optional'> => {
    ws();
    const c = s[i];
    if (c === '{') return { child: object() };
    if (c === '[') {
      i += 1;
      ws();
      if (s[i] === '{') {
        const child = object();
        expect(']');
        return { child, array: true };
      }
      // opaque element list: […] or [...]
      const close = s.indexOf(']', i);
      if (close < 0) throw new Error(`contract parse: unclosed [ in ${s}`);
      i = close + 1;
      return { array: true };
    }
    if (c === '"') {
      const literals: string[] = [];
      for (;;) {
        ws();
        const m = /^"([^"]*)"/.exec(s.slice(i));
        if (!m) throw new Error(`contract parse: expected a string literal at ${i} in ${s}`);
        literals.push(m[1] as string);
        i += m[0].length;
        ws();
        if (s[i] === '|') {
          i += 1;
          continue;
        }
        return { literals };
      }
    }
    return { ident: ident() };
  };
  const shape = object();
  ws();
  if (i !== s.length) throw new Error(`contract parse: trailing text at ${i} in ${s}`);
  return shape;
}

function section(md: string, start: RegExp, end: RegExp): string {
  const a = md.search(start);
  if (a < 0) throw new Error(`CONTRACT section not found: ${start}`);
  const rest = md.slice(a);
  const b = rest.slice(1).search(end);
  return b < 0 ? rest : rest.slice(0, b + 1);
}

function tableRows(sec: string): string[][] {
  return sec
    .split('\n')
    .filter((l) => l.startsWith('| `'))
    .map((l) =>
      l
        .replace(/^\|/, '')
        .replace(/\|\s*$/, '')
        .split(/(?<!\\)\|/)
        .map((c) => c.trim()),
    );
}

const firstCode = (cell: string): string => {
  const m = /`([^`]*)`/.exec(cell);
  if (!m) throw new Error(`no code span in cell: ${cell}`);
  return m[1] as string;
};

const codeSpans = (text: string): string[] => [...text.matchAll(/`([^`]*)`/g)].map((m) => m[1] as string);

/**
 * Units stated in a row's prose rather than in its payload, for example §4
 * CaseDisposition: "`RETURN` requires `returnAmount` (CBS_MINOR, …)". Each
 * `` `field` (CBS_MINOR `` marks that top-level payload field CBS_MINOR.
 */
function applyProseUnits(shape: Shape, prose: string): Shape {
  for (const m of prose.matchAll(/`(\w+)` \(CBS_MINOR\b/g)) {
    const name = m[1] as string;
    const f = shape.get(name);
    if (f && f.ident === undefined) shape.set(name, { ...f, ident: 'CBS_MINOR' });
  }
  return shape;
}

export interface ContractModel {
  readonly ops: Map<string, { readonly request: Shape; readonly response: Shape }>;
  readonly caseReasons: readonly string[];
  readonly rejectedCodes: readonly string[];
  readonly s4: Map<string, { readonly direction: string; readonly payload: Shape }>;
  readonly payoutRejectedCodes: readonly string[];
}

export function parseContract(md: string): ContractModel {
  const s3 = section(md, /^## 3\. /m, /^## 4\. /m);
  const ops = new Map<string, { request: Shape; response: Shape }>();
  let caseReasons: string[] = [];
  for (const cells of tableRows(s3)) {
    const name = firstCode(cells[0] as string);
    if (ops.has(name)) throw new Error(`duplicate §3 op ${name}`);
    const request = applyProseUnits(parseShape(firstCode(cells[2] as string)), cells[4] as string);
    ops.set(name, { request, response: parseShape(firstCode(cells[3] as string)) });
    if (name === 'createCase') {
      const notes = cells[4] as string;
      const m = /Reasons \(closed list\):(.*?)Every/.exec(notes);
      if (!m) throw new Error('createCase reasons not found in CONTRACT §3');
      caseReasons = codeSpans(m[1] as string);
    }
  }
  const s14 = section(md, /^### 1\.4 /m, /^### 1\.5 /m);
  const rc = /`REJECTED` codes:(.*?)\*\*/.exec(s14);
  if (!rc) throw new Error('REJECTED codes not found in CONTRACT §1.4');
  const rejectedCodes = codeSpans(rc[1] as string);

  const s4sec = section(md, /^## 4\. /m, /^## 5\. /m);
  const s4 = new Map<string, { direction: string; payload: Shape }>();
  let payoutRejectedCodes: string[] = [];
  for (const cells of tableRows(s4sec)) {
    const name = firstCode(cells[0] as string);
    s4.set(name, { direction: cells[1] as string, payload: applyProseUnits(parseShape(firstCode(cells[2] as string)), cells[3] as string) });
    if (name === 'submitPayoutInstruction') {
      const m = /with code(.*?)\. \*\*/.exec(cells[3] as string);
      if (!m) throw new Error('submitPayoutInstruction REJECTED codes not found in CONTRACT §4');
      payoutRejectedCodes = codeSpans(m[1] as string);
    }
  }
  return { ops, caseReasons, rejectedCodes, s4, payoutRejectedCodes };
}

/* ------------------------------------------------------------------ */
/* TypeScript side                                                     */
/* ------------------------------------------------------------------ */

function loadProgram(overrides: ReadonlyMap<string, string>): ts.Program {
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    exactOptionalPropertyTypes: true,
    noEmit: true,
    skipLibCheck: true,
  };
  const host = ts.createCompilerHost(options, true);
  const orig = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, lang, onError, create) => {
    const text = overrides.get(fileName);
    if (text !== undefined) return ts.createSourceFile(fileName, text, lang, true);
    return orig(fileName, lang, onError, create);
  };
  const orgRead = host.readFile.bind(host);
  host.readFile = (f) => overrides.get(f) ?? orgRead(f);
  return ts.createProgram([ENTRY], options, host);
}

function findDecl(program: ts.Program, file: string, name: string): ts.Declaration {
  const sf = program.getSourceFile(file);
  if (!sf) throw new Error(`source not in program: ${file}`);
  for (const st of sf.statements) {
    if ((ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st)) && st.name.text === name) return st;
  }
  throw new Error(`${name} not declared in ${file}`);
}

function nonNullable(checker: ts.TypeChecker, t: ts.Type): ts.Type {
  return checker.getNonNullableType(t);
}

function stringLiterals(t: ts.Type): string[] | null {
  const parts = t.isUnion() ? t.types : [t];
  const out: string[] = [];
  for (const p of parts) {
    if (!p.isStringLiteral()) return null;
    out.push(p.value);
  }
  return out;
}

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && new Set(a).size === a.length && a.every((x) => b.includes(x));

/**
 * Wire kind of each CONTRACT field. CONTRACT §1.1/§1.2: JSON numbers are never
 * used; amounts are `{unit, value}` objects; IDs, keys, hashes, chain IDs,
 * sequence numbers and timestamps are strings. So every field is a string
 * unless its CONTRACT form says otherwise (`{…}` object, `[…]` array, a
 * literal union, `CBS_MINOR`), or it is named below with the CONTRACT
 * clause that fixes its kind.
 */
type Kind = 'string' | 'boolean' | 'object' | 'amount' | 'array' | 'string[]' | 'unknown';
const KIND_BY_NAME: Readonly<Record<string, Kind>> = {
  amount: 'amount', // §1.1 wire amount
  returnAmount: 'amount', // §4 CaseDisposition, §1.1
  active: 'boolean', // §3 getAccountStanding, §4 AccountStatusChanged
  kycValid: 'boolean',
  frozen: 'boolean',
  glOrAccountRef: 'object', // §2 GL roles
  account: 'object', // §3 getBalancesAsOf balances[].account: a GL role
  refs: 'object', // §3 postJournal refs (createCase, listJournals carry the same object)
  legs: 'array', // §3 postJournal legs:[…]
  keys: 'string[]', // §3 listJournals: idempotency keys
  evidenceRefs: 'string[]', // §3 createCase
  dataRefs: 'string[]', // §3 fileReportData
  types: 'string[]', // §3 replayEvents: event type names
  result: 'unknown', // §3 getResultByKey: the covered op's own result
};

function expectedKind(name: string, field: Field): Kind {
  if (field.array) return 'array';
  if (field.child) return 'object';
  if (field.literals) return 'string';
  if (field.ident === 'CBS_MINOR') return 'amount';
  return KIND_BY_NAME[name] ?? 'string';
}

function isStringType(t: ts.Type): boolean {
  if ((t.flags & ts.TypeFlags.StringLike) !== 0) return true;
  if (t.isUnion()) return t.types.every(isStringType);
  if (t.isIntersection()) return t.types.some((u) => (u.flags & ts.TypeFlags.StringLike) !== 0);
  return false;
}

function kindOf(checker: ts.TypeChecker, t: ts.Type): string {
  if ((t.flags & (ts.TypeFlags.Unknown | ts.TypeFlags.Any)) !== 0) return 'unknown';
  if (checker.isArrayType(t)) {
    const el = checker.getTypeArguments(t as ts.TypeReference)[0];
    return el && isStringType(el) ? 'string[]' : 'array';
  }
  if (isStringType(t)) return 'string';
  if ((t.flags & ts.TypeFlags.BooleanLike) !== 0 || (t.isUnion() && t.types.every((u) => (u.flags & ts.TypeFlags.BooleanLike) !== 0))) return 'boolean';
  const members = t.isUnion() ? t.types : [t];
  if (members.every((m) => (m.flags & ts.TypeFlags.Object) !== 0 && !checker.isArrayType(m))) {
    const unit = checker.getPropertyOfType(t, 'unit');
    const value = checker.getPropertyOfType(t, 'value');
    if (unit && value && isStringType(checker.getTypeOfSymbol(value)) && isStringType(checker.getTypeOfSymbol(unit))) return 'amount';
    return 'object';
  }
  return `other (${checker.typeToString(t)})`;
}

function kindMatches(expected: Kind, actual: string): boolean {
  if (expected === actual) return true;
  if (expected === 'array' && actual === 'string[]') return true;
  // An amount is an object; a field expected to be an object may not be an amount and vice versa.
  return false;
}

function compareShape(
  checker: ts.TypeChecker,
  where: string,
  shape: Shape,
  type: ts.Type,
  problems: string[],
  allowedExtra: readonly string[] = [],
): void {
  let t = nonNullable(checker, type);
  if (checker.isArrayType(t)) t = checker.getTypeArguments(t as ts.TypeReference)[0] as ts.Type;
  // m17: an index signature admits fields CONTRACT doesn't name (P13, P30). Only an
  // index signature of type `never` (`Record<string, never>`, the empty object) is allowed.
  for (const info of checker.getIndexInfosOfType(t)) {
    if ((info.type.flags & ts.TypeFlags.Never) === 0) {
      problems.push(`${where}: index signature [${checker.typeToString(info.keyType)}]: ${checker.typeToString(info.type)} admits fields that are not in CONTRACT`);
    }
  }
  const props = checker.getPropertiesOfType(t);
  const tsNames = props.map((p) => p.name);
  for (const [name, field] of shape) {
    const prop = props.find((p) => p.name === name);
    if (!prop) {
      problems.push(`${where}: field "${name}" is in CONTRACT but missing from the port`);
      continue;
    }
    const optional = (prop.flags & ts.SymbolFlags.Optional) !== 0;
    if (optional !== field.optional) {
      problems.push(`${where}.${name}: CONTRACT says ${field.optional ? 'optional' : 'required'}, port says ${optional ? 'optional' : 'required'}`);
    }
    const rawType = checker.getTypeOfSymbol(prop);
    // m17 (P15): a required field must not admit `undefined` (it would be absent on the wire).
    if (!optional) {
      const members = rawType.isUnion() ? rawType.types : [rawType];
      if (members.some((u) => (u.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Void)) !== 0)) {
        problems.push(`${where}.${name}: CONTRACT says required, but the port type ${checker.typeToString(rawType)} admits undefined`);
      }
    }
    const propType = nonNullable(checker, rawType);
    const want = expectedKind(name, field);
    // `unknown` must be read before removing null/undefined, which turns it into `{}`.
    const got = (rawType.flags & (ts.TypeFlags.Unknown | ts.TypeFlags.Any)) !== 0 ? 'unknown' : kindOf(checker, propType);
    if (!kindMatches(want, got)) {
      problems.push(`${where}.${name}: CONTRACT kind ${want}, port kind ${got} (${checker.typeToString(propType)})`);
    }
    if (field.literals) {
      const lits = stringLiterals(propType);
      if (!lits || !sameSet(lits, field.literals)) {
        problems.push(`${where}.${name}: CONTRACT literals ${JSON.stringify(field.literals)}, port type ${checker.typeToString(propType)}`);
      }
    }
    if (field.ident === 'CBS_MINOR') {
      const unit = checker.getPropertyOfType(propType, 'unit');
      const unitType = unit ? checker.getTypeOfSymbol(unit) : undefined;
      const members = unitType ? (unitType.isUnion() ? unitType.types : [unitType]) : [];
      const ok =
        members.length > 0 &&
        members.every((m) => (m.flags & ts.TypeFlags.TemplateLiteral) !== 0 && (m as ts.TemplateLiteralType).texts[0] === 'CBS_MINOR:');
      if (!ok) problems.push(`${where}.${name}: CONTRACT says CBS_MINOR, port unit type is ${unitType ? checker.typeToString(unitType) : 'absent'}`);
    } else if (field.ident !== undefined) {
      problems.push(`${where}.${name}: unknown CONTRACT type annotation ${field.ident} (extend the checker)`);
    }
    if (field.child) compareShape(checker, `${where}.${name}`, field.child, propType, problems);
  }
  for (const n of tsNames) {
    if (!shape.has(n) && !allowedExtra.includes(n)) problems.push(`${where}: field "${n}" is in the port but not in CONTRACT`);
  }
}

export interface CheckOptions {
  readonly contractText?: string;
  /** absolute file path → replacement source text */
  readonly overrides?: ReadonlyMap<string, string>;
}

export function checkPortAgainstContract(opts: CheckOptions = {}): string[] {
  const contract = parseContract(opts.contractText ?? readFileSync(CONTRACT_PATH, 'utf8'));
  const program = loadProgram(opts.overrides ?? new Map());
  const checker = program.getTypeChecker();
  const problems: string[] = [];
  const typeOf = (file: string, name: string): ts.Type => checker.getTypeAtLocation(findDecl(program, file, name));

  // §3 operations
  const port = typeOf(PORT_PATH, 'CbsPort');
  const methods = checker.getPropertiesOfType(port);
  const methodNames = methods.map((m) => m.name);
  for (const op of contract.ops.keys()) if (!methodNames.includes(op)) problems.push(`§3 op ${op}: missing from CbsPort`);
  for (const m of methodNames) if (!contract.ops.has(m)) problems.push(`§3: CbsPort.${m} is not a CONTRACT operation`);
  for (const m of methods) {
    const spec = contract.ops.get(m.name);
    if (!spec) continue;
    const sigs = checker.getSignaturesOfType(checker.getTypeOfSymbol(m), ts.SignatureKind.Call);
    const sig = sigs[0];
    if (!sig) {
      problems.push(`§3 op ${m.name}: not a method`);
      continue;
    }
    // m17 (P28): an overload is a second request shape the checker would never compare.
    if (sigs.length !== 1) problems.push(`§3 op ${m.name}: ${sigs.length} call signatures (overloads); CONTRACT has exactly one`);
    // m17 (P14): exactly (req, meta); no extra, optional or rest parameter.
    const params = sig.getParameters();
    const decl = sig.getDeclaration() as ts.SignatureDeclaration | undefined;
    if (params.length !== 2 || (decl?.parameters ?? []).some((pd) => pd.dotDotDotToken !== undefined || pd.questionToken !== undefined)) {
      problems.push(`§3 op ${m.name}: parameters must be exactly (req, meta), found (${params.map((p) => p.name).join(', ')})`);
    }
    const p0 = params[0];
    if (!p0) {
      problems.push(`§3 op ${m.name}: no request parameter`);
      continue;
    }
    const p1 = params[1];
    const metaProps = p1 ? checker.getPropertiesOfType(checker.getTypeOfSymbol(p1)).map((p) => p.name) : [];
    if (!p1 || metaProps.length !== 1 || metaProps[0] !== 'callId') problems.push(`§3 op ${m.name}: second parameter must be CallMeta {callId}`);
    sigs.slice(1).forEach((extra, i) => {
      const q0 = extra.getParameters()[0];
      if (q0) compareShape(checker, `§3 ${m.name} overload ${i + 2} request`, spec.request, checker.getTypeOfSymbol(q0), problems);
    });
    compareShape(checker, `§3 ${m.name} request`, spec.request, checker.getTypeOfSymbol(p0), problems);
    const awaited = checker.getAwaitedType(sig.getReturnType());
    const okMember = awaited && (awaited.isUnion() ? awaited.types : [awaited]).find((u) => {
      const kind = checker.getPropertyOfType(u, 'kind');
      const lits = kind ? stringLiterals(checker.getTypeOfSymbol(kind)) : null;
      return lits?.length === 1 && lits[0] === 'OK';
    });
    const value = okMember && checker.getPropertyOfType(okMember, 'value');
    if (!value) {
      problems.push(`§3 op ${m.name}: no OK{value} in the result type`);
      continue;
    }
    compareShape(checker, `§3 ${m.name} OK`, spec.response, checker.getTypeOfSymbol(value), problems);
  }

  // §3 createCase reasons and §1.4 REJECTED codes
  const reasons = stringLiterals(typeOf(PORT_PATH, 'CaseReason')) ?? [];
  if (contract.caseReasons.length === 0 || !sameSet(reasons, contract.caseReasons)) {
    problems.push(`§3 createCase reasons: CONTRACT ${JSON.stringify(contract.caseReasons)} vs port ${JSON.stringify(reasons)}`);
  }
  const rejected = stringLiterals(typeOf(`${ROOT}src/cbs/result.ts`, 'RejectedCode')) ?? [];
  if (contract.rejectedCodes.length === 0 || !sameSet(rejected, contract.rejectedCodes)) {
    problems.push(`§1.4 REJECTED codes: CONTRACT ${JSON.stringify(contract.rejectedCodes)} vs port ${JSON.stringify(rejected)}`);
  }

  // §4
  const cbsToAdapterEvents: string[] = [];
  for (const [name, spec] of contract.s4) {
    const tsName = name.charAt(0).toUpperCase() + name.slice(1);
    let t: ts.Type;
    try {
      t = typeOf(EVENTS_PATH, tsName);
    } catch {
      problems.push(`§4 ${name}: no type ${tsName} in src/cbs/events.ts`);
      continue;
    }
    const isCall = /\(call\)/.test(spec.direction);
    if (!isCall && spec.direction.startsWith('CBS')) cbsToAdapterEvents.push(name);
    compareShape(checker, `§4 ${name}`, spec.payload, t, problems, isCall ? [] : ['type']);
    if (!isCall) {
      const typeProp = checker.getPropertyOfType(t, 'type');
      const lits = typeProp ? stringLiterals(checker.getTypeOfSymbol(typeProp)) : null;
      if (!lits || lits.length !== 1 || lits[0] !== name) problems.push(`§4 ${name}: discriminator type must be '${name}'`);
    }
  }
  const adapterPort = typeOf(EVENTS_PATH, 'AdapterPort');
  const adapterMethods = checker.getPropertiesOfType(adapterPort).map((p) => p.name);
  const calls = [...contract.s4].filter(([, v]) => /\(call\)/.test(v.direction)).map(([k]) => k);
  if (!sameSet(adapterMethods, calls)) problems.push(`§4 calls: CONTRACT ${JSON.stringify(calls)} vs AdapterPort ${JSON.stringify(adapterMethods)}`);
  const payoutCodes = stringLiterals(typeOf(EVENTS_PATH, 'PayoutInstructionRejectedCode')) ?? [];
  if (contract.payoutRejectedCodes.length === 0 || !sameSet(payoutCodes, contract.payoutRejectedCodes)) {
    problems.push(`§4 submitPayoutInstruction codes: CONTRACT ${JSON.stringify(contract.payoutRejectedCodes)} vs port ${JSON.stringify(payoutCodes)}`);
  }
  const cbsEvent = typeOf(EVENTS_PATH, 'CbsEvent');
  const eventTypes = (cbsEvent.isUnion() ? cbsEvent.types : [cbsEvent]).flatMap((u) => {
    const p = checker.getPropertyOfType(u, 'type');
    return (p && stringLiterals(checker.getTypeOfSymbol(p))) ?? [];
  });
  if (!sameSet(eventTypes, cbsToAdapterEvents)) {
    problems.push(`§4 CbsEvent: CONTRACT CBS → adapter events ${JSON.stringify(cbsToAdapterEvents)} vs union ${JSON.stringify(eventTypes)}`);
  }
  return problems;
}
