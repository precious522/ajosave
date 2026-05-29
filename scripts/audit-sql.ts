import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";

interface Violation {
  file: string;
  line: number;
  character: number;
  snippet: string;
  reason: string;
}

const violations: Violation[] = [];
const allowedConstants = ["CIRCLE_SELECT", "MEMBER_SELECT", "paramIndex"];

function isSafeTemplateExpression(expr: ts.Expression): boolean {
  if (ts.isIdentifier(expr)) {
    return allowedConstants.includes(expr.text);
  }
  // Allow index calculation like paramIndex + 1
  if (ts.isBinaryExpression(expr)) {
    if (
      expr.operatorToken.kind === ts.SyntaxKind.PlusToken &&
      ts.isIdentifier(expr.left) &&
      expr.left.text === "paramIndex" &&
      ts.isNumericLiteral(expr.right)
    ) {
      return true;
    }
  }
  return false;
}

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== "node_modules" && file !== ".git" && file !== ".next") {
        getAllFiles(filePath, fileList);
      }
    } else if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function checkSqlSafety(node: ts.Expression): { safe: boolean; reason?: string } {
  // 1. Plain String Literal
  if (ts.isStringLiteral(node)) {
    return { safe: true };
  }

  // 2. No-substitution Template Literal
  if (ts.isNoSubstitutionTemplateLiteral(node)) {
    return { safe: true };
  }

  // 3. String concatenation (in SQL query strings)
  if (ts.isBinaryExpression(node)) {
    return {
      safe: false,
      reason: "SQL query uses string concatenation (+) instead of query parameterization.",
    };
  }

  // 4. Template Expression (backticks with interpolation)
  if (ts.isTemplateExpression(node)) {
    for (const span of node.templateSpans) {
      const expr = span.expression;
      
      // Allow specific pre-approved static constants or parameter index calculations
      if (isSafeTemplateExpression(expr)) {
        continue;
      }
      
      return {
        safe: false,
        reason: `SQL query uses raw string interpolation \${${expr.getText()}} instead of query parameterization.`,
      };
    }
    return { safe: true };
  }

  // 5. Variable access or function call passed as the query string
  return {
    safe: false,
    reason: `SQL query string is not a static string or template literal. Got expression type: ${ts.SyntaxKind[node.kind]}.`,
  };
}

function findVariableDeclaration(node: ts.Node, name: string): ts.VariableDeclaration | null {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
    return node;
  }
  let found: ts.VariableDeclaration | null = null;
  node.forEachChild((child) => {
    if (!found) {
      found = findVariableDeclaration(child, name);
    }
  });
  return found;
}

function isVariableSafe(scopeNode: ts.Node, varName: string): { safe: boolean; reason?: string } {
  // 1. Find variable declaration
  const decl = findVariableDeclaration(scopeNode, varName);
  if (!decl) {
    return { safe: false, reason: `Variable '${varName}' declaration not found in function scope.` };
  }

  // 2. Check initializer
  if (decl.initializer) {
    const initSafety = checkSqlSafety(decl.initializer);
    if (!initSafety.safe) {
      return { safe: false, reason: `Variable '${varName}' initialized with unsafe value: ${initSafety.reason}` };
    }
  }

  // 3. Find and check all assignments to this variable in the scope
  const assignments: ts.Expression[] = [];
  function findAssignments(n: ts.Node) {
    if (ts.isBinaryExpression(n)) {
      const lhs = n.left;
      if (
        (n.operatorToken.kind === ts.SyntaxKind.EqualsToken || n.operatorToken.kind === ts.SyntaxKind.PlusEqualsToken) &&
        ts.isIdentifier(lhs) &&
        lhs.text === varName
      ) {
        assignments.push(n.right);
      }
    }
    n.forEachChild(findAssignments);
  }
  findAssignments(scopeNode);

  for (const expr of assignments) {
    const safety = checkSqlSafety(expr);
    if (!safety.safe) {
      return { safe: false, reason: `Variable '${varName}' assigned unsafe value: ${safety.reason}` };
    }
  }

  return { safe: true };
}

function auditFile(filePath: string) {
  // Exclude db client utility itself since it has to execute parameter queries
  if (filePath.replace(/\\/g, "/").endsWith("src/lib/db.ts")) {
    return;
  }

  const code = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(
    filePath,
    code,
    ts.ScriptTarget.Latest,
    true
  );

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      let isQueryCall = false;
      let functionName = "";

      if (ts.isIdentifier(expression)) {
        const name = expression.text;
        if (name === "query" || name === "q") {
          isQueryCall = true;
          functionName = name;
        }
      } else if (ts.isPropertyAccessExpression(expression)) {
        const propName = expression.name.text;
        // Check for client.query or pool.query calls
        if (propName === "query") {
          const objText = expression.expression.getText();
          if (objText === "client" || objText === "pool" || objText === "this.pool") {
            isQueryCall = true;
            functionName = expression.getText();
          }
        }
      }

      if (isQueryCall && node.arguments.length > 0) {
        const firstArg = node.arguments[0];
        
        let safety: { safe: boolean; reason?: string } = { safe: false, reason: "Unknown" };
        if (ts.isIdentifier(firstArg)) {
          // Find enclosing function to check variable declaration
          let parent: ts.Node | undefined = node.parent;
          while (
            parent &&
            !ts.isFunctionDeclaration(parent) &&
            !ts.isArrowFunction(parent) &&
            !ts.isMethodDeclaration(parent)
          ) {
            parent = parent.parent;
          }
          if (parent) {
            safety = isVariableSafe(parent, firstArg.text);
          } else {
            safety = { safe: false, reason: `SQL query variable '${firstArg.text}' used outside a function scope.` };
          }
        } else {
          safety = checkSqlSafety(firstArg);
        }

        if (!safety.safe) {
          const { line, character } = ts.getLineAndCharacterOfPosition(
            sourceFile,
            firstArg.getStart()
          );
          violations.push({
            file: path.relative(process.cwd(), filePath),
            line: line + 1,
            character: character + 1,
            snippet: firstArg.getText().replace(/\r?\n/g, " ").trim(),
            reason: safety.reason || "",
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function runAudit() {
  console.log("Starting SQL Injection Prevention Audit...");
  const srcDir = path.join(process.cwd(), "src");
  const files = getAllFiles(srcDir);
  console.log(`Auditing ${files.length} TypeScript files under src/...`);

  for (const file of files) {
    auditFile(file);
  }

  if (violations.length > 0) {
    console.error(`\x1b[31mAudit Failed! Found ${violations.length} potential SQL Injection vulnerabilities:\x1b[0m\n`);
    violations.forEach((v, index) => {
      console.error(`[${index + 1}] File: ${v.file}:${v.line}:${v.character}`);
      console.error(`    Reason:  ${v.reason}`);
      console.error(`    Snippet: \x1b[33m${v.snippet}\x1b[0m`);
      console.error("-".repeat(80));
    });
    process.exit(1);
  } else {
    console.log("\x1b[32mAudit Passed! All database queries are fully parameterized and secure.\x1b[0m");
    process.exit(0);
  }
}

runAudit();
