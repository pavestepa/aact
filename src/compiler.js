const fs = require("fs-extra");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generator = require("@babel/generator").default;
const t = require("@babel/types");
const path = require("path");

const inputDir = "./ob";
const outputDir = "./dist";

function compileFile(filePath) {
  const code = fs.readFileSync(filePath, "utf-8");

  const ast = parser.parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  const signals = new Set();

  traverse(ast, {
    VariableDeclaration(path) {
      if (path.node.kind === "const" || path.node.kind === "let") {
        path.node.declarations.forEach((decl) => {
          if (t.isIdentifier(decl.id) && decl.init) {
            const name = decl.id.name;
            signals.add(name);

            const setterName = "set" + name[0].toUpperCase() + name.slice(1);

            path.replaceWith(
              t.variableDeclaration("const", [
                t.variableDeclarator(
                  t.arrayPattern([
                    t.identifier(name),
                    t.identifier(setterName),
                  ]),
                  t.callExpression(t.identifier("createSignal"), [decl.init])
                ),
              ])
            );
          }
        });
      }
    },
  });

  const header = `import { createSignal } from "solid-js";\n`;
  const output = header + generator(ast).code;

  const relativePath = path.relative(inputDir, filePath);
  const outputPath = path.join(outputDir, relativePath);
  fs.ensureDirSync(path.dirname(outputPath));
  fs.writeFileSync(outputPath, output, "utf8");
}

function compileDir(dir = inputDir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      compileDir(fullPath);
    } else if (file.endsWith(".js") || file.endsWith(".jsx")) {
      compileFile(fullPath);
    }
  }
}

compileDir();
