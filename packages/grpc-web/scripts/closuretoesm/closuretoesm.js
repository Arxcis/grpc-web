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
  copyFile,
} from "fs/promises";
import { join } from "path";

import {
  rewriteModules,
  rewriteRequires,
  REGEX_REQUIRE,
  rewriteExports,
  rewriteLegacyNamespace,
  rewriteGoog,
  rewriteEsImports,
  rewriteEsExports,
  rewriteAliases,
} from "./rewriters.js";
import {
  execShellCommand,
  appendLineToFile,
  replaceLine,
  deleteLine,
  appendLineToLine,
} from "./execshellcommand.js";
import { OUT_DIR, INCLUDE_DIRS, ENTRYPOINT, GOOG_DIR } from "./config.js";

await main();

/**
 * @procedure main()
 *    - Runs first.
 *    - Dictates which order everything else runs in.
 */
async function main() {
  await rimrafmkdir(OUT_DIR);
  log("Step ✅", "Cleared", OUT_DIR);

  await provideGoog(OUT_DIR, GOOG_DIR);
  log("Step ✅", "Copied base.js and goog.js");

  await makeIndexJs(OUT_DIR);
  log("Step ✅", "Created index.js");

  await traverseAndCopy(ENTRYPOINT, new Set(), OUT_DIR, INCLUDE_DIRS);
  log("Step ✅", "Traversed and copied dependencies");

  await patch(OUT_DIR);
  log("Step ✅", "Applied patches");

  await rewrite(OUT_DIR);
  log("Step ✅", "Converted all dependencies to esm-style");

  //await cleanup(OUT_DIR);
  log("Step ✅", "Cleaned up temp .closure.js-files");
}

/**
 * @procedure provideGoog
 *     - provide goog.js utility to the files that need it.
 */
async function provideGoog(OUT_DIR, GOOG_DIR) {
  await Promise.all([
    copyFile(`${GOOG_DIR}/base.js`, `${OUT_DIR}/base.js`),
    copyFile(`${GOOG_DIR}/goog.js`, `${OUT_DIR}/goog.js`),
  ]);

  let basejs = (await readFile(`${OUT_DIR}/base.js`)).toString();
  basejs = basejs.replace(
    "goog.global.CLOSURE_NO_DEPS;",
    "goog.global.CLOSURE_NO_DEPS = true;"
  );
  await writeFile(`${OUT_DIR}/base.js`, basejs);
}

/**
 * @procedure makeIndexJs()
 *    - Creates the `index.js` file for the entire `OUT_DIR`.
 *    - The functions exported from `index.js` file are supposed to be the API
 *      to the rest of the world.
 */
