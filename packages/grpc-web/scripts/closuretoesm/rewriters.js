// @rewriter function
export function rewriteModules(filestr) {
  const exports = [];

  let rewritten = filestr.replace(
    /^([ \t]*goog.(provide|module)[(]'([a-zA-Z][.a-zA-Z0-9]*)'[)]);?$/gm,
    (a, b, c, moduleName) => {
      const packageName = resolvePackageName(moduleName);
      const exportName = moduleName.split(".").pop();
      exports.push({
        exportName,
        packageName,
        moduleName,
      });

      return `export { ${exportName} };`;
    }
  );

  rewritten = exports.reduce(
    (acc, { moduleName, exportName }) =>
      acc.replace(new RegExp(moduleName, "g"), exportName),
    rewritten
  );

  return [rewritten, exports];
}

// REGEX_REQUIRE parts
const CONSTVAR = /(const|var)\s+/; //                 const|var
const SYMBOLS = /{?\s*([a-zA-Z][a-zA-Z0-9]*(,\s*[a-zA-Z][a-zA-Z0-9]*)*)\s*}?/; //  {StreamInterceptor, UnaryInterceptor}
const EQUAL = /\s+=\s+/; //                           =
const REQUIRE = /goog.require(Type)?/; //             goog.require(Type)?
const NAME = /[(]'([a-zA-Z][.a-zA-Z0-9]*)'[)];?/; //  ('goog.util');

// Example of full string:
// (const {StreamInterceptor, UnaryInterceptor} = )?goog.require('grpc.web.Interceptor');
export const REGEX_REQUIRE = new RegExp(
  `^[ \t]*(${CONSTVAR.source}${SYMBOLS.source}${EQUAL.source})?${REQUIRE.source}${NAME.source}`,
  "gm"
);

// @rewriter function
export function rewriteRequires(filestr) {
  const rewritten = filestr.replace(REGEX_REQUIRE, (...parts) => {
    const [, , , symbolstr, , , moduleName] = parts;

    const packageName = resolvePackageName(moduleName);
    const importName = moduleName.split(".").pop();
    const symbols = symbolstr?.split(",").map((it) => it.trim()) ?? [];

    if (
      symbols.length === 0 ||
      (symbols.length === 1 && symbols[0] === importName)
    ) {
      return `import { ${importName} } from "./${packageName}.index.js";`;
    } else if (symbols.length > 1) {
      return `import { ${symbols.join(
        ", "
      )} } from "./${packageName}.index.js";`;
    } else {
      return `import { ${importName} as ${symbols[0]} } from "./${packageName}.index.js";`;
    }
  });

  return [rewritten];
}

// @rewriter function
export function rewriteExports(filestr) {
  const allExports = [];
  const rewritten = filestr.replace(
    /[ \t]*exports([.]([a-zA-Z0-9.]+))?(\s*=\s*{?([a-zA-Z0-9\s,]+)}?)?;?/,
    (...parts) => {
      const [, , leftSideDeclaration, , exportstr] = parts;
      if (exportstr === undefined) {
        return `let ${leftSideDeclaration};`;
      }
      const exports = exportstr.replace(/\s/g, "").split(",");

      // Check if export already exists
      const outstr = `export { ${exports.join(", ")} };`;
      if (filestr.includes(outstr)) {
        return "";
      }

      allExports.push(...exports.map((it) => ({ exportName: it })));
      return outstr;
    }
  );
  return [rewritten, allExports];
}

// @rewriter function
export function rewriteLegacyNamespace(filestr) {
  const rewritten = filestr.replace(
    /^[ \t]*goog[.]module[.]declareLegacyNamespace[(][)];?$/m,
    () => ""
  );
  return [rewritten];
}

// @helper function
function resolvePackageName(moduleName) {
  const parts = moduleName.split(".");
  const packageName = parts.slice(0, parts.length - 1).join(".");

  return packageName;
}
