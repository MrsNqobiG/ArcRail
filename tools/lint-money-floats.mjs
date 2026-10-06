#!/usr/bin/env node
/**
 * MC-01 lint: no floating point on a money path (RUBRIC MC-01, CLAUDE.md
 * "Integer arithmetic only"). Type-aware and authoritative: it runs the
 * TypeScript checker over exactly the paths listed in docs/MONEY_PATH.md.
 * (The Semgrep layer, tools/semgrep/mc01-money-float.yml, is a syntactic
 * second layer; both run in CI and both must be clean.)
 *
 * Rules (each finding fails the lint):
 *   MC01-number-call      `Number`, `parseFloat`, `parseInt`, however reached: bare, `X.Number`,
 *                         `X['Number']`, destructured, passed as a value
 *   MC01-math             `Math`, however reached (`Math.floor`, `globalThis.Math`, `X['Math']`)
 *   MC01-global-object    `globalThis`, `global`, `window`, `self`, `Reflect`, `Function`, `eval`
 *                         (dynamic routes to the globals above)
 *   MC01-json-parse       `JSON.parse` or any `JSON` use other than a direct `JSON.stringify(...)` call
 *   MC01-to-fixed         `.toFixed`, `.toPrecision`, `.toExponential`
 *   MC01-float-literal    a numeric literal with a decimal point or an exponent (`1.5`, `.5`, `1e-6`)
 *   MC01-unary-plus       prefix `+` (ToNumber), on anything
 *   MC01-non-bigint-div   `/` or `/=` with a non-bigint operand
 *   MC01-non-bigint-pow   `**` or `**=` with a non-bigint operand
 *   MC01-non-bigint-arith `+ - * %` (and compound forms, `++`, `--`, unary `-`) with a non-bigint operand
 *   MC01-non-bigint-bitwise `| & ^ << >> >>> ~` (and compound forms) with a non-bigint operand
 *   MC01-bigint-from-number `BigInt(x)` where `x` is number-typed
 *   MC01-number-type      the "grep for float types": a declaration (variable, parameter, property,
 *                         type alias, function return, binding) whose declared or inferred type
 *                         contains `number`
 *   MC01-number-expr      any expression whose type contains `number` (or `any`), wherever that type
 *                         was declared (a listed path, an excluded module, a library, `lib.d.ts`)
 *   MC01-number-assertion `as T`, `<T>x` or `satisfies T` where T contains `number`
 *   MC01-json-parse       also `.json` (Response/Body `.json()` is JSON.parse), however reached
 *   MC01-constructor      `.constructor`, however reached (it reaches Number and Function unnamed)
 *   MC01-any              an explicit `any` type (it would hide a number from every rule above)
 *
 * Allow-list. `number` is legitimate on a money path only for non-amounts: the
 * chain ID, RPC error codes and the CBS precision p. Each is named, one by one,
 * in the "Number allow-list" table of docs/MONEY_PATH.md as (declaring file,
 * declaration identity). The identity names one declaration node, never a name:
 *   `Name`        a top-level declaration of the file (type alias, interface,
 *                 class, function, or a module-scope `const`);
 *   `Outer.member` a member of a top-level interface, class or type alias
 *                 (including members of the alias's union/intersection members);
 *   `fn(i)`       parameter number i (0-based) of top-level function `fn`
 *                 (or of method `Outer.m(i)`).
 * Locals, binding elements and object-literal members have no identity, so
 * they can never be allow-listed. Every row must resolve to exactly one
 * declaration in its file, or the lint throws (fails closed).
 * An allow-listed declaration may carry a `number` type (MC01-number-type).
 * An allow-listed TYPE ALIAS is a brand: a declaration or expression whose type
 * is that alias (exactly, not a union with it) is exempt too, and `x as Brand`
 * is allowed only when x is itself allowed. An expression built only from
 * allow-listed references and integer literals with + - * % or bitwise
 * operators (never `/` or `**`) may be an operand or a `BigInt(...)` argument.
 * Nothing else is exempt.
 *
 * Exempt by construction (not floats): string concatenation with `+` when
 * every operand is a string or bigint; unary `-` applied directly to an
 * integer literal (a negative literal); an integer literal; `.length` of a
 * string, array or tuple (an integer by definition; MC01-number-expr only, so
 * it can be compared, but every arithmetic, bitwise and `BigInt(...)` rule
 * still flags it); index types such as `X[number]` and `X[0]`; a `${number}`
 * hole inside a template literal *string* type (its values are strings, and
 * turning one into a number needs an operation that the rules above catch).
 *
 * Compiler view: the repository tsconfig.json (lib ES2023, types node), so the
 * lint sees the same types tsc does (Response.json() is `unknown`, not `any`).
 *
 * Usage: node tools/lint-money-floats.mjs [--root <dir>]   (exit 1 on findings)
 */
import { existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { readMoneyPath } from './money-path.mjs';

const NAME_RULES = new Map([
  ['Number', 'MC01-number-call'],
  ['parseFloat', 'MC01-number-call'],
  ['parseInt', 'MC01-number-call'],
  ['Math', 'MC01-math'],
]);
const GLOBAL_OBJECTS = new Set(['globalThis', 'global', 'window', 'self', 'Reflect', 'Function', 'eval']);
const FLOAT_METHODS = new Set(['toFixed', 'toPrecision', 'toExponential']);

const K = ts.SyntaxKind;
const DIV = new Set([K.SlashToken, K.SlashEqualsToken]);
const POW = new Set([K.AsteriskAsteriskToken, K.AsteriskAsteriskEqualsToken]);
const ARITH = new Set([K.PlusToken, K.PlusEqualsToken, K.MinusToken, K.MinusEqualsToken, K.AsteriskToken, K.AsteriskEqualsToken, K.PercentToken, K.PercentEqualsToken]);
const BITWISE = new Set([
  K.BarToken, K.BarEqualsToken, K.AmpersandToken, K.AmpersandEqualsToken, K.CaretToken, K.CaretEqualsToken,
  K.LessThanLessThanToken, K.LessThanLessThanEqualsToken, K.GreaterThanGreaterThanToken, K.GreaterThanGreaterThanEqualsToken,
  K.GreaterThanGreaterThanGreaterThanToken, K.GreaterThanGreaterThanGreaterThanEqualsToken,
]);

/** bigint, a bigint literal, a branded bigint (`bigint & {…}`), or a union/type parameter of those. */
function isBigIntLike(checker, t) {
  if ((t.flags & ts.TypeFlags.BigIntLike) !== 0) return true;
  if (t.isUnion()) return t.types.every((u) => isBigIntLike(checker, u));
  if (t.isIntersection()) return t.types.some((u) => (u.flags & ts.TypeFlags.BigIntLike) !== 0);
  if ((t.flags & ts.TypeFlags.TypeParameter) !== 0) {
    const c = checker.getBaseConstraintOfType(t);
    return c !== undefined && c !== t && isBigIntLike(checker, c);
  }
  return false;
}

function isStringLike(t) {
  if ((t.flags & ts.TypeFlags.StringLike) !== 0) return true;
  if (t.isUnion()) return t.types.every((u) => isStringLike(u));
  if (t.isIntersection()) return t.types.some((u) => (u.flags & ts.TypeFlags.StringLike) !== 0);
  return false;
}

/** Does this type contain `number` (directly, in a union/intersection, an array element or a template hole)? */
function containsNumber(checker, t, seen = new Set()) {
  if (seen.has(t)) return false;
  seen.add(t);
  if ((t.flags & (ts.TypeFlags.NumberLike | ts.TypeFlags.Any)) !== 0) return true;
  if (t.isUnionOrIntersection()) return t.types.some((u) => containsNumber(checker, u, seen));
  if (checker.isArrayType(t) || checker.isTupleType(t)) return checker.getTypeArguments(t).some((u) => containsNumber(checker, u, seen));
  return false;
}

/** Is this identifier a value reference (not a property name, declaration name or type)? */
function isValueReference(id) {
  const p = id.parent;
  if (!p) return false;
  if (ts.isPropertyAccessExpression(p) && p.name === id) return false;
  if ((ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p) || ts.isPropertySignature(p) || ts.isMethodDeclaration(p) || ts.isMethodSignature(p)) && p.name === id) return false;
  if (ts.isTypeReferenceNode(p) || ts.isQualifiedName(p) || (ts.isExpressionWithTypeArguments(p) && ts.isHeritageClause(p.parent))) return false;
  if (ts.isImportSpecifier(p) || ts.isExportSpecifier(p)) return false;
  if (ts.isBindingElement(p) && p.propertyName === id) return false;
  if ((ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isFunctionDeclaration(p) || ts.isClassDeclaration(p) || ts.isBindingElement(p)) && p.name === id) return false;
  if ((ts.isTypeAliasDeclaration(p) || ts.isInterfaceDeclaration(p) || ts.isTypeParameterDeclaration(p)) && p.name === id) return false;
  return true;
}

