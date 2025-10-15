"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var mount_exports = {};
__export(mount_exports, {
  fixtures: () => fixtures
});
module.exports = __toCommonJS(mount_exports);
var import_serializers = require("./injected/serializers");
var import_router = require("./router");
let boundCallbacksForMount = [];
const fixtures = {
  _optionContextReuseMode: "when-possible",
  serviceWorkers: "block",
  page: async ({ page }, use, info) => {
    if (!info._configInternal.defineConfigWasUsed)
      throw new Error("Component testing requires the use of the defineConfig() in your playwright-ct.config.{ts,js}: https://aka.ms/playwright/ct-define-config");
    if (!process.env.PLAYWRIGHT_TEST_BASE_URL)
      throw new Error("Component testing could not determine the base URL of your component under test. Ensure you have supplied a template playwright/index.html or have set the PLAYWRIGHT_TEST_BASE_URL environment variable.");
    await page._wrapApiCall(async () => {
      await page.exposeFunction("__ctDispatchFunction", (ordinal, args) => {
        boundCallbacksForMount[ordinal](...args);
      });
      await page.goto(process.env.PLAYWRIGHT_TEST_BASE_URL);
    }, { internal: true });
    await use(page);
  },
  mount: async ({ page }, use) => {
    await use(async (componentRef, options) => {
      const selector = await page._wrapApiCall(async () => {
        return await innerMount(page, componentRef, options);
      }, { internal: true });
      const locator = page.locator(selector);
      return Object.assign(locator, {
        unmount: async () => {
          await locator.evaluate(async () => {
            const rootElement = document.getElementById("root");
            await window.playwrightUnmount(rootElement);
          });
        },
        update: async (options2) => {
          if (isJsxComponent(options2))
            return await innerUpdate(page, options2);
          await innerUpdate(page, componentRef, options2);
        }
      });
    });
    boundCallbacksForMount = [];
  },
  router: async ({ context, baseURL }, use) => {
    const router = new import_router.Router(context, baseURL);
    await use(router);
    await router.dispose();
  }
};
function isJsxComponent(component) {
  return typeof component === "object" && component && component.__pw_type === "jsx";
}
async function innerUpdate(page, componentRef, options = {}) {
  const component = (0, import_serializers.wrapObject)(createComponent(componentRef, options), boundCallbacksForMount);
  await page.evaluate(async ({ component: component2 }) => {
    component2 = await window.__pwUnwrapObject(component2);
    const rootElement = document.getElementById("root");
    return await window.playwrightUpdate(rootElement, component2);
  }, { component });
}
async function innerMount(page, componentRef, options = {}) {
  const component = (0, import_serializers.wrapObject)(createComponent(componentRef, options), boundCallbacksForMount);
  await page.waitForFunction(() => !!window.playwrightMount);
  const selector = await page.evaluate(async ({ component: component2, hooksConfig }) => {
    component2 = await window.__pwUnwrapObject(component2);
    hooksConfig = await window.__pwUnwrapObject(hooksConfig);
    let rootElement = document.getElementById("root");
    if (!rootElement) {
      rootElement = document.createElement("div");
      rootElement.id = "root";
      document.body.appendChild(rootElement);
    }
    await window.playwrightMount(component2, rootElement, hooksConfig);
    return "#root >> internal:control=component";
  }, { component, hooksConfig: options.hooksConfig });
  return selector;
}
function createComponent(component, options = {}) {
  if (component.__pw_type === "jsx")
    return component;
  return {
    __pw_type: "object-component",
    type: component,
    ...options
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  fixtures
});
