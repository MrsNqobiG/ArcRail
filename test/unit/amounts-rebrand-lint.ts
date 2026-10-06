/**
 * U1 re-brand rule (CLAUDE.md "Conversions happen in exactly one module",
 * RUBRIC MC-03). Type-aware, over every TypeScript module under `src/`
 * (`.ts`, `.mts`, `.cts`, `.tsx`, declaration files included) except the
 * conversion module `src/amounts/index.ts`.
 *
 * A raw bigint arithmetic result is plain `bigint`; the compiler keeps it out
 * of every branded slot (`CbsMinor`, `UsdcUnits`, `NativeWei`) unless one of
 * the routes below is taken. The public constructors also refuse an argument
 * that already carries a brand (`RawAmount`, MC-02 constructor fixture), so a
 * unit can only be re-labelled after it is widened to plain `bigint`. Each
 * route has a rule:
 *
 *   REBRAND-ARITH     a call to `cbsMinor`, `usdcUnits` or `nativeWei` (however
 *                     imported: renamed, namespace, re-exported) whose argument
 *                     is tainted by raw bigint arithmetic (see "Taint").
 *   REBRAND-CROSS     a constructor call whose argument is derived from a value
 *                     that already carried a brand (of any unit): a brand
 *                     widened to `bigint` or cast to it, read through a
 *                     relabelling helper, shifted as a string, or passed
 *                     through `Number`. Outside the conversion module this is
 *                     always a second conversion or a unit re-label.
 *   REBRAND-NUMBER    a constructor call whose argument is derived from
 *                     `BigInt(<number-typed expression>)`: a JS number (float
 *                     or not) becoming an amount. MC-01 covers numbers only in
 *                     money-path files; this rule covers every src file.
 *   REBRAND-LIBCONV   any reference to a library (declared outside src) decimal-scaling
 *                     helper (`parseUnits`, `parseEther`, `parseGwei`,
 *                     `formatUnits`, `formatEther`, `formatGwei`): a second
 *                     conversion or display module by definition.
 *   REBRAND-CAST      a type assertion (`as T`, `<T>x`) whose target may carry
 *                     a brand: a brand directly, or nested in a union,
 *                     intersection, array, tuple, property, function return
 *                     type or awaited (Promise) type; or a type parameter
 *                     declared in src whose constraint admits a brand (a
 *                     generic `v as T` instantiated with a brand). `as const`
 *                     is never flagged.
 *   REBRAND-ANY       (a) an `any`-typed expression whose contextual type may
 *                     carry a brand (`const x: NativeWei = anyValue`, an
 *                     `any`-returning helper, a generic `return anyValue` into
 *                     `T`); (b) an explicit `any` type anywhere; (c) a function
 *                     with no return annotation whose inferred return type (or
 *                     awaited return type) is `any`, which could satisfy an
 *                     interface method that returns a brand.
 *   REBRAND-GUARD     a type predicate (`v is T`, `asserts v is T`) whose T may
 *                     carry a brand: it narrows a plain bigint to a brand with
 *                     no runtime check.
 *   REBRAND-SIGNATURE a body-less, non-abstract function or method signature
 *                     (overload or `declare`) whose return type may carry a
 *                     brand, or an ambient (`declare`, `.d.ts`) variable or
 *                     property whose type may carry a brand. Neither has a
 *                     checked implementation.
 *   REBRAND-REFLECT   `Object.assign`, `Object.defineProperty`,
 *                     `Object.defineProperties`, `Object.setPrototypeOf`,
 *                     `Reflect.set`, `Reflect.defineProperty` or
 *                     `Reflect.setPrototypeOf` whose target may carry a brand
 *                     (it writes a field without the type checker).
 *   REBRAND-ALIAS     a brand constructor used other than as a direct callee
 *                     (`const f = nativeWei`, `nativeWei.call(...)`, a template
 *                     tag, passed as a value), which would escape the rules
 *                     above.
 *
 * Taint (one fixpoint over all checked files per source kind; the sources are
 * raw bigint arithmetic for ARITH, a branded value for CROSS and
 * `BigInt(<number>)` for NUMBER). An arithmetic source is any bigint-typed
 * `+ - * / % **`, bitwise operator, unary `-`/`~`, `++`/`--` or compound
 * assignment. Taint flows into a symbol through: a variable initializer,
 * including object and array destructuring (every bound name); a parameter or
 * destructuring default; a class property initializer; an assignment or
 * compound assignment, including destructuring assignment, to an identifier,
 * a property (the property symbol, the root variable and the parameter of
 * every setter of that property declared in src) or an element (the same, for
 * a literal key); `++`/`--`; a function, method or getter whose `return` or
 * `yield` is tainted (its name); a call or `new` with a tainted argument (the
 * matching parameter of a callee declared in src, including destructured and
 * rest parameters, and calls made through `f.call`, `f.apply`, `f.bind(...)`,
 * a bound `f.bind(...)(...)` and `Reflect.apply`; the receiver's root
 * variable; and every parameter of a callback passed in the same call); a
 * tagged template whose substitution is tainted (the tag's matching
 * parameter); a call on a tainted receiver (every parameter of a callback
 * passed to it); `for...of`/`for...in` over a tainted value (the loop
 * bindings); a tainted `throw` (every `catch` binding); a tainted `export
 * default` (the default export). An expression is tainted if it contains a
 * source or a tainted symbol anywhere inside it (nested functions included,
 * conservatively), and imports resolve to the exported symbol, so taint
 * crosses modules.
 *
 * Sanctioned routes: the §6 conversions and the same-unit `add*`/`subtract*`
 * helpers of src/amounts/index.ts, and constructing an amount from a literal
 * or from a parsed string (`BigInt(hex)`, a library hex parse). Bigint
 * arithmetic whose result is never re-branded (for example a comparison
 * against a cap) is not flagged; neither is `number` arithmetic that never
 * reaches `BigInt` (the MC-01 lint owns numbers on money paths).
 *
 * Limits [L1 and L4 are pinned by "documented limit" tests in
 * amounts-rebrand-lint.test.ts, so a change in behaviour fails the suite; L2,
 * L3 and L5 are inspection-only]:
 *   L1 a write through a widened alias: TypeScript's property covariance is
 *      unsound, so `const wide: { v: bigint } = branded; wide.v = a + b;`
 *      changes `branded.v` with no cast, and taint does not follow the alias
 *      back to `branded`;
 *   L2 values that leave the program and come back (storage, network, files,
 *      environment), and dynamic code (`eval`, `Function`, which the MC-01
 *      lint forbids on money paths);
 *   L3 taint is per symbol, not per value: one tainted write taints every
 *      later read of that symbol (false positives are possible here, not
 *      false negatives);
 *   L4 a value that never was an amount (for example a decimal string from
 *      outside) scaled by string manipulation, or by a library helper not in
 *      the REBRAND-LIBCONV list, before a constructor: a parse and a scale
 *      cannot be told apart without knowing the input's meaning;
 *   L5 JavaScript files under src are not scanned. Under this repository's
 *      strict tsconfig a TypeScript module cannot import a `.js` module that
 *      has no declaration file (TS7016), and a declaration file that exposes a
 *      brand is REBRAND-SIGNATURE.
 * Test files are out of scope (they cast on purpose to test refusals).
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

export type RebrandRule =
  | 'REBRAND-ARITH'
  | 'REBRAND-CAST'
  | 'REBRAND-ANY'
  | 'REBRAND-GUARD'
  | 'REBRAND-SIGNATURE'
  | 'REBRAND-REFLECT'
  | 'REBRAND-ALIAS'
  | 'REBRAND-CROSS'
  | 'REBRAND-NUMBER'
  | 'REBRAND-LIBCONV';

export interface RebrandFinding {
  readonly file: string;
  readonly line: number;
  readonly rule: RebrandRule;
  readonly text: string;
}

export const CONVERSION_MODULE = 'src/amounts/index.ts';
const BRAND_CONSTRUCTORS = new Set(['cbsMinor', 'usdcUnits', 'nativeWei']);
const BRAND_TYPES = ['CbsMinor', 'UsdcUnits', 'NativeWei'];
/** Library decimal-scaling helpers (viem and ethers names): a second conversion module by definition. */
const LIBRARY_UNIT_CONVERTERS = new Set(['parseUnits', 'parseEther', 'parseGwei', 'formatUnits', 'formatEther', 'formatGwei']);
const REFLECT_WRITERS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['Object', new Set(['assign', 'defineProperty', 'defineProperties', 'setPrototypeOf'])],
  ['Reflect', new Set(['set', 'defineProperty', 'setPrototypeOf'])],
]);

