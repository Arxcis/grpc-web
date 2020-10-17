// @rewriter function
export function rewriteModules(filestr) {
  const exports = [];

  const rewritten = filestr.replace(
    /^([ \t]*goog.(provide|module)[(]'([a-zA-Z][.a-zA-Z0-9]*)'[)]);?$/gm,
    (a, b, c, moduleName) => {
      const moduleParts = moduleName.split(".");
      const exportName = moduleName?.split(".").pop() ?? "undefined";
      const packageName = moduleParts
        .slice(0, moduleParts.length - 1)
        .join(".");

      exports.push({
        exportName,
        packageName,
      });

      return `export { ${exportName} };`;
    }
  );

  return [rewritten, exports];
}

// @rewriter function
export function rewriteRequires(filestr) {
  const rewritten = filestr.replace(REGEX_REQUIRE, (...parts) => {
    const [, , , symbolstr, , , moduleName] = parts;
    const moduleParts = moduleName.split(".");
    const importName = moduleName.split(".").pop();
    const packageName = moduleParts.slice(0, moduleParts.length - 1).join(".");

    const symbols = symbolstr?.split(",")?.map((it) => it.trim());

    if (
      symbols === undefined ||
      (symbols.length === 1 && symbols[0] === importName)
    ) {
      return `import { ${importName} } from "./${packageName}.index.js";`;
    } else if (symbols.length > 1) {
      return `import { ${symbols.join(
        ", "
      )} } from "./${packageName}.index.js";`;
    } else {
      return `import { ${importName} as ${symbols} } from "./${packageName}.index.js";`;
    }
  });

  return [rewritten];
}

// @rewriter function
export function rewriteExports(filestr) {
  const allExports = [];
  const rewritten = filestr.replace(
    /[ \t]*exports([.][a-zA-Z0-9]+)?\s*=\s*{?([a-zA-Z0-9\s,]+)}?;?/,
    (...parts) => {
      const [, , exportstr] = parts;
      const exports = exportstr.replace(/\s/g, "").split(",");

      // Check if export already exists
      const outstr = `export { ${exports.join(", ")} }`;
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