async function makeIndexJs(OUT_DIR) {
  const indexJs = `/**
 * @fileoverview Export symbols to the ouside world ES modules style
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
  {
    const filenames = await readdir(OUT_DIR);
    const closureFiles = filenames.filter((it) => it.endsWith(".closure.js"));

    await Promise.all(
      closureFiles.map(async (fileName) => {
        const outFilename = fileName.replace(".closure.js", ".js");
        const file = await readFile(join(OUT_DIR, fileName));
        let res = file.toString();

        res = rewriteAliases(res, fileName);
        res = rewriteModules(res[0], fileName);
        // Re-export in index.js-file
        await Promise.all(
          res[1].map(async ({ exportName, packageName }) => {
            await appendLineToFile(
              `export { ${exportName} } from \\"./${outFilename}\\";`,
              `${OUT_DIR}/${packageName}.index.js`
            );
          })
        );

        res = rewriteRequires(res[0], fileName);
        res = rewriteExports(res[0], fileName);

        // Re-export in index.js-file if not already re-exported
        const parts = fileName.replace(".closure.js", "").split(".");
        const packageName = parts.slice(0, parts.length - 1).join(".");
        await Promise.all(
          res[1].map(async ({ exportName }) => {
            await execShellCommand(
              `echo "export { ${exportName} } from \\"./${outFilename}\\";" >> "${OUT_DIR}/${packageName}.index.js"`
            );
          })
        );

        res = rewriteLegacyNamespace(res[0], fileName);
        res = rewriteGoog(res[0], fileName);
        res = rewriteEsImports(res[0], fileName);

        await writeFile(`${OUT_DIR}/${outFilename}`, res[0]);
      })
    );
  }
  // Load all index.js for rewriting the exports
  {
    const filenames = await readdir(OUT_DIR);
    const indexFiles = filenames.filter((it) => it.endsWith("index.js"));
    await Promise.all(
      indexFiles.map(async (filename) => {
        const file = (await readFile(`${OUT_DIR}/${filename}`)).toString();
        const [res] = rewriteEsExports(file);
        await writeFile(`${OUT_DIR}/${filename}`, res);
      })
    );
  }
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

  const moduleMatches = filestr.match(/^goog.(module|provide)\('([\w.]+)'\)/m);
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

/**
 * @procedure patch
 *    - Here are some patches I apply before transforming
 *    - These transformations are patches, because they cannot be generalized.
 *    - They are on-off edge-cases.
 *    - It can be bugs, missing things, or just patches
 *    - that makes it much easier to work with the code base
 */
async function patch(OUT_DIR) {
  await Promise.all([
    // Patch 1: Add missing 'goog.events'-require in 'goog.events.eventtype'
    appendLineToLine(
      "goog.require('goog.userAgent');",
      "goog.require('goog.events');",
      `${OUT_DIR}/goog.events.eventtype.closure.js`
    ),
    // Patch 2: Add missing 'goog.html'-provide in 'goog.html.safeurl'
    appendLineToLine(
      "goog.provide('goog.html.SafeUrl');",
      "goog.provide('goog.html');",
      `${OUT_DIR}/goog.html.safeurl.closure.js`
    ),
    // Patch 3a: Declare NATIVE_ARRAY_PROTOTYPE as local const, because does not exist as goog.CONST
    replaceLine(
      "goog.NATIVE_ARRAY_PROTOTYPES =",
      "const NATIVE_ARRAY_PROTOTYPES = TRUSTED_SITE;",
      `${OUT_DIR}/goog.array.closure.js`
    ),
    // Patch 3a:
    deleteLine(
      "goog.define('goog.NATIVE_ARRAY_PROTOTYPES', goog.TRUSTED_SITE);",
      `${OUT_DIR}/goog.array.closure.js`
    ),
    // Patch 4: Append some missing to base.js
    appendLineToFile(`export { goog };`, `${OUT_DIR}/base.js`),
    // Patch 5: Append some missing exports to goog.js
    appendLineToFile(
      `import { goog } from \\"./base.js\\";`,
      `${OUT_DIR}/goog.js`
    ),
    // Patch 5:
    appendLineToFile(
      `export const createTrustedTypesPolicy = goog.createTrustedTypesPolicy;`,
      `${OUT_DIR}/goog.js`
    ),
    // Patch 5:
    appendLineToFile(
      `export const getScriptNonce = goog.getScriptNonce;`,
      `${OUT_DIR}/goog.js`
    ),
    // Patch 5:
    appendLineToFile(
      `export const FEATURESET_YEAR = goog.FEATURESET_YEAR;`,
      `${OUT_DIR}/goog.js`
    ),
    /**
     *  Patch 6: Configure base.js to not automatically load closure deps
     *
     * From `base.js`:
     * >In uncompiled mode base.js will attempt to load Closure's deps file, unless
     *  the global <code>CLOSURE_NO_DEPS</code> is set to true.  This allows projects
     *  to include their own deps file(s) from different locations.
     */
    replaceLine(
      "goog.global.CLOSURE_NO_DEPS;",
      "goog.global.CLOSURE_NO_DEPS = true;",
      `${OUT_DIR}/base.js`
    ),
    // Patch 7a: Declare ASSUME_NATIVE_PROMISE as local const
    replaceLine(
      "goog.ASSUME_NATIVE_PROMISE = goog.define('goog.ASSUME_NATIVE_PROMISE', false);",
      "const ASSUME_NATIVE_PROMISE = false;",
      `${OUT_DIR}/goog.async.run.closure.js`
    ),
    // Patch 8: Remove Interceptor module, as it has no symbols
    deleteLine(
      "goog.module('grpc.web.Interceptor');",
      `${OUT_DIR}/grpc.web.interceptor.closure.js`
    ),
  ]);

  await Promise.all([
    // Patch 3b: Rewrite goog.NATIVE_ARRAY_PROTOTYPE -> NATIVE_ARRAY_PROTOTYPE
    replaceLine(
      "goog.NATIVE_ARRAY_PROTOTYPES",
      "NATIVE_ARRAY_PROTOTYPES",
      `${OUT_DIR}/goog.array.closure.js`
    ),
    // Patch 7b: Rewrite goog.ASSUME_NATIVE_PROMISE -> ASSUME_NATIVE_PROMISE
    replaceLine(
      "goog.ASSUME_NATIVE_PROMISE",
      "ASSUME_NATIVE_PROMISE",
      `${OUT_DIR}/goog.async.run.closure.js`
    ),
  ]);
}
