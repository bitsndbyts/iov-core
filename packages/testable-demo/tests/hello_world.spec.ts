const helloWorldModule = require('../src/hello_world');

describe("Hello World Server", function() {
  it("says hello", function() {
    expect(helloWorldModule).toBeTruthy();
    expect(helloWorldModule.helloWorld()).toEqual('Hello world!');
  });

  it("supports promises", () => {
    const unresolvedPromise = new Promise(() => {});
    expect(unresolvedPromise).toBeTruthy();
  });
});