/** Unwrap parentheses, `as`, `satisfies` and `!` around an initializer. */
function skipOuter(n) {
  let p = n;
  while (p && (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isSatisfiesExpression(p) || ts.isNonNullExpression(p))) p = p.parent;
  return p;
}

const TYPE_WRAPPERS = (n) =>
  ts.isTypeLiteralNode(n) || ts.isUnionTypeNode(n) || ts.isIntersectionTypeNode(n) || ts.isParenthesizedTypeNode(n) || (ts.isTypeOperatorNode(n) && n.operator === K.ReadonlyKeyword);

/**
 * The identity of a declaration node (see the header): `Name`, `Outer.member`
 * or `fn(i)`. Null for anything that can't be allow-listed (locals, binding
 * elements, object-literal members, anonymous functions not bound to a
 * module-scope `const`).
 */
export function declId(node) {
  if (!node) return null;
  const top = (n) => n.parent !== undefined && ts.isSourceFile(n.parent);
  const nameOf = (n) => (n.name && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name) || ts.isPrivateIdentifier(n.name)) ? n.name.text : null);
  if (ts.isParameter(node)) {
    const owner = node.parent;
    const id = ts.isFunctionLike(owner) ? declId(owner) : null;
    return id === null ? null : `${id}(${owner.parameters.indexOf(node)})`;
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    const p = skipOuter(node.parent);
    return p && ts.isVariableDeclaration(p) && p.initializer && skipOuter(node.parent) === p ? declId(p) : null;
  }
  if (ts.isVariableDeclaration(node)) {
    const stmt = node.parent?.parent;
    return stmt && ts.isVariableStatement(stmt) && top(stmt) && ts.isIdentifier(node.name) ? node.name.text : null;
  }
  if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) {
    return top(node) ? nameOf(node) : null;
  }
  if (ts.isPropertySignature(node) || ts.isMethodSignature(node) || ts.isPropertyDeclaration(node) || ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node)) {
    const name = nameOf(node);
    let p = node.parent;
    while (p && TYPE_WRAPPERS(p)) p = p.parent;
    if (!p || name === null) return null;
    if (ts.isInterfaceDeclaration(p) || ts.isClassDeclaration(p) || ts.isTypeAliasDeclaration(p) || ts.isPropertySignature(p) || ts.isPropertyDeclaration(p)) {
      const outer = declId(p);
      return outer === null ? null : `${outer}.${name}`;
    }
    return null;
  }
  return null;
}

function compilerOptions() {
  // The repository's own tsconfig (this tool's repo), so the lint and tsc see the same types.
  const toolRoot = fileURLToPath(new URL('..', import.meta.url));
  const cfgPath = join(toolRoot, 'tsconfig.json');
  const read = ts.readConfigFile(cfgPath, ts.sys.readFile);
  if (read.error) throw new Error(`MC-01 lint: cannot read ${cfgPath}`);
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, toolRoot, undefined, cfgPath);
  return { ...parsed.options, noEmit: true, typeRoots: [join(toolRoot, 'node_modules/@types')] };
}

