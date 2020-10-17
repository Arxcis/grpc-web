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

import { REWRITERS } from "./rewriters.mjs";

const ENTRYPOINT = "./exports.js";
const OUT_DIR = "./esm";
const INCLUDE_DIRS = [
  "../../javascript/net/grpc/web",
  "../../third_party/closure-library/closure/goog/",
];

const REGEX_REQUIRE = /^((const|var)\s+([a-zA-Z]+)\s+=\s+)?goog.require(Type)?\('([.a-zA-Z]+)'\)/gm;

//await initOutdir(OUT_DIR);
//await traverseAndCopy(ENTRYPOINT, new Set(), OUT_DIR, INCLUDE_DIRS);
await rewrite(OUT_DIR, REWRITERS);

// @procedure
async function rewrite(OUT_DIR, REWRITERS) {
  let filenames = await readdir(OUT_DIR);
  filenames = filenames.filter((it) => it.endsWith(".closure.js"));

  await Promise.all(
    filenames.map(async (it) => {
      // rewrite require
      const file = await readFile(join(OUT_DIR, it));
      let filestr = file.toString();

      for (const func of REWRITERS) {
        filestr = func(filestr);
      }

      const outFilename = `${it.replace(".closure", "")}`;
      await writeFile(join(OUT_DIR, outFilename), filestr);
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

  await writeFile(join(OUT_DIR, `${moduleName}.closure.js`), filestr);

  const requireMatches = filestr.matchAll(REGEX_REQUIRE);
  const requireNames = [...requireMatches].map((it) => it.pop());

  await Promise.all(
    requireNames.map(async (it) => {
      if (seen.has(it)) {
        return;
      }
      seen.add(it);

      let requireFile;
      try {
        const grep = `grep -iRl "^goog.module('${it}')\\|^goog.provide('${it}')" ${INCLUDE_DIRS.join(
          " "
        )}`;
        requireFile = await execShellCommand(grep);
      } catch (err) {
        log("Did not find module", it);
        return;
      }

      requireFile = requireFile.trimEnd();
      if (seen.has(requireFile)) {
        return;
      }
      seen.add(requireFile);

      await traverseAndCopy(
        requireFile,
        seen,
        OUT_DIR,
        INCLUDE_DIRS,
        depth + 1
      );
    })
  );
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
