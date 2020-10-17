const REGEX_PATH = /\('([.a-zA-Z]+)'\);?$/;

// rewriteModules() - Rewrite-function for 'goog.(provide|module)()'-statements
export function rewriteModules(filestr) {
  const exports = [];

  const rewrittenFilestr = filestr.replace(
    /^([ \t]*goog.(provide|module)\('([.a-zA-Z]+)'\));?$/gm,
    (...parts) => {
      const [a, b, c, moduleName] = parts;
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

// rewriteRequires() - Rewrite-function for 'goog.require()'-statements
export function rewriteRequires(filestr) {
  const rewrittenFilestr =  filestr.replace(
    /^[ \t]*goog.require(Type)?\('([.a-zA-Z]+)'\);?/gm,
    (...parts) => {
      const [a, b, moduleName] = parts;
      const moduleParts = moduleName.split(".");
      const importName = moduleName.split(".").pop();
      const packageName = moduleParts.slice(0, moduleParts.length - 1).join(".");

      return `import { ${importName} } from "./${packageName}.index.js";`;
    }
  );

  return [ rewrittenFilestr ];
}

// rewriteRequiresWithVar() - Rewrite-function for 'goog.require()'-statements
export function rewriteRequiresWithVar(filestr) {
  const rewrittenFilestr =  filestr.replace(
    /^[ \t]*(const|var)\s+{?\s*([a-zA-Z]+)\s*}?\s+=\s+goog.require(Type)?[(]'([.a-zA-Z]+)'[)];?/gm,
    (...parts) => {
      const [a, b, varName, d, moduleName] = parts;
      const moduleParts = moduleName.split(".");
      const importName = moduleName.split(".").pop();
      const packageName = moduleParts.slice(0, moduleParts.length - 1).join(".");

      if (varName === importName) {
        return `import { ${importName} } from "./${packageName}.index.js";`;
      } else {
        return `import { ${importName} as ${varName} } from "./${packageName}.index.js";`;
      }
    }
  );

  return [ rewrittenFilestr ];
}