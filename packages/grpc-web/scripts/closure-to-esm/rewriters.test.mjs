import {
  rewriteProvides,
  rewriteRequires,
  rewriteModules,
} from "./rewriters.mjs";

testRewriter({
  title:
    "Given goog.provide('goog.Example') it should return export { Example }",
  rewriter: rewriteProvides,
  cases: [
    { input: `goog.provide('goog.Example');`, output: `export { Example };` },
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

function testRewriter({ title, rewriter, cases }) {
  for (const { input, output } of cases) {
    const actual = rewriter(input);
    if (actual.trim() === output.trim()) {
      console.log(`[rewriters.test.mjs] ${title}:`);
    } else {
      console.log(`[rewriters.test.mjs] ${title}\nFAILURE!\n:`);
      console.log({ expect: output, actual });
    }
  }
}