export function lintMoneyFloats(root = process.cwd()) {
  const absRoot = resolve(root);
  const { paths, numberAllow } = readMoneyPath(absRoot);
  const allowed = new Set(numberAllow.map((a) => `${a.path}#${a.decl}`));
  const files = paths.map((p) => join(absRoot, p));
  const missing = files.filter((f) => !existsSync(f));
  if (missing.length > 0) throw new Error(`MC-01 lint: listed money-path file(s) missing: ${missing.join(', ')}`);
  const program = ts.createProgram(files, compilerOptions());
  const checker = program.getTypeChecker();
  const relOf = (fileName) => relative(absRoot, fileName).split('\\').join('/');
  const idOf = (decl) => {
    const id = declId(decl);
    return id === null ? null : `${relOf(decl.getSourceFile().fileName)}#${id}`;
  };
  const isAllowedDecl = (decl) => {
    const id = idOf(decl);
    return id !== null && allowed.has(id);
  };

  // Every allow-list row must name exactly one declaration node (fail closed).
  const matches = new Map([...allowed].map((k) => [k, 0]));
  for (const file of files) {
    const walk = (n) => {
      const id = idOf(n);
      if (id !== null && matches.has(id)) matches.set(id, matches.get(id) + 1);
      ts.forEachChild(n, walk);
    };
    walk(program.getSourceFile(file));
  }
  const bad = [...matches].filter(([, c]) => c !== 1);
  if (bad.length > 0) {
    throw new Error(`MC-01 lint: Number allow-list row(s) must each name exactly one declaration: ${bad.map(([k, c]) => `${k} (${c})`).join(', ')}`);
  }

  /** An allow-listed brand: the type is exactly a reference to an allow-listed type alias. */
  const isAllowedBrand = (t) => (t.aliasSymbol?.declarations ?? []).some((d) => ts.isTypeAliasDeclaration(d) && isAllowedDecl(d));
  const typeOf = (expr) => checker.getTypeAtLocation(expr);

  /** An operand that is a reference to an allow-listed declaration, or of an allow-listed brand type. */
  const isAllowedRef = (expr) => {
    let e = expr;
    while (ts.isParenthesizedExpression(e)) e = e.expression;
    if (isAllowedBrand(typeOf(e)) && (ts.isIdentifier(e) || ts.isPropertyAccessExpression(e) || ts.isCallExpression(e))) return true;
    if (!ts.isIdentifier(e) && !ts.isPropertyAccessExpression(e)) return false;
    const sym = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(e) ? e.name : e);
    const decls = sym?.declarations ?? [];
    return decls.length > 0 && decls.every((d) => isAllowedDecl(d));
  };
  const isIntLiteral = (expr) => ts.isNumericLiteral(expr) && /^(0[xXbBoO][0-9a-fA-F_]+|[0-9][0-9_]*)$/.test(expr.text);
  const isNegIntLiteral = (expr) => ts.isPrefixUnaryExpression(expr) && expr.operator === K.MinusToken && isIntLiteral(expr.operand);

  /**
   * A number-valued expression built only from allow-listed references and
   * integer literals with + - * % and bitwise operators (no `/`, no `**`),
   * containing at least one allow-listed reference.
   */
  const isAllowedNumberExpr = (expr) => {
    let e = expr;
    while (ts.isParenthesizedExpression(e)) e = e.expression;
    const refs = [];
    const ok = (x) => {
      let y = x;
      while (ts.isParenthesizedExpression(y)) y = y.expression;
      if (isAllowedRef(y)) {
        refs.push(y);
        return true;
      }
      if (isIntLiteral(y) || isNegIntLiteral(y)) return true;
      if (ts.isBinaryExpression(y) && (ARITH.has(y.operatorToken.kind) || BITWISE.has(y.operatorToken.kind))) return ok(y.left) && ok(y.right);
      return false;
    };
    return ok(e) && refs.length > 0;
  };

  /** `.length` of a string, array or tuple: an integer by definition. */
  const isLengthRead = (expr) => {
    if (!ts.isPropertyAccessExpression(expr) || expr.name.text !== 'length') return false;
    const t = checker.getApparentType(typeOf(expr.expression));
    const parts = t.isUnion() ? t.types : [t];
    return parts.every((u) => isStringLike(u) || checker.isArrayType(u) || checker.isTupleType(u) || checker.getApparentType(u).getSymbol()?.getName() === 'String');
  };

  /** Every operand acceptable: all bigint; or string concatenation; or an allowed number expression. */
  const operandsOk = (operands, op) => {
    if (operands.every((o) => isBigIntLike(checker, typeOf(o)))) return true;
    if (op === K.PlusToken || op === K.PlusEqualsToken) {
      const ts_ = operands.map(typeOf);
      if (ts_.some(isStringLike) && ts_.every((t) => isStringLike(t) || isBigIntLike(checker, t))) return true;
    }
    return operands.some(isAllowedNumberExpr) && operands.every((o) => isAllowedNumberExpr(o) || isIntLiteral(o));
  };

  /** Expression kinds checked by MC01-number-expr (a value is produced here). */
  const isCheckedExpr = (n) =>
    (ts.isIdentifier(n) && isValueReference(n) && !ts.isTypeQueryNode(n.parent)) ||
    ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n) || ts.isCallExpression(n) || ts.isNewExpression(n) ||
    ts.isAwaitExpression(n) || ts.isTaggedTemplateExpression(n) || ts.isAsExpression(n) || ts.isTypeAssertionExpression(n) ||
    ts.isSatisfiesExpression(n) || ts.isNonNullExpression(n) || ts.isConditionalExpression(n) || ts.isPrefixUnaryExpression(n) ||
    ts.isPostfixUnaryExpression(n) || ts.isBinaryExpression(n) || ts.isVoidExpression(n);

  const findings = [];
  for (const file of files) {
    const sf = program.getSourceFile(file);
    if (!sf) throw new Error(`MC-01 lint: cannot load ${file}`);
    const rel = relOf(file);
    const report = (node, rule, detail) => {
      const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      findings.push({ file: rel, line: line + 1, col: character + 1, rule, text: (detail ?? node.getText(sf)).slice(0, 120) });
    };
    const checkDeclType = (decl, typeNode) => {
      if (isAllowedDecl(decl)) return;
      let t;
      if (ts.isFunctionLike(decl)) {
        const sig = checker.getSignatureFromDeclaration(decl);
        if (!sig) return;
        t = checker.getReturnTypeOfSignature(sig);
      } else if (ts.isTypeAliasDeclaration(decl)) {
        t = checker.getTypeAtLocation(decl.name);
      } else {
        t = checker.getTypeAtLocation(decl.name ?? decl);
      }
      if (isAllowedBrand(t)) return;
      const syntactic = typeNode !== undefined && hasNumberTypeNode(typeNode);
      if (syntactic || containsNumber(checker, t)) {
        report(decl.name ?? decl, 'MC01-number-type', `${declId(decl) ?? decl.name?.getText(sf) ?? '<anonymous>'}: ${checker.typeToString(t)}`);
      }
    };
    const visit = (node) => {
      // names reached however: bare, X.Name, X['Name']
      if (ts.isIdentifier(node) && isValueReference(node)) {
        if (NAME_RULES.has(node.text)) report(node, NAME_RULES.get(node.text), node.parent.getText(sf));
        if (GLOBAL_OBJECTS.has(node.text)) report(node, 'MC01-global-object', node.parent.getText(sf));
        if (node.text === 'JSON') {
          const p = node.parent;
          const directStringify = ts.isPropertyAccessExpression(p) && p.expression === node && p.name.text === 'stringify' && ts.isCallExpression(p.parent) && p.parent.expression === p;
          if (!directStringify) report(node, 'MC01-json-parse', p.getText(sf));
        }
      }
      if (ts.isPropertyAccessExpression(node)) {
        const n = node.name.text;
        if (NAME_RULES.has(n)) report(node, NAME_RULES.get(n));
        if (FLOAT_METHODS.has(n)) report(node, 'MC01-to-fixed');
        if (n === 'JSON' || n === 'json') report(node, 'MC01-json-parse');
        if (n === 'constructor') report(node, 'MC01-constructor');
      }
      if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
        const n = node.argumentExpression.text;
        if (NAME_RULES.has(n)) report(node, NAME_RULES.get(n));
        if (FLOAT_METHODS.has(n)) report(node, 'MC01-to-fixed');
        if (n === 'JSON' || n === 'parse' || n === 'json') report(node, 'MC01-json-parse');
        if (n === 'constructor') report(node, 'MC01-constructor');
      }
      if (ts.isBindingElement(node)) {
        const key = node.propertyName ?? node.name;
        if (ts.isIdentifier(key) || ts.isStringLiteral(key)) {
          if (NAME_RULES.has(key.text)) report(node, NAME_RULES.get(key.text));
          if (FLOAT_METHODS.has(key.text)) report(node, 'MC01-to-fixed');
          if (key.text === 'json' || key.text === 'parse') report(node, 'MC01-json-parse');
          if (key.text === 'constructor') report(node, 'MC01-constructor');
        }
      }
      if (ts.isNumericLiteral(node)) {
        const raw = node.getText(sf);
        if (!/^0[xXbBoO]/.test(raw) && /[.eE]/.test(raw)) report(node, 'MC01-float-literal');
      }
      if (ts.isPrefixUnaryExpression(node)) {
        const op = node.operator;
        if (op === K.PlusToken) report(node, 'MC01-unary-plus');
        else if (op === K.MinusToken) {
          if (!isIntLiteral(node.operand) && !operandsOk([node.operand], op)) report(node, 'MC01-non-bigint-arith');
        } else if (op === K.TildeToken) {
          if (!operandsOk([node.operand], op)) report(node, 'MC01-non-bigint-bitwise');
        } else if ((op === K.PlusPlusToken || op === K.MinusMinusToken) && !operandsOk([node.operand], op)) {
          report(node, 'MC01-non-bigint-arith');
        }
      }
      if (ts.isPostfixUnaryExpression(node) && !operandsOk([node.operand], node.operator)) report(node, 'MC01-non-bigint-arith');
      if (ts.isBinaryExpression(node)) {
        const op = node.operatorToken.kind;
        const ok = () => operandsOk([node.left, node.right], op);
        // `/` and `**` get no allow-list exemption: bigint operands only.
        const bigintOnly = () => isBigIntLike(checker, typeOf(node.left)) && isBigIntLike(checker, typeOf(node.right));
        if (DIV.has(op) && !bigintOnly()) report(node, 'MC01-non-bigint-div');
        else if (POW.has(op) && !bigintOnly()) report(node, 'MC01-non-bigint-pow');
        else if (ARITH.has(op) && !ok()) report(node, 'MC01-non-bigint-arith');
        else if (BITWISE.has(op) && !ok()) report(node, 'MC01-non-bigint-bitwise');
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'BigInt') {
        for (const arg of node.arguments) {
          const t = typeOf(arg);
          if (containsNumber(checker, t) && !isAllowedNumberExpr(arg) && !isIntLiteral(arg)) report(node, 'MC01-bigint-from-number');
        }
      }
      // `as number`, `<number>x`, `satisfies number` (and any asserted type containing number)
      if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node)) {
        const tn = node.type;
        if (!ts.isConstTypeReference(tn)) {
          const target = checker.getTypeFromTypeNode(tn);
          const brandOk = isAllowedBrand(target) && (isAllowedRef(node.expression) || isAllowedNumberExpr(node.expression));
          if (!brandOk && (hasNumberTypeNode(tn, true) || containsNumber(checker, target))) report(node, 'MC01-number-assertion');
        }
      }
      // any value of type number, wherever its type was declared
      if (isCheckedExpr(node)) {
        const t = typeOf(node);
        if (
          containsNumber(checker, t) && !isAllowedBrand(t) && !isAllowedRef(node) && !isAllowedNumberExpr(node) &&
          !isNegIntLiteral(node) && !isLengthRead(node)
        ) {
          report(node, 'MC01-number-expr', `${node.getText(sf)}: ${checker.typeToString(t)}`);
        }
      }
      if (node.kind === K.AnyKeyword) report(node, 'MC01-any');
      // the "grep for float types"
      if (
        ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isPropertySignature(node) || ts.isPropertyDeclaration(node) ||
        ts.isBindingElement(node) || ts.isTypeAliasDeclaration(node) || ts.isGetAccessorDeclaration(node)
      ) {
        checkDeclType(node, node.type);
      } else if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isMethodSignature(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
        checkDeclType(node, node.type);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return { files: paths.length, findings };
}