const K = ts.SyntaxKind;
const ARITH_OPS = new Set<ts.SyntaxKind>([
  K.PlusToken, K.MinusToken, K.AsteriskToken, K.SlashToken, K.PercentToken, K.AsteriskAsteriskToken,
  K.BarToken, K.AmpersandToken, K.CaretToken, K.LessThanLessThanToken, K.GreaterThanGreaterThanToken, K.GreaterThanGreaterThanGreaterThanToken,
  K.PlusEqualsToken, K.MinusEqualsToken, K.AsteriskEqualsToken, K.SlashEqualsToken, K.PercentEqualsToken, K.AsteriskAsteriskEqualsToken,
  K.BarEqualsToken, K.AmpersandEqualsToken, K.CaretEqualsToken, K.LessThanLessThanEqualsToken, K.GreaterThanGreaterThanEqualsToken,
  K.GreaterThanGreaterThanGreaterThanEqualsToken,
]);
const COMPOUND_OPS = new Set<ts.SyntaxKind>([...ARITH_OPS].filter((op) => op >= K.FirstCompoundAssignment && op <= K.LastCompoundAssignment));
const UNARY_OPS = new Set<ts.SyntaxKind>([K.MinusToken, K.TildeToken, K.PlusPlusToken, K.MinusMinusToken]);

