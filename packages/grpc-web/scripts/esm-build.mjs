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
import { readdir, mkdir, copyFile, readFile } from "fs/promises";
import { join } from "path"

const GRPC_WEB_SRC_DIR = "../../javascript/net/grpc/web";
const GRPC_WEB_OUT_DIR = "./goog/net/grpc/web";

const files = await readdir(GRPC_WEB_SRC_DIR)
const jsFiles = files.filter(it => it.endsWith(".js") && !it.endsWith("_test.js"));

await mkdir(GRPC_WEB_OUT_DIR, { recursive: true })

await Promise.all(
    jsFiles.map(
        it => copyFile(join(GRPC_WEB_SRC_DIR, it), join(GRPC_WEB_OUT_DIR, it))
    )
);



await Promise.all(
    jsFiles.map(async (it) => {
        const file = await readFile(join(GRPC_WEB_OUT_DIR, it));
        
        let output = "";
        {
            output += "--------goog.module----------\n"
            const fileStr = file.toString();
            const matches = fileStr.replace(/goog.module\('[.a-zA-Z]+'\);/g, (it) => {


                let res = it;
                res = res.match(/\('([.a-zA-Z]+)'\)/)[1]
                    output += res + "\n"
            });
            output += ""+ "\n"
        }

        {
            output += "--------goog.require----------"+ "\n"
            const fileStr = file.toString();
            const matches = fileStr.replace(/[ a-zA-Z]+ = goog.require\('[.a-zA-Z]+'\);/g, (it) => {

                let res = it;
                res = res.match(/\('([.a-zA-Z]+)'\)/)[1]
                output += res+ "\n"
            });
            output += ""+ "\n"
        }

        {
            output += "--------exports = ----------"+ "\n"
            const fileStr = file.toString();
            const matches = fileStr.replace(/exports = .*;/, (it) => {
                output += it+ "\n"
            });
        }

        console.log("\n\n/// ", it, "---------------------------------------//")
        console.log(output)
        console.log(" /// ", it, "---------------------------------------//")
    })
);
