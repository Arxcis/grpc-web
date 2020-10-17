const REGEX_PATH = /\('([.a-zA-Z]+)'\);?$/;

// rewriteModules() - Rewrite-function for 'goog.(provide|module)()'-statements
export function rewriteModules(filestr) {
  const exports = [];

  const rewrittenFilestr = filestr.replace(
    /^([ \t]*goog.(provide|module)\('([.a-zA-Z]+)'\));?$/gm,
    (a, b, c, moduleName) => {
      const moduleParts = moduleName.split(".");
      const exportName = moduleName?.split(".").pop() ?? "undefined";
      const packageName = moduleParts.slice(0, moduleParts.length - 1).join(".");
      
      exports.push({
        exportName,
        packageName
      })

      return `export { ${exportName} };`;
    }
  );

  return [ rewrittenFilestr, exports ];
}

export const REGEX_REQUIRE = /^[ \t]*((const|var)\s+{?\s*([a-zA-Z]+)\s*}?\s+=\s+)?goog.require(Type)?[(]'([a-zA-Z][.a-zA-Z0-9]*)'[)];?/gm;
// rewriteRequires() - Rewrite-function for 'goog.require()'-statements
export function rewriteRequires(filestr) {
  const rewrittenFilestr = filestr.replace(
    REGEX_REQUIRE,
    (a, b, c, varName, d, moduleName) => {
      const moduleParts = moduleName.split(".");
      const importName = moduleName.split(".").pop();
      const packageName = moduleParts.slice(0, moduleParts.length - 1).join(".");

      if (!varName || varName === importName) {
        return `import { ${importName} } from "./${packageName}.index.js";`;
      } else {
        return `import { ${importName} as ${varName} } from "./${packageName}.index.js";`;
      }
    }
  );

  return [ rewrittenFilestr ];
}

export function rewriteExports(filestr) {
  const rewritten = filestr.replace(/^[ \t]*exports([.][a-zA-Z]+)?\s*=\s*([a-zA-Z]+);?$/m, () => "")
  return [rewritten];
}

export function rewriteLegacyNamespace(filestr) {
  const rewritten = filestr.replace(/^[ \t]*goog[.]module[.]declareLegacyNamespace[(][)];?$/m, () => "")
  return [rewritten];
}