/** Every TypeScript module kind: `.ts`, `.mts`, `.cts`, `.tsx`, and their `.d.*` declaration files. */
const SOURCE_FILE = /\.(?:[cm]?ts|tsx)$/;

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...listSourceFiles(path));
    else if (SOURCE_FILE.test(name)) out.push(path);
  }
  return out;
}

export function lintRebrands(root: string): RebrandFinding[] {
  const files = listSourceFiles(join(root, 'src'));
  const program = ts.createProgram(files, {
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
  });
  const checker = program.getTypeChecker();
  const rel = (sf: ts.SourceFile): string => relative(root, sf.fileName).split('\\').join('/');
  const sources = program.getSourceFiles().filter((sf) => files.includes(sf.fileName));
  const conversion = sources.find((sf) => rel(sf) === CONVERSION_MODULE);
  if (!conversion) throw new Error(`re-brand lint: ${CONVERSION_MODULE} not found under ${root}`);
  const checked = sources.filter((sf) => sf !== conversion);
  const checkedSet = new Set(checked);

  const resolve = (node: ts.Node): ts.Symbol | undefined => {
    const s = ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node
      ? checker.getShorthandAssignmentValueSymbol(node.parent)
      : checker.getSymbolAtLocation(node);
    return s && (s.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(s) : s;
  };

  // --- The brand constructors and brand types of the conversion module. ---
  const ctorSymbols = new Set<ts.Symbol>();
  const brandTypes: ts.Type[] = [];
  conversion.forEachChild((n) => {
    if (ts.isFunctionDeclaration(n) && n.name && BRAND_CONSTRUCTORS.has(n.name.text)) {
      const s = resolve(n.name);
      if (s) ctorSymbols.add(s);
    }
    if (ts.isTypeAliasDeclaration(n) && BRAND_TYPES.includes(n.name.text)) brandTypes.push(checker.getTypeFromTypeNode(n.type));
  });
  if (ctorSymbols.size !== BRAND_CONSTRUCTORS.size) throw new Error('re-brand lint: brand constructors not found in the conversion module');
  if (brandTypes.length !== BRAND_TYPES.length) throw new Error('re-brand lint: brand types not found in the conversion module');
  const isCtor = (node: ts.Node): boolean => {
    const s = resolve(node);
    return s !== undefined && ctorSymbols.has(s);
  };

  /** May a value of this type carry an amount brand (nested, generic or awaited)? */
  const mayCarryBrand = (type: ts.Type): boolean => {
    const seen = new Set<ts.Type>();
    const visit = (t: ts.Type, depth: number): boolean => {
      if (depth > 8 || seen.has(t)) return false;
      seen.add(t);
      if ((t.flags & ts.TypeFlags.TypeParameter) !== 0) {
        const decl = t.symbol?.declarations?.[0];
        if (!decl || !checkedSet.has(decl.getSourceFile())) return false;
        const constraint = checker.getBaseConstraintOfType(t);
        return constraint === undefined || (constraint.flags & ts.TypeFlags.Unknown) !== 0 || brandTypes.some((b) => checker.isTypeAssignableTo(b, constraint));
      }
      if (t.isUnionOrIntersection()) return t.types.some((u) => visit(u, depth + 1));
      if (checker.isArrayType(t) || checker.isTupleType(t)) return checker.getTypeArguments(t as ts.TypeReference).some((u) => visit(u, depth + 1));
      const awaited = checker.getAwaitedType(t);
      if (awaited && awaited !== t && visit(awaited, depth + 1)) return true;
      for (const sig of t.getCallSignatures()) if (visit(checker.getReturnTypeOfSignature(sig), depth + 1)) return true;
      for (const prop of checker.getPropertiesOfType(t)) {
        if (String(prop.escapedName).startsWith('__@amountUnit')) return true;
        const decl = prop.valueDeclaration ?? prop.declarations?.[0];
        if ((t.flags & ts.TypeFlags.Object) !== 0 && decl && visit(checker.getTypeOfSymbolAtLocation(prop, decl), depth + 1)) return true;
      }
      return false;
    };
    return visit(type, 0);
  };

  const isBigIntLike = (t: ts.Type): boolean => {
    if ((t.flags & ts.TypeFlags.BigIntLike) !== 0) return true;
    if (t.isUnion()) return t.types.every(isBigIntLike);
    if (t.isIntersection()) return t.types.some((u) => (u.flags & ts.TypeFlags.BigIntLike) !== 0);
    return false;
  };
  const bigintTyped = (node: ts.Node): boolean => isBigIntLike(checker.getTypeAtLocation(node));

  /** Is this node itself a raw bigint arithmetic operation? */
  const isArithmetic = (node: ts.Node): boolean => {
    if (ts.isBinaryExpression(node)) return ARITH_OPS.has(node.operatorToken.kind) && bigintTyped(node);
    if (ts.isPrefixUnaryExpression(node)) return UNARY_OPS.has(node.operator) && bigintTyped(node);
    if (ts.isPostfixUnaryExpression(node)) return bigintTyped(node.operand);
    return false;
  };

  /** Is this type a branded amount (a bigint carrying a unit brand), or a union containing one? */
  const isBrandedBigint = (t: ts.Type): boolean => {
    if (t.isUnion()) return t.types.some(isBrandedBigint);
    if (!t.isIntersection() || !t.types.some((u) => (u.flags & ts.TypeFlags.BigIntLike) !== 0)) return false;
    return checker.getPropertiesOfType(t).some((prop) => {
      if (!String(prop.escapedName).startsWith('__@amountUnit')) return false;
      const decl = prop.valueDeclaration ?? prop.declarations?.[0];
      return decl !== undefined && (checker.getTypeOfSymbolAtLocation(prop, decl).flags & ts.TypeFlags.StringLiteral) !== 0;
    });
  };
  /** Source of REBRAND-CROSS: a value expression whose type is a branded amount (any unit). */
  const isBrandedValue = (node: ts.Node): boolean =>
    (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isCallExpression(node)) &&
    !ts.isPartOfTypeNode(node) &&
    isBrandedBigint(checker.getTypeAtLocation(node));
  /** Is this the global `BigInt` (not a local shadow)? */
  const isGlobalBigInt = (node: ts.Expression): boolean => {
    if (!ts.isIdentifier(node) || node.text !== 'BigInt') return false;
    const decl = resolve(node)?.declarations?.[0];
    return decl !== undefined && !sources.includes(decl.getSourceFile());
  };
  const isNumberLike = (t: ts.Type): boolean => (t.flags & ts.TypeFlags.NumberLike) !== 0 || (t.isUnion() && t.types.some(isNumberLike));
  /** Source of REBRAND-NUMBER: `BigInt(<number-typed expression>)`, a JS number becoming an integer. */
  const isNumberToBigInt = (node: ts.Node): boolean => {
    if (!ts.isCallExpression(node) || !isGlobalBigInt(node.expression)) return false;
    const arg = node.arguments[0];
    return arg !== undefined && isNumberLike(checker.getTypeAtLocation(arg));
  };

  // --- Taint (one fixpoint per source kind). ---
  const catchBindings: ts.VariableDeclaration[] = [];
  for (const sf of checked) {
    const collect = (n: ts.Node): void => {
      if (ts.isCatchClause(n) && n.variableDeclaration) catchBindings.push(n.variableDeclaration);
      ts.forEachChild(n, collect);
    };
    collect(sf);
  }

  /** Function-like value of an expression: a literal, or a reference to a function declared in a checked file. */
  const functionOf = (expr: ts.Expression): ts.SignatureDeclaration | undefined => {
    let e = expr;
    while (ts.isParenthesizedExpression(e)) e = e.expression;
    if (ts.isArrowFunction(e) || ts.isFunctionExpression(e)) return e;
    const s = resolve(ts.isPropertyAccessExpression(e) ? e.name : e);
    let decl: ts.Node | undefined = s?.valueDeclaration;
    if (decl && (ts.isVariableDeclaration(decl) || ts.isPropertyDeclaration(decl) || ts.isPropertyAssignment(decl))) decl = decl.initializer;
    while (decl && ts.isParenthesizedExpression(decl)) decl = decl.expression;
    if (decl && ts.isFunctionLike(decl) && checkedSet.has(decl.getSourceFile())) return decl;
    return undefined;
  };
  /** Constructors of a class declared in a checked file. */
  const constructorsOf = (expr: ts.Expression): ts.ConstructorDeclaration[] => {
    const cls = resolve(expr)?.valueDeclaration;
    if (!cls || !ts.isClassLike(cls) || !checkedSet.has(cls.getSourceFile())) return [];
    return cls.members.filter(ts.isConstructorDeclaration);
  };
  /** Return and yield expressions of a function-like declaration (nested functions included, conservatively). */
  const outputsOf = (fn: ts.SignatureDeclaration): ts.Node[] => {
    if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) return [fn.body];
    const out: ts.Node[] = [];
    const walk = (n: ts.Node): void => {
      if ((ts.isReturnStatement(n) || ts.isYieldExpression(n)) && n.expression) out.push(n.expression);
      ts.forEachChild(n, walk);
    };
    const body = (fn as { body?: ts.Node }).body;
    if (body) walk(body);
    return out;
  };
  const unparen = (e: ts.Expression): ts.Expression => {
    let x = e;
    while (ts.isParenthesizedExpression(x)) x = x.expression;
    return x;
  };
  const methodCall = (callee: ts.Expression, names: readonly string[]): ts.Expression | undefined => {
    const c = unparen(callee);
    return ts.isPropertyAccessExpression(c) && names.includes(c.name.text) ? c.expression : undefined;
  };

  /** Run the taint fixpoint for one kind of source; returns "is this expression tainted?". */
  const computeTaint = (isSource: (n: ts.Node) => boolean): ((expr: ts.Node) => boolean) => {
    const tainted = new Set<ts.Symbol>();
    const isTainted = (expr: ts.Node): boolean => {
      let hit = false;
      const walk = (n: ts.Node): void => {
        if (hit) return;
        if (isSource(n)) {
          hit = true;
          return;
        }
        if (ts.isIdentifier(n)) {
          const s = resolve(n);
          if (s && tainted.has(s)) {
            hit = true;
            return;
          }
        }
        ts.forEachChild(n, walk);
      };
      walk(expr);
      return hit;
    };

    let changed = false;
    const taintSymbol = (s: ts.Symbol | undefined): void => {
      if (s && !tainted.has(s)) {
        tainted.add(s);
        changed = true;
      }
    };
    /** Every name bound by a declaration name or binding pattern. */
    const taintBinding = (name: ts.BindingName): void => {
      if (ts.isIdentifier(name)) taintSymbol(resolve(name));
      else for (const el of name.elements) if (!ts.isOmittedExpression(el)) taintBinding(el.name);
    };
    const taintParams = (fn: ts.SignatureDeclaration, argTainted: readonly boolean[] | 'all'): void => {
      fn.parameters.forEach((param, i) => {
        const hit = argTainted === 'all' || (param.dotDotDotToken ? argTainted.slice(i).some(Boolean) : argTainted[i] === true);
        if (hit) taintBinding(param.name);
      });
    };
    /** A written property: the property symbol, and the parameter of every setter declared for it in src. */
    const taintProperty = (s: ts.Symbol | undefined): void => {
      taintSymbol(s);
      for (const decl of s?.declarations ?? []) {
        if (ts.isSetAccessorDeclaration(decl) && checkedSet.has(decl.getSourceFile())) taintParams(decl, 'all');
      }
    };
    /** The root variable of a property or element chain (`a` in `a.b[c].d`); property names on the way are tainted too. */
    const taintRoot = (expr: ts.Expression): void => {
      let e: ts.Expression = expr;
      while (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e) || ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isCallExpression(e)) {
        if (ts.isPropertyAccessExpression(e)) taintProperty(resolve(e.name));
        if (ts.isElementAccessExpression(e)) taintProperty(checker.getSymbolAtLocation(e.argumentExpression) ?? checker.getSymbolAtLocation(e));
        e = e.expression;
      }
      if (ts.isIdentifier(e)) taintSymbol(resolve(e));
    };
    /** The written targets of an assignment's left side: identifiers, properties (and their roots and setters), elements, destructuring. */
    const taintTarget = (target: ts.Expression): void => {
      if (ts.isParenthesizedExpression(target) || ts.isNonNullExpression(target)) {
        taintTarget(target.expression);
      } else if (ts.isIdentifier(target)) {
        taintSymbol(resolve(target));
      } else if (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)) {
        taintRoot(target);
      } else if (ts.isArrayLiteralExpression(target)) {
        for (const el of target.elements) taintTarget(ts.isSpreadElement(el) ? el.expression : el);
      } else if (ts.isObjectLiteralExpression(target)) {
        for (const p of target.properties) {
          if (ts.isShorthandPropertyAssignment(p)) taintSymbol(resolve(p.name));
          else if (ts.isPropertyAssignment(p)) taintTarget(p.initializer);
          else if (ts.isSpreadAssignment(p)) taintTarget(p.expression);
        }
      } else if (ts.isBinaryExpression(target) && target.operatorToken.kind === K.EqualsToken) {
        taintTarget(target.left);
      }
    };
    /** Arguments into a callee: its own parameters, plus `f.call`, `f.apply`, `f.bind(...)()` and `Reflect.apply` forwarding. */
    const taintCall = (callee: ts.Expression, args: readonly ts.Expression[], argTainted: readonly boolean[]): void => {
      const direct = functionOf(callee);
      if (direct) taintParams(direct, argTainted);
      const viaCall = methodCall(callee, ['call', 'bind']);
      const viaCallFn = viaCall && functionOf(viaCall);
      if (viaCallFn) taintParams(viaCallFn, argTainted.slice(1));
      const viaApply = methodCall(callee, ['apply']);
      const viaApplyFn = viaApply && functionOf(viaApply);
      if (viaApplyFn && argTainted[1] === true) taintParams(viaApplyFn, 'all');
      const inner = unparen(callee);
      if (ts.isCallExpression(inner)) {
        const bound = methodCall(inner.expression, ['bind']);
        const boundFn = bound && functionOf(bound);
        if (boundFn && argTainted.some(Boolean)) taintParams(boundFn, 'all');
      }
      const reflect = unparen(callee);
      if (ts.isPropertyAccessExpression(reflect) && ts.isIdentifier(reflect.expression) && reflect.expression.text === 'Reflect' && reflect.name.text === 'apply') {
        const target = args[0] && functionOf(args[0]);
        if (target && argTainted[2] === true) taintParams(target, 'all');
      }
    };

    do {
      changed = false;
      for (const sf of checked) {
        const visit = (n: ts.Node): void => {
          if ((ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isBindingElement(n)) && n.initializer && isTainted(n.initializer)) taintBinding(n.name);
          if (ts.isPropertyDeclaration(n) && n.initializer && isTainted(n.initializer)) taintSymbol(resolve(n.name));
          if (ts.isBinaryExpression(n)) {
            const op = n.operatorToken.kind;
            if ((op === K.EqualsToken || COMPOUND_OPS.has(op)) && (isTainted(n.right) || isSource(n))) taintTarget(n.left);
          }
          if ((ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) && (n.operator === K.PlusPlusToken || n.operator === K.MinusMinusToken)) {
            if (isSource(n) || isTainted(n.operand)) taintTarget(n.operand);
          }
          if ((ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n) || ts.isGetAccessorDeclaration(n)) && n.name && outputsOf(n).some(isTainted)) {
            taintSymbol(resolve(n.name));
          }
          if (ts.isTaggedTemplateExpression(n)) {
            const spans = ts.isTemplateExpression(n.template) ? n.template.templateSpans.map((sp) => sp.expression) : [];
            const fn = functionOf(n.tag);
            if (fn) taintParams(fn, [false, ...spans.map((e) => isTainted(e))]);
          }
          if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
            const args: readonly ts.Expression[] = n.arguments ?? [];
            const argTainted = args.map((a) => isTainted(a));
            taintCall(n.expression, args, argTainted);
            if (ts.isNewExpression(n)) for (const ctor of constructorsOf(n.expression)) taintParams(ctor, argTainted);
            const receiver = ts.isPropertyAccessExpression(n.expression) || ts.isElementAccessExpression(n.expression) ? n.expression.expression : undefined;
            const anyArg = argTainted.some(Boolean);
            if (anyArg && receiver) taintRoot(receiver);
            if (anyArg || (receiver !== undefined && isTainted(receiver))) {
              for (const a of args) {
                const fn = functionOf(a);
                if (fn) taintParams(fn, 'all');
              }
            }
          }
          if ((ts.isForOfStatement(n) || ts.isForInStatement(n)) && isTainted(n.expression)) {
            const init = n.initializer;
            if (ts.isVariableDeclarationList(init)) for (const d of init.declarations) taintBinding(d.name);
            else taintTarget(init);
          }
          if (ts.isThrowStatement(n) && isTainted(n.expression)) for (const d of catchBindings) taintBinding(d.name);
          if (ts.isExportAssignment(n) && isTainted(n.expression)) {
            taintSymbol(checker.getSymbolAtLocation(sf)?.exports?.get(ts.escapeLeadingUnderscores('default')));
          }
          ts.forEachChild(n, visit);
        };
        visit(sf);
      }
    } while (changed);
    return isTainted;
  };

  const isTainted = computeTaint(isArithmetic);
  const isBrandDerived = computeTaint(isBrandedValue);
  const isNumberDerived = computeTaint(isNumberToBigInt);

  // --- Findings. ---
  const findings: RebrandFinding[] = [];
  const isAnyType = (t: ts.Type): boolean => (t.flags & ts.TypeFlags.Any) !== 0;
  for (const sf of checked) {
    const report = (node: ts.Node, rule: RebrandRule): void => {
      findings.push({ file: rel(sf), line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, rule, text: node.getText(sf).slice(0, 120) });
    };
    const ambient = (n: ts.Declaration): boolean => sf.isDeclarationFile || (ts.getCombinedModifierFlags(n) & ts.ModifierFlags.Ambient) !== 0;
    const visit = (n: ts.Node): void => {
      if (ts.isCallExpression(n)) {
        let callee: ts.Expression = n.expression;
        while (ts.isParenthesizedExpression(callee)) callee = callee.expression;
        const target = ts.isPropertyAccessExpression(callee) ? callee.name : callee;
        if (isCtor(target) && n.arguments.some(isTainted)) report(n, 'REBRAND-ARITH');
        if (isCtor(target) && n.arguments.some(isBrandDerived)) report(n, 'REBRAND-CROSS');
        if (isCtor(target) && n.arguments.some(isNumberDerived)) report(n, 'REBRAND-NUMBER');
        if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
          const writers = REFLECT_WRITERS.get(callee.expression.text);
          const first = n.arguments[0];
          if (writers?.has(callee.name.text) && first && mayCarryBrand(checker.getTypeAtLocation(first))) report(n, 'REBRAND-REFLECT');
        }
      }
      // `as const` only narrows literals; it cannot add a brand the value does not already carry.
      if ((ts.isAsExpression(n) || ts.isTypeAssertionExpression(n)) && !ts.isConstTypeReference(n.type) && mayCarryBrand(checker.getTypeFromTypeNode(n.type))) {
        report(n, 'REBRAND-CAST');
      }
      if (n.kind === K.AnyKeyword) report(n, 'REBRAND-ANY');
      if (ts.isExpression(n) && !ts.isPartOfTypeNode(n) && !ts.isParenthesizedExpression(n.parent) && isAnyType(checker.getTypeAtLocation(n))) {
        const isDeclName = ts.isIdentifier(n) && (n.parent as { name?: ts.Node }).name === n && !ts.isPropertyAccessExpression(n.parent);
        const ctx = isDeclName ? undefined : checker.getContextualType(n);
        if (ctx && !isAnyType(ctx) && mayCarryBrand(ctx)) report(n, 'REBRAND-ANY');
      }
      if (ts.isFunctionLike(n) && !n.type && (n as { body?: ts.Node }).body && !ts.isConstructorDeclaration(n) && !ts.isSetAccessorDeclaration(n)) {
        const sig = checker.getSignatureFromDeclaration(n);
        if (sig) {
          const ret = checker.getReturnTypeOfSignature(sig);
          const awaited = checker.getAwaitedType(ret);
          if (isAnyType(ret) || (awaited !== undefined && isAnyType(awaited))) report(n, 'REBRAND-ANY');
        }
      }
      if (ts.isTypePredicateNode(n) && n.type && mayCarryBrand(checker.getTypeFromTypeNode(n.type))) report(n, 'REBRAND-GUARD');
      if ((ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) && !n.body && (ts.getCombinedModifierFlags(n) & ts.ModifierFlags.Abstract) === 0) {
        const sig = checker.getSignatureFromDeclaration(n);
        if (sig && mayCarryBrand(checker.getReturnTypeOfSignature(sig))) report(n, 'REBRAND-SIGNATURE');
      }
      if ((ts.isVariableDeclaration(n) || ts.isPropertyDeclaration(n)) && ambient(n) && mayCarryBrand(checker.getTypeAtLocation(n.name))) {
        report(n, 'REBRAND-SIGNATURE');
      }
      if (ts.isIdentifier(n) && LIBRARY_UNIT_CONVERTERS.has(n.text) && !ts.isPartOfTypeNode(n)) {
        const decl = resolve(n)?.declarations?.[0];
        const declared = decl?.getSourceFile();
        if (declared === undefined || !sources.includes(declared)) report(n.parent, 'REBRAND-LIBCONV');
      }
      if (ts.isIdentifier(n) && isCtor(n)) {
        const p = n.parent;
        const nameOfAccess = ts.isPropertyAccessExpression(p) && p.name === n;
        let use: ts.Node = nameOfAccess ? p : n;
        while (ts.isParenthesizedExpression(use.parent)) use = use.parent;
        const isCallee = ts.isCallExpression(use.parent) && use.parent.expression === use;
        const isBinding = ts.isImportSpecifier(p) || ts.isExportSpecifier(p) || ts.isImportClause(p);
        if (!isCallee && !isBinding) report(nameOfAccess ? p : n, 'REBRAND-ALIAS');
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return findings;
}
