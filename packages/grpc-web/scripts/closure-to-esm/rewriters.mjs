const REGEX_PATH = /\('([.a-zA-Z]+)'\);?$/;

export const REWRITERS = [rewriteRequires, rewriteModules, rewriteProvides];

// @rewrite function
export function rewriteProvides(filestr) {
  return filestr.replace(
    /(\S*goog.provide\('([.a-zA-Z]+)'\);?\s)+/,
    (match) => {
      const lines = match.split("\n").filter((it) => it !== "");

      const out = `export {
    ${lines
      .map((line) => {
        const matches = line.match(REGEX_PATH);
        const provideName = matches.pop();

        return provideName.split(".").pop();
      })
      .join(",\n  ")}
  }`;

      return out;
    }
  );
}

// @rewrite function
export function rewriteModules(filestr) {
  return filestr.replace(/^goog.module\('([.a-zA-Z]+)'\);?$/m, (it) => {
    const matches = it.match(REGEX_PATH);
    const requireName = matches.pop();

    const symbolName = requireName?.split(".").pop() ?? "undefined";
    return `export { ${symbolName} }`;
  });
}

// @rewrite function
export function rewriteRequires(filestr) {
  return filestr.replace(
    /^((const|var)\s+([a-zA-Z]+)\s+=\s+)?goog.require(Type)?\('([.a-zA-Z]+)'\)/gm,
    (it) => {
      const matches = it.match(REGEX_PATH);
      const requireName = matches.pop();

      if (it.startsWith("goog.require")) {
        const symbolName = requireName?.split(".").pop() ?? "undefined";
        return `import { ${symbolName} } from "./${requireName}.js"`;
      } else {
        return it;
      }
    }
  );
}
