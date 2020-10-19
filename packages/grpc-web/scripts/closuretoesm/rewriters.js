const aliases = [
  [/^goog\.require\('goog\.asserts'\);$/gm, "googAsserts"],
  [/^goog\.require\('goog\.dom\.asserts'\);$/gm, "domAsserts"],
  [/^goog\.require\('goog\.debug\.Logger'\);$/gm, "debugLogger"],
  [/^goog\.require\('goog\.debug\.LogRecord'\);$/gm, "debugLogRecord"],
];
// @rewriter function
export function rewriteAliases(filestr) {
  for (const [pattern, alias] of aliases) {
    filestr = filestr.replace(pattern, (it) => `const ${alias} = ${it}`);
  }

  return [filestr];
}

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
  "TRUSTED_TYPES_POLICY_NAME",
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
export function rewriteModules(filestr, filename) {
  const paths = [];
  let module = null;
  let rewritten = filestr
    .replace(/^([ \t]*goog.provide[(]'([\w.]+)'[)]);?$/gm, (...parts) => {
      const [it, , pathName] = parts;
      const packageName = resolvePackageName(pathName);
      const exportName = pathName.split(".").pop();

      paths.push({
        exportName,
        packageName,
        pathName,
      });
      return `let ${exportName} = {};\nexport { ${exportName} };\n`;
    })
    .replace(/^([ \t]*goog.module[(]'([\w.]+)'[)]);?$/m, (...parts) => {
      const [it, , pathName] = parts;
      const packageName = resolvePackageName(pathName);
      const exportName = pathName.split(".").pop();
      module = {
        exportName,
        packageName,
        pathName,
      };
      paths.push(module);

      if (
        filestr.match(
          new RegExp(`^(class|function|const|let)\\s+${exportName}`, "m")
        )
      ) {
        return `export { ${exportName} };`;
      } else {
        return `let ${exportName} = {};\nexport { ${exportName} };\n`;
      }
    });

  // Rewrite exports.NAME statements
  if (module) {
    rewritten = rewritten.replace(/exports\.(\w+)(.*)/g, (...parts) => {
      const [, name, trail] = parts;

      if (name === module.exportName) {
        return ``;
      } else {
        const [, name, trail] = parts;
        return `${module.exportName}.${name}${trail}`;
      }
    });
  }

  rewritten = rewritePathsExceptFilepaths(paths, rewritten);

  return [rewritten, paths];
}

export const REGEX_REQUIRE = /^[ \t]*((const|var)\s*[{]?\s*(\w+(,\s*\w+)*)\s*[}]?\s*=\s*)?goog.require(Type)?[(]'([\w.]+)'[)];?[ \t]*$/gm;

// @rewriter function
export function rewriteRequires(filestr, filename) {
  const paths = [];
  const rewritten = filestr
    // ^googRequire(Type)?('goog.debug.Error');
    .replace(/^goog.require(Type)?[(]'([\w.]+)'[)];?/gm, (...parts) => {
      const [whole, , pathName] = parts;
      const packageName = resolvePackageName(pathName);
      const exportName = pathName.split(".").pop();
      paths.push({
        pathName,
        exportName,
      });

      return `import { ${exportName} } from "./${packageName}.index.js";`;
    })
    // (const|var) {?Example}? = googRequire(Type)?('goog.debug.Error');
    .replace(
      /^(const|var)\s*[{]?\s*(\w+(,\s*\w+)*)\s*[}]?\s*=\s*goog.require(Type)?[(]'([\w.]+)'[)];?$/gm,
      (...parts) => {
        const [, , varName, , , pathName] = parts;
        const packageName = resolvePackageName(pathName);
        const lastPart = pathName.split(".").pop();

        const importSymbols = varName.split(",").map((it) => it.trim());

        if (importSymbols.length === 1 && importSymbols[0] !== lastPart) {
          paths.push({
            pathName,
            exportName: importSymbols[0],
          });
          return `import { ${lastPart} as ${importSymbols[0]} } from "./${packageName}.index.js";`;
        } else if (importSymbols.length === 1) {
          paths.push({
            pathName,
            exportName: importSymbols[0],
          });
          return `import { ${importSymbols[0]} } from "./${packageName}.index.js";`;
        } else {
          return `import { ${importSymbols.join(
            ", "
          )} } from "./${packageName}.index.js";`;
        }
      }
    );

  const reduced = rewritePathsExceptFilepaths(paths, rewritten);

  return [reduced];
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
      allExports.push(...exportNames.map((it) => ({ exportName: it })));

      return `export { ${exportNames.join(", ")} };`;
    })

    // exports = name;
    .replace(/exports\s*=\s*(\w+);\n/g, (match) => {
      return ``;
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

/**
 * ## rewritePathsExceptFilepaths()
 *
 * @param {object} path
 * @param {string} path.pathName
 * @param {string} path.exportName
 * @param {}
 */
function rewritePathsExceptFilepaths(paths, filestr) {
  paths.sort((a, b) => b.pathName.length - a.pathName.length);

  return paths.reduce(
    (acc, { pathName, exportName }) =>
      acc.replace(new RegExp("([^/'])(" + pathName + ")", "g"), (...parts) => {
        const [, prefix] = parts;
        return `${prefix}${exportName}`;
      }),
    filestr
  );
}
