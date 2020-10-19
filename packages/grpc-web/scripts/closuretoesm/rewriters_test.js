import {
  rewriteRequires,
  rewriteModules,
  rewriteExports,
  rewriteLegacyNamespace,
  rewriteGoog,
  rewriteEsImports,
  rewriteEsExports,
  rewriteAliases,
} from "./rewriters.js";

testRewriter({
  title: `Given a goog.require()" is declared, we should rewrite all references in file`,
  rewriter: rewriteRequires,
  cases: [
    {
      input: `
goog.require('goog.debug.Error');
goog.require('goog.asserts');
goog.require('goog.asserts.AssertionError');

goog.asserts.AssertionError = function(messagePattern, messageArgs) {
  goog.debug.Error.call(this,goog.asserts.subs_(messagePattern, messageArgs));
`,
      output: `
import { Error } from "./goog.debug.index.js";
import { asserts } from "./goog.index.js";
import { AssertionError } from "./goog.asserts.index.js";

AssertionError = function(messagePattern, messageArgs) {
  Error.call(this,asserts.subs_(messagePattern, messageArgs));
`,
    },
  ],
});

testRewriter({
  title: `Given a goog.provide() is declared, we should rewrite all references in file`,
  rewriter: rewriteModules,
  cases: [
    {
      input: `
goog.provide('goog.array');

goog.array.peek = function(array) {
  return array[array.length - 1];
};

goog.array.map = goog.NATIVE_ARRAY_PROTOTYPES &&
        (goog.array.ASSUME_NATIVE_FUNCTIONS || Array.prototype.map) ?
`,
      output: `
export { array };
let array = {};


array.peek = function(array) {
  return array[array.length - 1];
};

array.map = goog.NATIVE_ARRAY_PROTOTYPES &&
        (array.ASSUME_NATIVE_FUNCTIONS || Array.prototype.map) ?
`,
    },
    {
      input: `
goog.provide('goog.asserts');
goog.provide('goog.asserts.AssertionError');
goog.asserts.AssertionError = function(messagePattern, messageArgs) {
`,
      output: `
export { asserts };
let asserts = {};

export { AssertionError };
let AssertionError = {};

AssertionError = function(messagePattern, messageArgs) {
`,
    },
  ],
});

testRewriter({
  title: `Given: goog.module.declareLegacyNamespace(), we should remove it`,
  rewriter: rewriteLegacyNamespace,
  cases: [
    {
      input: `goog.module.declareLegacyNamespace();`,
      output: ``,
    },
  ],
});

testRewriter({
  title: `Given: exports = name;, we should rewrite`,
  rewriter: rewriteExports,
  cases: [
    {
      input: `exports = UnaryResponse;\n`,
      output: ``,
    },
    {
      input: `exports.Status = Status;\n`,
      output: ``,
    },
    {
      input: `
exports = {
  UnaryInterceptor,
  StreamInterceptor
};`,
      output: `
export { UnaryInterceptor, StreamInterceptor };`,
    },
    {
      input: "exports.GenericTransportInterface;",
      output: "let GenericTransportInterface;",
    },
  ],
});

testRewriter({
  title:
    "Given exports.NAME = something, we should rewrite to export const NAME = something",
  rewriter: rewriteExports,
  cases: [
    {
      input: "exports.HTTP_HEADERS_PARAM_NAME = '$httpHeaders';",
      output: "export const HTTP_HEADERS_PARAM_NAME = '$httpHeaders';",
    },
    {
      input: "exports.generateHttpHeadersOverwriteParam = function(headers) {",
      output:
        "export const generateHttpHeadersOverwriteParam = function(headers) {",
    },
    {
      input: "exports.generateHttpHeadersOverwriteParam(headers));",
      output: "generateHttpHeadersOverwriteParam(headers));",
    },
    {
      input:
        "  var httpHeaders = exports.generateHttpHeadersOverwriteParam(extraHeaders);",
      output:
        "  var httpHeaders = generateHttpHeadersOverwriteParam(extraHeaders);",
    },
  ],
});

testRewriter({
  title: `Given a single "goog.provide()", we should rewrite it to a single: "export{}"`,
  rewriter: rewriteModules,
  cases: [
    {
      input: `goog.provide('goog.Example');`,
      output: ``,
    },
    {
      input: `

goog.provide('goog.my.Example');
goog.my.Example = 
`,

      output: `

export { Example };
let Example = {};

Example = 
`,
    },
  ],
});

testRewriter({
  title: `Given multiple "goog.provide()", we should rewrite it to multiple: "export {}"`,
  rewriter: rewriteModules,
  cases: [
    {
      input: `
  goog.provide('goog.Example');
goog.provide('goog.Example.Two');

goog.Example;
`,
      output: `
export { Example };
let Example = {};



Example;
`,
    },
  ],
});

testRewriter({
  title: `Given "goog.module()", we should rewrite it to: "export {}"`,
  rewriter: rewriteModules,
  cases: [
    {
      input: `goog.module('goog.Example');`,
      output: ``,
    },
    {
      input: `
goog.module('goog.my.Example');
class Example =
`,
      output: `
export { Example };
class Example =
`,
      input: `
goog.module('goog.my.Example');
const Example =
`,
      output: `
export { Example };
const Example =
`,
      input: `
goog.module('goog.my.Example');
function Example() {
`,
      output: `
export { Example };
function Example() {
`,
    },
  ],
});

testRewriter({
  title: `Given "goog.require()", we should rewrite it to: import {} from ""`,
  rewriter: rewriteRequires,
  cases: [
    {
      input: `goog.require('goog.Example');`,
      output: `import { Example } from "./goog.index.js";`,
    },
    {
      input: `goog.requireType('goog.mytype.Example');`,
      output: `import { Example } from "./goog.mytype.index.js";`,
    },
    {
      input: `goog.require('goog.events.EventId');`,
      output: `import { EventId } from "./goog.events.index.js";`,
    },
  ],
});

