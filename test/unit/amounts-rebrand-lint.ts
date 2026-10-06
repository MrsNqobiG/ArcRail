/**
 * U1 re-brand rule (CLAUDE.md "Conversions happen in exactly one module",
 * RUBRIC MC-03). Type-aware, over every `src/**\/*.ts` except the conversion
 * module `src/amounts/index.ts`:
 *
 *   REBRAND-ARITH  a call to `cbsMinor`, `usdcUnits` or `nativeWei` (however
 *                  imported: renamed, namespace, re-exported) whose argument is
 *                  a raw bigint arithmetic result. "Raw arithmetic" is any
 *                  bigint-typed `+ - * / % **`, bitwise operator, unary `-`/`~`,
 *                  `++`/`--` or compound assignment, reached directly or through
 *                  a variable, an assignment, a function's return value or a
 *                  parameter of a function in src (fixpoint over the program).
 *   REBRAND-CAST   a type assertion (`as T`, `<T>x`) whose target type carries
 *                  an amount brand, directly or in a union, intersection, array
 *                  or property (for example `as NativeToCbsResult`). `as const`
 *                  is not a cast to a brand and is not flagged.
 *   REBRAND-ALIAS  a brand constructor used other than as a direct callee (for
 *                  example `const f = nativeWei`, `nativeWei.call(...)`), which
 *                  would escape REBRAND-ARITH.
 *
 * Sanctioned routes: the §6 conversions and the same-unit `add*`/`subtract*`
 * helpers of src/amounts/index.ts. Bigint arithmetic whose result is never
 * re-branded (for example a comparison against a cap) is not flagged; neither is
 * `number` index arithmetic (the MC-01 lint owns numbers on money paths).
 *
 * Inspection-only limits: taint does not flow through object properties,
 * array elements, closures over outer variables reassigned in another
 * function, or values that cross a module boundary through a non-function
 * export. Test files are out of scope (they cast on purpose to test refusals).
 */
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

export interface RebrandFinding {
  readonly file: string;
  readonly line: number;
  readonly rule: 'REBRAND-ARITH' | 'REBRAND-CAST' | 'REBRAND-ALIAS';
  readonly text: string;
}

export const CONVERSION_MODULE = 'src/amounts/index.ts';
const BRAND_CONSTRUCTORS = new Set(['cbsMinor', 'usdcUnits', 'nativeWei']);

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

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...listSourceFiles(path));
    else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) out.push(path);
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

  const resolve = (node: ts.Node): ts.Symbol | undefined => {
    const s = checker.getSymbolAtLocation(node);
    return s && (s.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(s) : s;
  };

  const ctorSymbols = new Set<ts.Symbol>();
  conversion.forEachChild((n) => {
    if (ts.isFunctionDeclaration(n) && n.name && BRAND_CONSTRUCTORS.has(n.name.text)) {
      const s = resolve(n.name);
      if (s) ctorSymbols.add(s);
    }
  });
  if (ctorSymbols.size !== BRAND_CONSTRUCTORS.size) throw new Error('re-brand lint: brand constructors not found in the conversion module');
  const isCtor = (node: ts.Node): boolean => {
    const s = resolve(node);
    return s !== undefined && ctorSymbols.has(s);
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

  const tainted = new Set<ts.Symbol>();
  const isTainted = (expr: ts.Node): boolean => {
    let hit = false;
    const walk = (n: ts.Node): void => {
      if (hit) return;
      if (isArithmetic(n)) {
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

  const taint = (nameNode: ts.Node): boolean => {
    const s = resolve(nameNode);
    if (!s || tainted.has(s)) return false;
    tainted.add(s);
    return true;
  };

  /** Return expressions of a function-like declaration (nested functions included, conservatively). */
  const returnsOf = (fn: ts.SignatureDeclaration): ts.Node[] => {
    if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) return [fn.body];
    const out: ts.Node[] = [];
    const walk = (n: ts.Node): void => {
      if (ts.isReturnStatement(n) && n.expression) out.push(n.expression);
      ts.forEachChild(n, walk);
    };
    const body = (fn as { body?: ts.Node }).body;
    if (body) walk(body);
    return out;
  };

  // Fixpoint: propagate taint through variables, assignments, returns and parameters.
  let changed = true;
  while (changed) {
    changed = false;
    for (const sf of checked) {
      const visit = (n: ts.Node): void => {
        if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && isTainted(n.initializer)) changed = taint(n.name) || changed;
        if (ts.isPropertyDeclaration(n) && n.initializer && isTainted(n.initializer)) changed = taint(n.name) || changed;
        if (ts.isBinaryExpression(n) && ts.isIdentifier(n.left)) {
          const op = n.operatorToken.kind;
          if ((op === K.EqualsToken && isTainted(n.right)) || (COMPOUND_OPS.has(op) && bigintTyped(n.left))) changed = taint(n.left) || changed;
        }
        if ((ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) && ts.isIdentifier(n.operand) && isArithmetic(n)) {
          if (n.operator === K.PlusPlusToken || n.operator === K.MinusMinusToken) changed = taint(n.operand) || changed;
        }
        if ((ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) && n.name && returnsOf(n).some(isTainted)) changed = taint(n.name) || changed;
        if (ts.isCallExpression(n)) {
          const callee = resolve(ts.isPropertyAccessExpression(n.expression) ? n.expression.name : n.expression);
          const decl = callee?.valueDeclaration;
          let fn: ts.Node | undefined = decl;
          if (fn && ts.isVariableDeclaration(fn)) fn = fn.initializer;
          if (fn && ts.isFunctionLike(fn) && fn.getSourceFile() !== conversion) {
            fn.parameters.forEach((param, i) => {
              const arg = n.arguments[i];
              if (arg && ts.isIdentifier(param.name) && isTainted(arg)) changed = taint(param.name) || changed;
            });
          }
        }
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
  }

  /** Does this type carry an amount brand, directly or nested (depth-limited)? */
  const isBranded = (t: ts.Type, depth = 0): boolean => {
    if (depth > 4) return false;
    if (t.isUnionOrIntersection() && t.types.some((u) => isBranded(u, depth + 1))) return true;
    if (checker.isArrayType(t) || checker.isTupleType(t)) return checker.getTypeArguments(t as ts.TypeReference).some((u) => isBranded(u, depth + 1));
    for (const prop of checker.getPropertiesOfType(t)) {
      if (String(prop.escapedName).startsWith('__@amountUnit')) return true;
      if ((t.flags & ts.TypeFlags.Object) !== 0 && depth < 4 && prop.valueDeclaration) {
        if (isBranded(checker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration), depth + 1)) return true;
      }
    }
    return false;
  };

  const findings: RebrandFinding[] = [];
  for (const sf of checked) {
    const report = (node: ts.Node, rule: RebrandFinding['rule']): void => {
      findings.push({ file: rel(sf), line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, rule, text: node.getText(sf).slice(0, 120) });
    };
    const visit = (n: ts.Node): void => {
      if (ts.isCallExpression(n)) {
        let callee: ts.Expression = n.expression;
        while (ts.isParenthesizedExpression(callee)) callee = callee.expression;
        const target = ts.isPropertyAccessExpression(callee) ? callee.name : callee;
        if (isCtor(target) && n.arguments.some(isTainted)) report(n, 'REBRAND-ARITH');
      }
      // `as const` only narrows literals; it cannot add a brand the value does not already carry.
      if ((ts.isAsExpression(n) || ts.isTypeAssertionExpression(n)) && !ts.isConstTypeReference(n.type) && isBranded(checker.getTypeFromTypeNode(n.type))) {
        report(n, 'REBRAND-CAST');
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
