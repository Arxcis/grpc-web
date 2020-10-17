/**
 * Closure to esm tool - closuretoesm.mjs
 * 
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
import { writeFile, mkdir, readFile, rmdir, readdir, unlink } from "fs/promises";
import { join } from "path";

import { rewriteModules, rewriteRequires } from "./rewriters.mjs";
import { execShellCommand } from "./execshellcommand.mjs";
import { OUT_DIR, INCLUDE_DIRS, ENTRYPOINT } from "./config.mjs";

const REGEX_REQUIRE = /^((const|var)\s+([a-zA-Z]+)\s+=\s+)?goog.require(Type)?\('([.a-zA-Z]+)'\)/gm;

await initOutdir(OUT_DIR);
await traverseAndCopy(ENTRYPOINT, new Set(), OUT_DIR, INCLUDE_DIRS);
await rewrite(OUT_DIR);
await cleanup(OUT_DIR);

// @procedure
async function cleanup(OUT_DIR) {
  const filenames = await readdir(OUT_DIR);
  const closureFiles = filenames.filter(it => it.endsWith(".closure.js"))

  await Promise.all(closureFiles.map(async it => await unlink(`${OUT_DIR}/${it}`)));
}

// @procedure
// - Read all .closure.js-files in OUT_DIR, and apply rewrite-rules to them.
// - Write .js-files back to OUT_DIR
async function rewrite(OUT_DIR) {
  const filenames = await readdir(OUT_DIR);
  const closureFiles = filenames.filter((it) => it.endsWith(".closure.js"));

  await Promise.all(
    closureFiles.map(async (fileName) => {
      // rewrite require
      const file = await readFile(join(OUT_DIR, fileName));
      let filestr = file.toString();

      const outFilename = fileName.replace(".closure.js", ".js");

      // 1. Rewrite goog.modules
      const [rewrittenFilestr, exports] = rewriteModules(filestr);
      // Re-export exports in package-level index.js file
      await Promise.all(exports.map(async ({ exportName, packageName }) => {
        await execShellCommand(`echo "export { ${exportName} } from \\"./${outFilename}\\"" >> "${OUT_DIR}/${packageName}.index.js"`)
      }));

      // 2. Rewrite goog.requires
      const [finalFilestr] = rewriteRequires(rewrittenFilestr)

      await writeFile(`${OUT_DIR}/${outFilename}`, finalFilestr);
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
  const outFilename = filepath.split("/").pop().replace(".js", ".closure.js");
  const parts = moduleName.split(".");
  const packageName = parts.slice(0, parts.length-1).join(".")
  const outFullFilename = `${packageName}.${outFilename}`;

  log("-".repeat(depth), "Found module", moduleName);

  await writeFile(`${OUT_DIR}/${outFullFilename}`, filestr);

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

