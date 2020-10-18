// @rewriter function
export function rewriteEsExports(filestr) {
  const rewritten = filestr.replace(
    /(export { (\w+) } from \"\.\/[\w.]+\.js\";\n)+/g,
    (...parts) => {
      const [firstPart] = parts;
      const matches = firstPart.matchAll(
        /export { (\w+) } from (\"\.\/[\w.]+\.js\");/g
      );
      const names = [...matches].map(([a, exportName, fromName]) => {
        return {
          exportName,
          fromName,
        };
      });

      const merged = names.reduce((acc, { fromName, exportName }) => {
        return {
          ...acc,
          [fromName]: acc[fromName]
            ? [exportName, ...acc[fromName]]
            : [exportName],
        };
      }, {});

      const res = Object.entries(merged)
        .map(([fromName, exportNames]) => {
          return `export { ${exportNames
            .sort((a, b) => a.localeCompare(b))
            .join(", ")} } from ${fromName};`;
        })
        .sort((a, b) => b.length - a.length)
        .join("\n");

      return `${res}\n`;
    }
  );
  return [rewritten];
}
// @rewriter function
export function rewriteEsImports(filestr) {
  const rewritten = filestr.replace(
    /(import { (\w+( as \w+)?) } from "\.\/[\w.]+\.js";\n)+/g,
    (...parts) => {
      const [firstPart] = parts;
      const matches = firstPart.matchAll(
        /import { (\w+( as \w+)?) } from ("\.\/[\w.]+\.js");/g
      );
      const names = [...matches].map(([a, importName, c, fromName]) => ({
        importName,
        fromName,
      }));

      const merged = names.reduce((acc, { fromName, importName }) => {
        return {
          ...acc,
          [fromName]: acc[fromName]
            ? [importName, ...acc[fromName]]
            : [importName],
        };
      }, {});

      const res = Object.entries(merged)
        .map(([fromName, importNames]) => {
          return `import { ${importNames
            .sort((a, b) => a.localeCompare(b))
            .join(", ")} } from ${fromName};`;
        })
        .sort((a, b) => b.length - a.length)
        .join("\n");

      return `${res}\n`;
    }
  );
  return [rewritten];
}

const googSymbols = [
  "global",
  "require",
  "define",
  "DEBUG",
  "LOCALE",
  "TRUSTED_SITE",
  "DISALLOW_TEST_ONLY_CODE",
  "getGoogModule",
  "setTestOnly",
  "forwardDeclare",
  "getObjectByName",
  "basePath",
  "addSingletonGetter",
  "typeOf",
  "isArray",
  "isArrayLike",
  "isDateLike",
  "isFunction",
  "isObject",
  "getUid",
  "hasUid",
  "removeUid",
  "mixin",
  "now",
  "globalEval",
  "getCssName",
  "setCssNameMapping",
  "getMsg",
  "getMsgWithFallback",
  "exportSymbol",
  "exportProperty",
  "globalize",
  "nullFunction",
  "abstractMethod",
  "removeHashCode",
  "getHashCode",
  "cloneObject",
  "bind",
  "partial",
  "inherits",
  "scope",
  "defineClass",
  "declareModuleId",
  // Patched in
  "createTrustedTypesPolicy",
  "getScriptNonce",
  "FEATURESET_YEAR",
].sort((a, b) => b.length - a.length); // Sort most specific (longest-symbol) first.

// @rewriter function
export function rewriteGoog(filestr) {
  const seen = new Set();
  for (const googSymbol of googSymbols) {
    filestr = filestr.replace(
      new RegExp(`goog\\.${googSymbol}([^\w])`, "g"),
      (...parts) => {
        const [a, suffix] = parts;
        seen.add(googSymbol);
        return `${googSymbol}${suffix}`;
      }
    );
  }
  const seenArray = [...seen];
  if (seenArray.length === 0) {
    return [filestr];
  }

  filestr = `${seenArray
    .map((it) => `import { ${it} } from "./goog.js";`)
    .join("\n")}\n${filestr}`;

  return [filestr];
}

// @rewriter function
export function rewriteModules(filestr) {
  const exports = [];

  let rewritten = filestr.replace(
    /^([ \t]*goog.(provide|module)[(]'([\w.]+)'[)]);?$/gm,
    (it, b, c, moduleName) => {
      const packageName = resolvePackageName(moduleName);
      const exportName = moduleName.split(".").pop();
      exports.push({
        exportName,
        packageName,
        moduleName,
      });

      if (it.includes("provide")) {
        return `export { ${exportName} };\nlet ${exportName} = {};\n`;
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
const SYMBOLS = /{?\s*([\w]+(,\s*[\w]+\s*)*)\s*}?/; //  {StreamInterceptor, UnaryInterceptor}
const EQUAL = /\s*=\s*/; //                           =
const REQUIRE = /goog.require(Type)?/; //             goog.require(Type)?
const NAME = /[(]'([\w.]+)'[)];?/; //  ('goog.util');

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

  // Sort imports to make sure:
  //   'goog.asserts.AssertionType is rewritten before
  //   'goog.asserts
  imports.sort((a, b) => b.requireName.length - a.requireName.length);
  rewritten = imports.reduce(
    (acc, { requireName, importName }) =>
      acc.replace(
        // Dont replace ./goog"-paths
        new RegExp("([^\\/])(" + requireName + ")", "g"),
        (...parts) => {
          const [, prefix] = parts;
          return `${prefix}${importName}`;
        }
      ),
    rewritten
  );

  return [rewritten];
}

/**
 * @rewriter function for exports
 *  - Exports have many variations
 *
 * Examples:
 *   exports.GenericTransportInterface;
 *   exports = UnaryResponse;
 *   exports.Status = Status;
 *   exports.HTTP_HEADERS_PARAM_NAME = '$httpHeaders';
 *   exports.generateHttpHeadersOverwriteParam = function(headers) {
 *   exports = {
 *     UnaryInterceptor,
 *     StreamInterceptor
 *   };
 *
 *   It's a mess
 */
export function rewriteExports(filestr) {
  const allExports = [];

  // exports = { --> export {
  let rewritten = filestr
    .replace(/exports\s*=\s*\{([\s\w,]+)\};/, (...parts) => {
      const [, exportNameStr] = parts;
      const exportNames = exportNameStr.split(",").map((it) => it.trim());
      allExports.push(...exportNames);

      return `export { ${exportNames.join(", ")} };`;
    })

    // exports.name = (''|function()) --> export const name = (''|fun)
    .replace(/exports\.([\w_]+)\s*=\s*('|function)/g, (...parts) => {
      const [, exportName, tatOrFunc] = parts;
      allExports.push(exportName);
      return `export const ${exportName} = ${tatOrFunc}`;
    })

    // exports(.name)? = name;
    .replace(/exports.(\w+)?\s*=\s*(\w+);\n/g, (match) => {
      return ``;
    })

    // exports.name;
    .replace(/^exports.(\w+);$/gm, (...parts) => {
      const [, exportName] = parts;
      return `export let ${exportName};`;
    })

    // exports.generateHttpHeadersOverwriteParam(headers)); -> generateHttpHeadersOverwriteParam(headers));
    .replace(/exports\.(\w+)(\(\w*\))/g, (...parts) => {
      const [match, exportName, funcCall] = parts;
      return `${exportName}${funcCall}`;
    });

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

// @helper function
function upperCaseFirstLetter(word) {
  return word.replace(/^./, (it) => it.toUpperCase());
}