/**
 * Syntactic: a `number` keyword or numeric literal type anywhere in this type
 * node (not as `X[number]`). `deep` also enters nested member and parameter
 * declarations (used for assertions, whose members are not declarations).
 */
function hasNumberTypeNode(typeNode, deep = false) {
  let found = false;
  const walk = (n) => {
    if (found) return;
    // Nested declarations (members, parameters) are checked as declarations of their own.
    if (!deep && n !== typeNode && (ts.isPropertySignature(n) || ts.isMethodSignature(n) || ts.isParameter(n) || ts.isPropertyDeclaration(n))) return;
    // `X[number]` / `X[0]`: an index, not a value of type number.
    if (n.parent && ts.isIndexedAccessTypeNode(n.parent) && n.parent.indexType === n) return;
    // `${number}` inside a template literal type: a string format, not a number.
    if (ts.isTemplateLiteralTypeSpan(n)) return;
    if (n.kind === K.NumberKeyword) {
      found = true;
      return;
    }
    if (ts.isLiteralTypeNode(n) && (ts.isNumericLiteral(n.literal) || ts.isPrefixUnaryExpression(n.literal))) {
      found = true;
      return;
    }
    ts.forEachChild(n, walk);
  };
  walk(typeNode);
  return found;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--root');
  const root = i > 0 ? process.argv[i + 1] : process.cwd();
  const { files, findings } = lintMoneyFloats(root);
  for (const f of findings) console.log(`${f.file}:${f.line}:${f.col} ${f.rule} ${f.text}`);
  console.log(`MC-01 lint: ${files} money-path files, ${findings.length} finding(s)`);
  process.exit(findings.length > 0 ? 1 : 0);
}
