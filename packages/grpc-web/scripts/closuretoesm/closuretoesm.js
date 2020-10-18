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
import {
  writeFile,
  mkdir,
  readFile,
  rmdir,
  readdir,
  unlink,
} from "fs/promises";
import { join } from "path";

import {
  rewriteModules,
  rewriteRequires,
  REGEX_REQUIRE,
  rewriteExports,
  rewriteLegacyNamespace,
  rewriteGoog,
} from "./rewriters.js";
import { execShellCommand } from "./execshellcommand.js";
import { OUT_DIR, INCLUDE_DIRS, ENTRYPOINT } from "./config.js";

await main();

/**
 * @procedure main()
 *    - Runs first.
 *    - Dictates which order everything else runs in.
 */
async function main() {
  await rimrafmkdir(OUT_DIR);
  log("Step ✅", "Cleared", OUT_DIR);

  await traverseAndCopy(ENTRYPOINT, new Set(), OUT_DIR, INCLUDE_DIRS);
  log("Step ✅", "Traversed and copied dependencies");

  await rewrite(OUT_DIR);
  log("Step ✅", "Converted all dependencies to esm-style");

  // await cleanup(OUT_DIR);
  log("Step ✅", "Cleaned up temp files");

  await makeIndexJs(OUT_DIR);
  log("Step ✅", "Created index.js");
}

/**
 * @procedure makeIndexJs()
 *    - Creates the `index.js` file for the entire `OUT_DIR`.
 *    - The functions exported from `index.js` file are supposed to be the API
 *      to the rest of the world.
 */
async function makeIndexJs(OUT_DIR) {
  const indexJs = `/**
 * @fileoverview Export symbols needed by generated code in ES modules style
 */
export { AbstractClientBase } from "./grpc.web.index.js";
export { GrpcWebClientBase } from "./grpc.web.index.js";
export { StatusCode } from "./grpc.web.index.js";
export { MethodDescriptor } from "./grpc.web.index.js";
export { MethodType } from "./grpc.web.index.js";
`;
  await writeFile(`${OUT_DIR}/index.js`, indexJs);
}

/**
 * @procedure cleanup()
 *    - Deletes all `.closure.js` temp-files from `OUT_DIR`
 */
async function cleanup(OUT_DIR) {
  const filenames = await readdir(OUT_DIR);
  const closureFiles = filenames.filter((it) => it.endsWith(".closure.js"));

  await Promise.all(
    closureFiles.map(async (it) => await unlink(`${OUT_DIR}/${it}`))
  );
}

/**
 * @procedure rewrite()
 *    - Reads all `.closure.js`-files in `OUT_DIR`, and apply rewrite-rules to them.
 *    - Writes `.js`-files back to `OUT_DIR`.
 */
async function rewrite(OUT_DIR) {
  const filenames = await readdir(OUT_DIR);
  const closureFiles = filenames.filter((it) => it.endsWith(".closure.js"));

  await Promise.all(
    closureFiles.map(async (fileName) => {
      // rewrite require
      const file = await readFile(join(OUT_DIR, fileName));
      const filestr0 = file.toString();

      const outFilename = fileName.replace(".closure.js", ".js");

      // 1. goog.modules
      const [filestr1, modules] = rewriteModules(filestr0);
      await Promise.all(
        modules.map(async ({ exportName, packageName }) => {
          await execShellCommand(
            `echo "export { ${exportName} } from \\"./${outFilename}\\"" >> "${OUT_DIR}/${packageName}.index.js"`
          );
        })
      );

      // 2. goog.requires
      const [filestr2] = rewriteRequires(filestr1);

      // 3. goog.exports
      const [filestr4, exports] = rewriteExports(filestr2);
      const parts = fileName.replace(".closure.js", "").split(".");
      const packageName = parts.slice(0, parts.length - 1).join(".");

      await Promise.all(
        exports.map(async ({ exportName }) => {
          await execShellCommand(
            `echo "export { ${exportName} } from \\"./${outFilename}\\"" >> "${OUT_DIR}/${packageName}.index.js"`
          );
        })
      );

      // 4. goog legacy namespaces
      const [filestr5] = rewriteLegacyNamespace(filestr4);

      // 5. Rewrite goog.js utilities
      const [filestr6] = rewriteGoog(filestr5);

      await writeFile(`${OUT_DIR}/${outFilename}`, filestr6);
    })
  );
}

/**
 * @recursive traverseAndCopy()
 *    - Copies all dependencies of `ENTRYPOINT` recursivly into `OUT_DIR`
 *    - Ensures `OUT_DIR` has a flat file hierarchy - no sub-folders.
 *    - Ensures filenames in `OUT_DIR` are `closure module name` + `.js`
 *    - Example: `goog.debug.error.js`
 */
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
    /^goog.(module|provide)\('([a-zA-Z][.a-zA-Z0-9]*)'\)/m
  );
  if (!moduleMatches) {
    log("Failed to find a module declaration in", filepath);
    return;
  }
  const moduleName = moduleMatches.pop();
  const outFilename = filepath.split("/").pop().replace(".js", ".closure.js");
  const parts = moduleName.split(".");
  const packageName = parts.slice(0, parts.length - 1).join(".");
  const outFullFilename = `${packageName}.${outFilename}`;

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

/**
 * @procedure rimrafmkdir
 *    - Removes existing `OUT_DIR`, before creating a new one.
 */
async function rimrafmkdir(OUT_DIR) {
  await rmdir(OUT_DIR, { recursive: true }).catch(() => {});
  await mkdir(OUT_DIR);
}

/** @function log() - Logs with cool prefix.*/
function log(...msgs) {
  console.log("[closuretoesm.js]", ...msgs);
}
