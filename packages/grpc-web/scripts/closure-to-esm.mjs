import { write } from "fs";
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
import { writeFile, mkdir, readFile, rmdir } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";

const INCLUDE_DIRS = [
  "../../javascript/net/grpc/web",
  "../../third_party/closure-library/closure/goog/",
].join(" ");
const ENTRYPOINT = "./exports.js";
const OUT_DIR = "./esm";

await initOutdir(OUT_DIR);
let seen = new Set();
await traverseAndCopy(ENTRYPOINT, seen, OUT_DIR, INCLUDE_DIRS);

// Avoid reading the same file twice

// traverseAndCopy
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

  const requireMatches = filestr.matchAll(
    /^((const|var) ([a-zA-Z]+) = )?goog.require\('([.a-zA-Z]+)'\)/gm
  );

  const requireNames = [...requireMatches].map((it) => it.pop());

  for (const requireName of requireNames) {
    if (seen.has(requireName)) {
      continue;
    } else {
      seen.add(requireName);
    }

    let requireFile;
    try {
      const grepModule = `grep -iRl "^goog.module('${requireName}')\\|^goog.provide('${requireName}')" ${INCLUDE_DIRS}`;

      requireFile = await execShellCommand(grepModule);
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

// initOutdir
async function initOutdir(OUT_DIR) {
  await rmdir(OUT_DIR, { recursive: true })
    .then(() => log(`rmdir ${OUT_DIR}`))
    .catch(() => {});
  await mkdir(OUT_DIR).then(() => log(`mkdir ${OUT_DIR}`));
}

function log(...msgs) {
  console.log("[closure-to-esm.mjs]", ...msgs);
}

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
