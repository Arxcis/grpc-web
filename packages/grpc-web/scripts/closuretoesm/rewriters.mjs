const REGEX_PATH = /\('([.a-zA-Z]+)'\);?$/;

// rewriteModules() - Rewrite-function for 'goog.(provide|module)()'-statements
export function rewriteModules(filestr) {
  const exports = [];

  const rewrittenFilestr = filestr.replace(
    /^([ \t]*goog.(provide|module)\('([.a-zA-Z]+)'\));?$/gm,
    (it) => {
      const matches = it.match(REGEX_PATH);
      const moduleName = matches.pop();

      const parts = moduleName.split(".");
      const exportName = moduleName?.split(".").pop() ?? "undefined";
      const packageName = parts.slice(0, parts.length - 1).join(".");
      
      exports.push({
        exportName,
        packageName
      })

      return `export { ${exportName} };`;
    }
  );

  return [ rewrittenFilestr, exports ];
}

// rewriteRequires() - Rewrite-function for 'goog.require()'-statements
export function rewriteRequires(filestr) {
  const rewrittenFilestr =  filestr.replace(
    /^[ \t]*((const|var)[ \t]+([a-zA-Z]+)[ \t]+=[ \t]+)?goog.require(Type)?\('([.a-zA-Z]+)'\);?/gm,
    (it) => {
      const matches = it.match(REGEX_PATH);
      const moduleName = matches.pop();

      const parts = moduleName.split(".");
      const importName = moduleName.split(".").pop();
      const packageName = parts.slice(0, parts.length - 1).join(".");

      if (it.trim().startsWith("goog.require")) {
        return `import { ${importName} } from "./${packageName}.index.js";`;
      } else {
        return it;
      }
    }
  );

  return [ rewrittenFilestr ];
}
