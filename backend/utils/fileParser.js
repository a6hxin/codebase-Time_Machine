/**
 * fileParser.js
 * Extracts function/class definitions from source files using AST or regex fallback.
 * Supports: JavaScript, TypeScript, Python
 */

const fs = require("fs");
const path = require("path");

/**
 * Extract all functions/methods from a source file.
 * @param {string} filePath - Absolute path to the file
 * @returns {object[]} Array of { name, startLine, endLine, type, code }
 */
function extractFunctions(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const content = fs.readFileSync(filePath, "utf-8");

  if ([".js", ".ts", ".jsx", ".tsx"].includes(ext)) {
    return extractJSFunctions(content, filePath);
  } else if (ext === ".py") {
    return extractPythonFunctions(content);
  }
  return [];
}

/**
 * Extract functions from JS/TS source using Babel parser.
 */
function extractJSFunctions(content, filePath) {
  try {
    const parser = require("@babel/parser");
    const traverse = require("@babel/traverse").default;

    const ast = parser.parse(content, {
      sourceType: "module",
      plugins: ["typescript", "jsx", "classProperties", "decorators-legacy"],
      errorRecovery: true,
    });

    const functions = [];
    const lines = content.split("\n");

    traverse(ast, {
      FunctionDeclaration(nodePath) {
        if (nodePath.node.id) {
          functions.push(buildEntry(nodePath.node, lines, "function"));
        }
      },
      ArrowFunctionExpression(nodePath) {
        const parent = nodePath.parent;
        if (parent.type === "VariableDeclarator" && parent.id) {
          functions.push(buildEntry(nodePath.node, lines, "arrow", parent.id.name));
        }
      },
      ClassMethod(nodePath) {
        functions.push(buildEntry(nodePath.node, lines, "method", nodePath.node.key?.name));
      },
      ObjectMethod(nodePath) {
        functions.push(buildEntry(nodePath.node, lines, "method", nodePath.node.key?.name));
      },
    });

    return functions.filter((f) => f.name);
  } catch (err) {
    // Fallback to regex if Babel fails
    return extractJSFunctionsRegex(content);
  }
}

function buildEntry(node, lines, type, nameOverride) {
  const startLine = node.loc?.start?.line ?? 0;
  const endLine = node.loc?.end?.line ?? 0;
  return {
    name: nameOverride || node.id?.name || node.key?.name || "anonymous",
    type,
    startLine,
    endLine,
    code: lines.slice(startLine - 1, endLine).join("\n"),
    lineCount: endLine - startLine + 1,
  };
}

/**
 * Regex fallback for JS function extraction.
 */
function extractJSFunctionsRegex(content) {
  const functions = [];
  const lines = content.split("\n");

  const patterns = [
    /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/,
    /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/,
    /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?function/,
  ];

  lines.forEach((line, i) => {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        functions.push({
          name: match[1],
          type: "function",
          startLine: i + 1,
          endLine: i + 1, // simplified; full range needs bracket tracking
          code: line,
          lineCount: 1,
        });
        break;
      }
    }
  });

  return functions;
}

/**
 * Extract functions from Python source using regex.
 */
function extractPythonFunctions(content) {
  const functions = [];
  const lines = content.split("\n");

  lines.forEach((line, i) => {
    const match = line.match(/^(\s*)(?:async\s+)?def\s+(\w+)\s*\(/);
    if (match) {
      const indent = match[1].length;
      const name = match[2];
      // Find function end by tracking indentation
      let endLine = i + 1;
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j];
        if (nextLine.trim() === "") continue;
        const nextIndent = nextLine.match(/^(\s*)/)[1].length;
        if (nextIndent <= indent && j > i + 1) break;
        endLine = j + 1;
      }
      functions.push({
        name,
        type: indent === 0 ? "function" : "method",
        startLine: i + 1,
        endLine,
        code: lines.slice(i, endLine).join("\n"),
        lineCount: endLine - i,
      });
    }
  });

  return functions;
}

/**
 * Extract functions from a string of source code (no file read).
 * @param {string} content - Source code string
 * @param {string} language - "js" | "py"
 * @returns {object[]}
 */
function extractFunctionsFromString(content, language = "js") {
  if (language === "py") return extractPythonFunctions(content);
  return extractJSFunctions(content, "virtual.js");
}

/**
 * Get just the function names from a file.
 * @param {string} filePath
 * @returns {string[]}
 */
function getFunctionNames(filePath) {
  return extractFunctions(filePath).map((f) => f.name);
}

module.exports = {
  extractFunctions,
  extractFunctionsFromString,
  getFunctionNames,
};