testRewriter({
  title: `Given "const v = goog.require()", we should rewrite it to: import {v} from ""`,
  rewriter: rewriteRequires,
  cases: [
    {
      input: `const Example = goog.require('goog.mytype.Example');`,
      output: `import { Example } from "./goog.mytype.index.js";`,
    },
    {
      input: `const example = goog.require('goog.mytype.Example');`,
      output: `import { Example as example } from "./goog.mytype.index.js";`,
    },
    {
      input: `var googCrypt = goog.require('goog.crypt.base64');`,
      output: `import { base64 as googCrypt } from "./goog.crypt.index.js";`,
    },
  ],
});

testRewriter({
  title: `Given "const {v} = goog.require()", we should rewrite it to: import {v} from ""`,
  rewriter: rewriteRequires,
  cases: [
    {
      input: `const {Status} = goog.require('grpc.web.Status');`,
      output: `import { Status } from "./grpc.web.index.js";`,
    },
    {
      input: `const {StreamInterceptor, UnaryInterceptor   } = goog.require('grpc.web.Interceptor');`,
      output: `import { StreamInterceptor, UnaryInterceptor } from "./grpc.web.index.js";`,
    },
  ],
});

testRewriter({
  title:
    "Given goog.<someFunction>(), it should be imported from goog.js as <SomeFunction>",
  rewriter: rewriteGoog,
  cases: [
    {
      input: `
  return goog.isObject(item) ? 'o' + goog.getUid(item) :
  (typeof item).charAt(0) + item;
  `,
      output: `import { isObject } from "./goog.js";
import { getUid } from "./goog.js";

  return isObject(item) ? 'o' + getUid(item) :
  (typeof item).charAt(0) + item;
  `,
    },
    {
      input: `if (goog.isArrayLike(arg) && !goog.isArray(arg)) {`,
      output: `import { isArrayLike } from "./goog.js";
import { isArray } from "./goog.js";
if (isArrayLike(arg) && !isArray(arg)) {`,
    },
    {
      input: "goog.bind",
      output: "goog.bind",
    },
    {
      input: "goog.bind()",
      output: `import { bind } from "./goog.js";\nbind()`,
    },
    {
      input: "let a = goog.DISALLOW_TEST_ONLY_CODE;\n",
      output: `import { DISALLOW_TEST_ONLY_CODE } from "./goog.js";\nlet a = DISALLOW_TEST_ONLY_CODE;\n`,
    },
  ],
});

testRewriter({
  title:
    "Given multiple consecutive imports, they should be merged to have 1 line per source file",
  rewriter: rewriteEsImports,
  cases: [
    {
      input: `
import { array as Array } from "./goog.index.js";
import { asserts } from "./goog.index.js";
import { SafeUrl } from "./goog.html.index.js";
import { Const } from "./goog.string.index.js";
import { TypedString } from "./goog.string.index.js";
import { internal } from "./goog.string.index.js";
`,
      output: `
import { Const, internal, TypedString } from "./goog.string.index.js";
import { array as Array, asserts } from "./goog.index.js";
import { SafeUrl } from "./goog.html.index.js";
`,
    },
  ],
});

testRewriter({
  title:
    "Given multiple concecutive exports, they should be merged to have 1 line per source file.",
  rewriter: rewriteEsExports,
  cases: [
    {
      input: `
export { XhrLike } from "./goog.net.xhrlike.js";
export { DefaultXmlHttpFactory } from "./goog.net.xmlhttp.js";
export { XmlHttpDefines } from "./goog.net.xmlhttp.js";
export { XmlHttp } from "./goog.net.xmlhttp.js";
`,
      output: `
export { DefaultXmlHttpFactory, XmlHttp, XmlHttpDefines } from "./goog.net.xmlhttp.js";
export { XhrLike } from "./goog.net.xhrlike.js";
`,
    },
  ],
});

testRewriter({
  title:
    "Regression-test of bug where moduleRewriter() rewrote goog.requires() also, when similar names:",
  rewriter: rewriteModules,
  cases: [
    {
      input: `
goog.provide('goog.events.Event');
goog.events.Event;
goog.require('goog.events.EventId');
`,
      output: `
export { Event };
let Event = {};

Event;
goog.require('goog.events.EventId');
`,
    },
  ],
});

testRewriter({
  title: "Given conflicting names, they should be aliased.",
  rewriter: rewriteAliases,
  cases: [
    {
      input: `export { asserts };\ngoog.require('goog.asserts');`,
      output: `export { asserts };\nconst googAsserts = goog.require('goog.asserts');`,
    },
  ],
});

// testRewriter basically defines a micro testing framework specialized only for testing ./rewriters.mjs
function testRewriter({ title, rewriter, cases }) {
  for (const { input, output } of cases) {
    const [actual] = rewriter(input);
    if (actual === output) {
      console.log(`[rewriters.test.mjs] Test ✅ ${title}`);
    } else {
      console.log(`[rewriters.test.mjs] Test ❌ ${title} \nFAILURE!`);
      console.log({
        given: input,
        expect: output,
        actual,
        diff: getDifference(output, actual),
      });
    }
  }
}

// @credits https://stackoverflow.com/a/57102605
function getDifference(a, b) {
  var i = 0;
  var j = 0;
  var result = "";

  while (j < b.length) {
    if (a[i] != b[j] || i == a.length) result += b[j];
    else i++;
    j++;
  }
  return result;
}
