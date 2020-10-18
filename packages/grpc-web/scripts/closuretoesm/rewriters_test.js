import {
  rewriteRequires,
  rewriteModules,
  rewriteExports,
  rewriteLegacyNamespace,
  rewriteGoog,
  rewriteEsImports,
  rewriteEsExports,
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
  title: `Given: exports =, we should rewrite it exports {}`,
  rewriter: rewriteExports,
  cases: [
    {
      input: `exports = UnaryResponse;`,
      output: `export { UnaryResponse };`,
    },
    {
      input: `exports.Status = Status;`,
      output: `export { Status };`,
    },
    {
      input: `
            exports = UnaryResponse;


`,
      output: `
export { UnaryResponse };


`,
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
  title: `Given a single "goog.provide()", we should rewrite it to a single: "export{}"`,
  rewriter: rewriteModules,
  cases: [
    {
      input: `goog.provide('goog.Example');`,
      output: `export { Example };\nlet Example = {};\n`,
    },
    {
      input: `

goog.provide('goog.my.Example');
`,

      output: `

export { Example };
let Example = {};

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

export { Two };
let Two = {};


Example;
`,
    },
    {
      input: `

      goog.provide('goog.Example');
      goog.provide('goog.Example.Two');
goog.provide('goog.haa.ha.ha.Four');
goog.provide('goog.Example.Ten');
`,

      output: `

export { Example };
let Example = {};

export { Two };
let Two = {};

export { Four };
let Four = {};

export { Ten };
let Ten = {};

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
      output: `export { Example };`,
    },
    {
      input: `
  
  goog.module('goog.my.Example');
  `,

      output: `
  
export { Example };
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
      input: `    goog.requireType('goog.mytype.Example');`,
      output: `import { Example } from "./goog.mytype.index.js";`,
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
