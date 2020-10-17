/**
 * Build a distribution of grpc-web that is compatible with ES Modules (esm for short).
 *
 * ## Use cases:
 *
 * ### "As a web-dev, I want to import `grpc-web` in esm modules
 * ```js
 * import * as grpcWeb from "../../node-modules/grpc-web/index.esm.js"
 * import * as grpcWeb from "/node-modules/grpc-web/index.esm.js"
 * import * as grpcWeb from "https://cdn.jsdelivr.net/npm/grpc-web@1.2.1/index.esm.js"
 * ```
 */
import { writeFile, mkdir, readFile, rmdir, readdir } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";

const INCLUDE_DIRS = [
  "../../javascript/net/grpc/web",
  "../../third_party/closure-library/closure/goog/",
];
const ENTRYPOINT = "./exports.js";
const OUT_DIR = "./esm";

const REGEX_REQUIRE = /^((const|var)\s+([a-zA-Z]+)\s+=\s+)?goog.require(Type)?\('([.a-zA-Z]+)'\)/gm;

await initOutdir(OUT_DIR);
await traverseAndCopy(ENTRYPOINT, new Set(), OUT_DIR, INCLUDE_DIRS);
await rewrite(OUT_DIR);

// @procedure
async function rewrite(OUT_DIR) {
  const files = await readdir(OUT_DIR);

  await Promise.all(
    files.map(async (it) => {
      // rewrite require
      const file = await readFile(join(OUT_DIR, it));
      const filestr = file.toString();

      const rewrittenFilestr = filestr.replace(REGEX_REQUIRE, (it) => {
        const matches = it.match(/\('([.a-zA-Z]+)'\)$/);
        const requireName = matches.pop();
        if (it.startsWith("goog.require")) {
          log("legacy import");
          const symbolName = it.split(".").pop().split("')").shift();
          return `import * as ${symbolName} from "./${requireName}.js"`;
        } else {
          log("module import");
        }
      });

      await writeFile(join(OUT_DIR, it), rewrittenFilestr);
      // rewrite module
      // rewrite provide
    })
  );
}

// @procedure
// - Copying all dependencies of ENTRYPOINT recursivly into OUT_DIR
// - Copying into OUT_DIR results in a flat file hierarchy. No sub-folders
// - Filenames in OUT_DIR get the module name.
async function traverseAndCopy(
  filepath,
  seen,
  OUT_DIR,
  INCLUDE_DIRS,
  depth = 0
) {
  const file = await readFile(filepath);
  const filestr = file.toString();

  const moduleMatches = filestr.match(
    /^goog.(module|provide)\('([a-zA-Z.]+)'\)/m
  );
  if (!moduleMatches) {
    log("Failed to find a module declaration in", requireName);
    return;
  }
  const moduleName = moduleMatches.pop();
  log("-".repeat(depth), "Found module", moduleName);

  await writeFile(join(OUT_DIR, `${moduleName}.js`), filestr);

  const requireMatches = filestr.matchAll(REGEX_REQUIRE);

  const requireNames = [...requireMatches].map((it) => it.pop());

  for (const requireName of requireNames) {
    if (seen.has(requireName)) {
      continue;
    } else {
      seen.add(requireName);
    }

    let requireFile;
    try {
      const grep = `grep -iRl "^goog.module('${requireName}')\\|^goog.provide('${requireName}')" ${INCLUDE_DIRS.join(
        " "
      )}`;

      requireFile = await execShellCommand(grep);
    } catch (err) {
      log("Did not find module", requireName);
      continue;
    }

    requireFile = requireFile.trimEnd();
    if (seen.has(requireFile)) {
      continue;
    } else {
      seen.add(requireFile);
    }
    await traverseAndCopy(requireFile, seen, OUT_DIR, INCLUDE_DIRS, depth + 1);
  }
}

// @procedure
async function initOutdir(OUT_DIR) {
  await rmdir(OUT_DIR, { recursive: true })
    .then(() => log(`rmdir ${OUT_DIR}`))
    .catch(() => {});
  await mkdir(OUT_DIR).then(() => log(`mkdir ${OUT_DIR}`));
}

// @function with side effect
function log(...msgs) {
  console.log("[closure-to-esm.mjs]", ...msgs);
}

// @function with side effect
function execShellCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      }
      resolve(stdout ? stdout : stderr);
    });
  });
}
