import {
  rewriteRequires,
  rewriteModules,
} from "./rewriters.mjs";

testRewriter({
  title: `Given a single "goog.provide()" it should rewrite to a single "export{}"`,
  rewriter: rewriteModules,
  cases: [
    {
      input: `goog.provide('goog.Example');`,
      output: `export { Example };`,
    },
    {
      input: `

goog.provide('goog.my.Example');
`,

      output: `

export { Example };
`,
    },
  ],
});

testRewriter({
  title: `Given multiple "goog.provide()" it should rewrite to multiple "export {}"`,
  rewriter: rewriteModules,
  cases: [
    {
      input: `
  goog.provide('goog.Example');
goog.provide('goog.Example.Two');

class Example;
`,
      output: `
export { Example };
export { Two };

class Example;
`,
    },
    {
      input: `

      goog.provide('goog.Example');
      goog.provide('goog.Example.Two');
goog.provide('goog.haa.ha.ha.Example.Four');
goog.provide('goog.Example.Ten');
`,

      output: `

export { Example };
export { Two };
export { Four };
export { Ten };
`,
    },
  ],
});

testRewriter({
  title: `Given "goog.module()" it should rewrite to "export {}"`,
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
  title: `Given "goog.require()" it should rewrite to import {} from ""`,
  rewriter: rewriteRequires,
  cases: [
    {
      input: `goog.require('goog.Example');`,
      output: `import { Example } from "./goog.index.js";`,
    },
    {
      input: `
    
    goog.require('goog.my.Example');
    `,

      output: `
    
import { Example } from "./goog.my.index.js";
    `,
    },
  ],
});

// testRewriter basically defines a micro testing framework specialized only for testing ./rewriters.mjs
async function testRewriter({ title, rewriter, cases }) {
  for (const { input, output } of cases) {
    const [actual] = await rewriter(input);
    if (actual === output) {
      console.log(`[rewriters.test.mjs] Test ✅ ${title}`);
    } else {
      console.log(`[rewriters.test.mjs] Test ❌ ${title} \nFAILURE!`);
      console.log({ given: input, expect: output, actual });
    }
  }
}
