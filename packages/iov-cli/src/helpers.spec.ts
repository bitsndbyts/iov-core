import { createContext } from "vm";

import { executeJavaScript, executeJavaScriptAsync } from "./helpers";

describe("Helpers", () => {
  describe("executeJavaScript", () => {
    it("can execute simple JavaScript", () => {
      {
        const context = createContext({});
        expect(executeJavaScript("123", "myfile.js", context)).toEqual(123);
      }

      {
        const context = createContext({});
        expect(executeJavaScript("1+1", "myfile.js", context)).toEqual(2);
      }
    });

    it("can execute multiple commands in one context", () => {
      const context = createContext({});
      expect(executeJavaScript("let a", "myfile.js", context)).toBeUndefined();
      expect(executeJavaScript("a = 2", "myfile.js", context)).toEqual(2);
      expect(executeJavaScript("a", "myfile.js", context)).toEqual(2);
      expect(executeJavaScript("let b = 3", "myfile.js", context)).toBeUndefined();
      expect(executeJavaScript("a+b", "myfile.js", context)).toEqual(5);
    });

    it("has no require() in sandbox context", () => {
      const context = createContext({});
      expect(executeJavaScript("typeof require", "myfile.js", context)).toEqual("undefined");
    });

    it("has no exports object in sandbox context", () => {
      const context = createContext({});
      expect(executeJavaScript("typeof exports", "myfile.js", context)).toEqual("undefined");
    });

    it("has no module object in sandbox context", () => {
      const context = createContext({});
      expect(executeJavaScript("typeof module", "myfile.js", context)).toEqual("undefined");
    });

    it("can use require when passed into sandbox context", () => {
      const context = createContext({ require: require });
      expect(executeJavaScript("const path = require('path')", "myfile.js", context)).toBeUndefined();
      expect(executeJavaScript("path.join('.')", "myfile.js", context)).toEqual(".");
    });

    it("can use module when passed into sandbox context", () => {
      const context = createContext({ module: module });
      expect(executeJavaScript("module.exports.fooTest", "myfile.js", context)).toBeUndefined();
      expect(executeJavaScript("module.exports.fooTest = 'bar'", "myfile.js", context)).toEqual("bar");
      expect(executeJavaScript("module.exports.fooTest", "myfile.js", context)).toEqual("bar");
      // roll back change to module.exports
      module.exports.fooTest = undefined;
    });

    it("can use exports when passed into sandbox context", () => {
      const context = createContext({ exports: {} });
      expect(executeJavaScript("exports.fooTest", "myfile.js", context)).toBeUndefined();
      expect(executeJavaScript("exports.fooTest = 'bar'", "myfile.js", context)).toEqual("bar");
      expect(executeJavaScript("exports.fooTest", "myfile.js", context)).toEqual("bar");
    });
  });

  describe("executeJavaScriptAsync", () => {
    it("can execute basic async code", async () => {
      const context = createContext({});
      expect(await executeJavaScriptAsync("await (1)", "myfile.js", context)).toEqual(1);
    });

    it("can execute timeout promise code", async () => {
      const context = createContext({ setTimeout: setTimeout });
      const code = "await (new Promise(resolve => setTimeout(() => resolve('job done'), 5)))";
      expect(await executeJavaScriptAsync(code, "myfile.js", context)).toEqual("job done");
    });

    it("can execute timeout code in multiple statements", async () => {
      const context = createContext({ setTimeout: setTimeout });
      const code = `
        const promise = new Promise(resolve => {
          setTimeout(() => resolve('job done'), 5);
        });
        await (promise);
      `;
      expect(await executeJavaScriptAsync(code, "myfile.js", context)).toEqual("job done");
    });
  });
});
