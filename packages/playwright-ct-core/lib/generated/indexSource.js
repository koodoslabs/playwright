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
var indexSource_exports = {};
__export(indexSource_exports, {
  source: () => source
});
module.exports = __toCommonJS(indexSource_exports);
const source = '"use strict";\n\n// packages/playwright-ct-core/src/injected/importRegistry.ts\nfunction isImportRef(value) {\n  return typeof value === "object" && value && value.__pw_type === "importRef";\n}\nvar ImportRegistry = class {\n  constructor() {\n    this._registry = /* @__PURE__ */ new Map();\n  }\n  initialize(components) {\n    for (const [name, value] of Object.entries(components))\n      this._registry.set(name, value);\n  }\n  async resolveImportRef(importRef) {\n    const importFunction = this._registry.get(importRef.id);\n    if (!importFunction)\n      throw new Error(`Unregistered component: ${importRef.id}. Following components are registered: ${[...this._registry.keys()]}`);\n    let importedObject = await importFunction();\n    if (!importedObject)\n      throw new Error(`Could not resolve component: ${importRef.id}.`);\n    if (importRef.property) {\n      importedObject = importedObject[importRef.property];\n      if (!importedObject)\n        throw new Error(`Could not instantiate component: ${importRef.id}.${importRef.property}.`);\n    }\n    return importedObject;\n  }\n};\n\n// packages/playwright-ct-core/src/injected/serializers.ts\nfunction isFunctionRef(value) {\n  return value && typeof value === "object" && value.__pw_type === "function";\n}\nasync function unwrapObject(value) {\n  return transformObjectAsync(value, async (v) => {\n    if (isFunctionRef(v)) {\n      const result = (...args) => {\n        window.__ctDispatchFunction(v.ordinal, args);\n      };\n      return { result };\n    }\n    if (isImportRef(v))\n      return { result: await window.__pwRegistry.resolveImportRef(v) };\n  });\n}\nfunction transformObject(value, mapping) {\n  const result = mapping(value);\n  if (result)\n    return result.result;\n  if (value === null || typeof value !== "object")\n    return value;\n  if (value instanceof Date || value instanceof RegExp || value instanceof URL)\n    return value;\n  if (Array.isArray(value)) {\n    const result3 = [];\n    for (const item of value)\n      result3.push(transformObject(item, mapping));\n    return result3;\n  }\n  if ((value == null ? void 0 : value.__pw_type) === "jsx" && typeof value.type === "function") {\n    throw new Error([\n      `Component "${value.type.name}" cannot be mounted.`,\n      `Most likely, this component is defined in the test file. Create a test story instead.`,\n      `For more information, see https://playwright.dev/docs/test-components#test-stories.`\n    ].join("\\n"));\n  }\n  const result2 = {};\n  for (const [key, prop] of Object.entries(value))\n    result2[key] = transformObject(prop, mapping);\n  return result2;\n}\nasync function transformObjectAsync(value, mapping) {\n  const result = await mapping(value);\n  if (result)\n    return result.result;\n  if (value === null || typeof value !== "object")\n    return value;\n  if (value instanceof Date || value instanceof RegExp || value instanceof URL)\n    return value;\n  if (Array.isArray(value)) {\n    const result3 = [];\n    for (const item of value)\n      result3.push(await transformObjectAsync(item, mapping));\n    return result3;\n  }\n  const result2 = {};\n  for (const [key, prop] of Object.entries(value))\n    result2[key] = await transformObjectAsync(prop, mapping);\n  return result2;\n}\n\n// packages/playwright-ct-core/src/injected/index.ts\nwindow.__pwRegistry = new ImportRegistry();\nwindow.__pwUnwrapObject = unwrapObject;\nwindow.__pwTransformObject = transformObject;\n';
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  source
});
