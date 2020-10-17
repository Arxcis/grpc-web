const REGEX_PATH = /\('([.a-zA-Z]+)'\);?$/;

export const REWRITERS = [rewriteRequires, rewriteModules, rewriteProvides];

// @rewrite function
export function rewriteProvides(filestr) {
  return filestr.replace(
    /^([ \t]*goog.provide\('([.a-zA-Z]+)'\));?$/gm,
    (it) => {
      const matches = it.match(REGEX_PATH);
      const requireName = matches.pop();
      const exportName = requireName?.split(".").pop() ?? "undefined";

      return `export { ${exportName} };`;
    }
  );
}

// @rewrite function
export function rewriteModules(filestr) {
  return filestr.replace(/^[ \t]*goog.module\('([.a-zA-Z]+)'\);?$/m, (it) => {
    const matches = it.match(REGEX_PATH);
    const requireName = matches.pop();

    const symbolName = requireName?.split(".").pop() ?? "undefined";
    return `export { ${symbolName} };`;
  });
}

// @rewrite function
export function rewriteRequires(filestr) {
  return filestr.replace(
    /^[ \t]*((const|var)[ \t]+([a-zA-Z]+)[ \t]+=[ \t]+)?goog.require(Type)?\('([.a-zA-Z]+)'\);?/gm,
    (it) => {
      const matches = it.match(REGEX_PATH);
      const requireName = matches.pop();

      if (it.trim().startsWith("goog.require")) {
        const symbolName = requireName?.split(".").pop() ?? "undefined";
        return `import { ${symbolName} } from "./${requireName}.js";`;
      } else {
        return it;
      }
    }
  );
}
