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
  rewritePathsExceptFilepaths,
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

  const provideMap = new Map();
  await traverseAndCopy(
    ENTRYPOINT,
    new Set(),
    OUT_DIR,
    INCLUDE_DIRS,
    0,
    provideMap
  );
  log("Step ✅", "Traversed and copied dependencies");

  await patch(OUT_DIR);
  log("Step ✅", "Applied patches");

  await rewrite(OUT_DIR, provideMap);
  log("Step ✅", "Converted all dependencies to esm-style");

  await cleanup(OUT_DIR);
  log("Step ✅", "Cleaned up temp .closure.js-files");
}

/**
 * @procedure provideGoog
 *     - provide goog.js utility to the files that need it.
 */
async function provideGoog(OUT_DIR, GOOG_DIR) {
  await Promise.all([
    copyFile(`${GOOG_DIR}/base.js`, `${OUT_DIR}/goog.base.js`),
    copyFile(`${GOOG_DIR}/goog.js`, `${OUT_DIR}/goog.goog.js`),
  ]);

  let basejs = (await readFile(`${OUT_DIR}/goog.base.js`)).toString();
  basejs = basejs.replace(
    "goog.global.CLOSURE_NO_DEPS;",
    "goog.global.CLOSURE_NO_DEPS = true;"
  );
  await writeFile(`${OUT_DIR}/goog.base.js`, basejs);
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
 *
 *  @param {string} OUT_DIR
 *  @param {Map<string,string>} provideMap
 */
async function rewrite(OUT_DIR, provideMap) {
  {
    const filenames = await readdir(OUT_DIR);
    const closureFiles = filenames.filter((it) => it.endsWith(".closure.js"));

    await Promise.all(
      closureFiles.map(async (fileName) => {
        const outFilename = fileName.replace(/\.closure.js$/m, ".js");
        const file = await readFile(join(OUT_DIR, fileName));
        let res = file.toString();

        res = rewriteAliases(res, fileName);
        const [resmodules, pathsmodules] = rewriteModules(res, fileName);
        const [resrequires, pathsrequires] = rewriteRequires(
          resmodules,
          fileName,
          provideMap
        );

        res = rewritePathsExceptFilepaths(resrequires, [
          ...pathsmodules,
          ...pathsrequires,
        ]);
        res = rewriteExports(res, fileName);
        res = rewriteLegacyNamespace(res, fileName);
        res = rewriteGoog(res, fileName);
        res = rewriteEsImports(res, fileName);

        await writeFile(`${OUT_DIR}/${outFilename}`, res);
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
 *
 *  @param {string} filepath
 *  @param {Set<string>} seen
 *  @param {string} OUT_DIR
 *  @param {string[]} INCLUDE_DIRS
 *  @param {number} depth
 *  @param {Map<string,string>} provideMap
 */
async function traverseAndCopy(
  filepath,
  seen,
  OUT_DIR,
  INCLUDE_DIRS,
  depth,
  provideMap
) {
  // 0. Read file
  const file = await readFile(filepath);
  const filestr = file.toString();

  // 1. Flatten paths "grpc/web/abstractclientbase.js"- => "grpc.web.abstractclientbase.js"
  const jsFilename = INCLUDE_DIRS.reduce(
    (acc, it) => acc.replace(it + "/", ""),
    filepath
  )
    .replace(/(\w)\/(\w)/g, (...parts) => {
      const [, left, right] = parts;
      return `${left}.${right}`;
    })
    .replace(/^\w/m, (it) => `./${it}`);

  const closureFilename = jsFilename.replace(/\.js$/m, ".closure.js");

  // 2. Find all `goog.module(<provide-path>)`- and `goog.provide(<provide-path>)`-statements in file
  const provideMatches = [
    ...filestr.matchAll(/^goog.(module|provide)\('([\w.]+)'\);$/gm),
  ].map((it) => it.slice(0, 3));
  if (provideMatches.length === 0) {
    log("Failed to find a module declaration in", filepath);
    return;
  }

  // 3. Store the <provide-path> => <filename> mappings. (many-to-one-relationship)
  //
  // Example map:
  //  'grpc.web.Exports' => './exports.js',
  //  'grpc.web.AbstractClientBase' => './grpc.web.abstractclientbase.js'
  //
  for (const [, , providePath] of provideMatches) {
    provideMap.set(providePath, jsFilename);
  }

  // 4. Write file to new location, completing the copy
  await writeFile(`${OUT_DIR}/${closureFilename}`, filestr);

  // 5. Find all requires to figure out where to go next
  const requireMatches = filestr.matchAll(REGEX_REQUIRE);
  const requireNames = [...requireMatches].map((it) => it.pop());

  // 6. Run a search for all require-paths concurrently using Promise.all()
  await Promise.all(
    requireNames.map(async (it) => {
      // 7. Skip if we have loading this reuquire-path already
      if (seen.has(it)) {
        return;
      }
      seen.add(it);

      // 8. Grep for a single file including our require-path. Expect there to always be one.
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

      // 9. Skip if we have seen the file before
      requireFile = requireFile.trimEnd();
      if (seen.has(requireFile)) {
        return;
      }
      seen.add(requireFile);

      // 10. Recurse
      await traverseAndCopy(
        requireFile,
        seen,
        OUT_DIR,
        INCLUDE_DIRS,
        depth + 1,
        provideMap
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
      `${OUT_DIR}/goog.array.array.closure.js`
    ),
    // Patch 3a:
    deleteLine(
      "goog.define('goog.NATIVE_ARRAY_PROTOTYPES', goog.TRUSTED_SITE);",
      `${OUT_DIR}/goog.array.array.closure.js`
    ),
    // Patch 4: Append some missing to base.js
    appendLineToFile(`export { goog };`, `${OUT_DIR}/goog.base.js`),
    // Patch 5: Append some missing exports and imports to goog.js
    appendLineToFile(
      `
import { goog } from \\"./goog.base.js\\";
export const createTrustedTypesPolicy = goog.createTrustedTypesPolicy;
export const getScriptNonce = goog.getScriptNonce;
export const FEATURESET_YEAR = goog.FEATURESET_YEAR;
export const TRUSTED_TYPES_POLICY_NAME = goog.TRUSTED_TYPES_POLICY_NAME;
`,
      `${OUT_DIR}/goog.goog.js`
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
      `${OUT_DIR}/goog.base.js`
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
      `${OUT_DIR}/goog.array.array.closure.js`
    ),
    // Patch 7b: Rewrite goog.ASSUME_NATIVE_PROMISE -> ASSUME_NATIVE_PROMISE
    replaceLine(
      "goog.ASSUME_NATIVE_PROMISE",
      "ASSUME_NATIVE_PROMISE",
      `${OUT_DIR}/goog.async.run.closure.js`
    ),
  ]);
}
