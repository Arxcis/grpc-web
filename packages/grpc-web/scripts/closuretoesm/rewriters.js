// @rewriter function
export function rewriteModules(filestr) {
  const exports = [];

  let rewritten = filestr.replace(
    /^([ \t]*goog.(provide|module)[(]'([a-zA-Z][.a-zA-Z0-9]*)'[)]);?$/gm,
    (it, b, c, moduleName) => {
      const packageName = resolvePackageName(moduleName);
      const exportName = moduleName.split(".").pop();
      exports.push({
        exportName,
        packageName,
        moduleName,
      });

      if (it.includes("provide")) {
        return `export { ${exportName} };\nlet ${exportName} = {};`;
      } else {
        return `export { ${exportName} };`;
      }
    }
  );

  // Sort exports to make sure:
  //   'goog.asserts.AssertionType is rewritten before
  //   'goog.asserts
  exports.sort((a, b) => b.moduleName.length - a.moduleName.length);

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
  const imports = [];
  let rewritten = filestr.replace(REGEX_REQUIRE, (...parts) => {
    const [, , , symbolstr, , , requireName] = parts;

    const packageName = resolvePackageName(requireName);
    const importName = requireName.split(".").pop();
    const symbols = symbolstr?.split(",").map((it) => it.trim()) ?? [];
    imports.push({
      requireName,
      importName,
    });
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

  // Sort exports to make sure:
  //   'goog.asserts.AssertionType is rewritten before
  //   'goog.asserts

  imports.sort((a, b) => b.requireName.length - a.requireName.length);
  rewritten = imports.reduce(
    (acc, { requireName, importName }) =>
      acc.replace(new RegExp(requireName, "g"), importName),
    rewritten
  );

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
