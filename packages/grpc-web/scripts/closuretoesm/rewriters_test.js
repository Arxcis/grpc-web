import {
  rewriteRequires,
  rewriteModules,
  rewriteExports,
  rewriteLegacyNamespace,
} from "./rewriters.js";

testRewriter({
  title: `Given a goog.require()" is declared, we should rewrite all references in file`,
  rewriter: rewriteRequires,
  cases: [
    {
      input: `
goog.require('goog.debug.Error');
goog.require('goog.asserts');
      
goog.asserts.AssertionError = function(messagePattern, messageArgs) {
  goog.debug.Error.call(this, goog.asserts.subs_(messagePattern, messageArgs));
`,
      output: `
import { Error } from "./goog.debug.index.js";
import { asserts } from "./goog.index.js";
      
asserts.AssertionError = function(messagePattern, messageArgs) {
  Error.call(this, asserts.subs_(messagePattern, messageArgs));
`,
    },
  ],
});

testRewriter({
  title: `Given a goog.module() is declared, we should rewrite all references in file`,
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
      output: `export { Example };\nlet Example = {};`,
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

// testRewriter basically defines a micro testing framework specialized only for testing ./rewriters.mjs
function testRewriter({ title, rewriter, cases }) {
  for (const { input, output } of cases) {
    const [actual] = rewriter(input);
    if (actual === output) {
      console.log(`[rewriters.test.mjs] Test ✅ ${title}`);
    } else {
      console.log(`[rewriters.test.mjs] Test ❌ ${title} \nFAILURE!`);
      console.log({ given: input, expect: output, actual });
    }
  }
}
