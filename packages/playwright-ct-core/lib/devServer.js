"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var devServer_exports = {};
__export(devServer_exports, {
  runDevServer: () => runDevServer
});
module.exports = __toCommonJS(devServer_exports);
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_fsWatcher = require("playwright/lib/fsWatcher");
var import_utilsBundle = require("playwright-core/lib/utilsBundle");
var import_indexSource = require("./generated/indexSource");
var import_viteUtils = require("./viteUtils");
async function runDevServer(config) {
  const { registerSourceFile, frameworkPluginFactory } = (0, import_viteUtils.frameworkConfig)(config);
  const componentRegistry = /* @__PURE__ */ new Map();
  await (0, import_viteUtils.populateComponentsFromTests)(componentRegistry);
  const configDir = config.configFile ? import_path.default.dirname(config.configFile) : config.rootDir;
  const dirs = await (0, import_viteUtils.resolveDirs)(configDir, config);
  if (!dirs) {
    console.log(import_utilsBundle.colors.red(`Component testing template file playwright/index.html is missing and there is no existing Vite server. Component tests will fail.
`));
    return async () => {
    };
  }
  const registerSource = import_indexSource.source + "\n" + await import_fs.default.promises.readFile(registerSourceFile, "utf-8");
  const viteConfig = await (0, import_viteUtils.createConfig)(dirs, config, frameworkPluginFactory, false);
  viteConfig.plugins.push({
    name: "playwright:component-index",
    async transform(content, id) {
      return (0, import_viteUtils.transformIndexFile)(id, content, dirs.templateDir, registerSource, componentRegistry);
    }
  });
  const { createServer } = await import("vite");
  const devServer = await createServer(viteConfig);
  await devServer.listen();
  const protocol = viteConfig.server.https ? "https:" : "http:";
  console.log(`Dev Server listening on ${protocol}//${viteConfig.server.host || "localhost"}:${viteConfig.server.port}`);
  const projectDirs = /* @__PURE__ */ new Set();
  const projectOutputs = /* @__PURE__ */ new Set();
  for (const p of config.projects) {
    projectDirs.add(p.testDir);
    projectOutputs.add(p.outputDir);
  }
  const globalWatcher = new import_fsWatcher.Watcher(async () => {
    const registry = /* @__PURE__ */ new Map();
    await (0, import_viteUtils.populateComponentsFromTests)(registry);
    if (componentRegistry.size === registry.size && [...componentRegistry.keys()].every((k) => registry.has(k)))
      return;
    console.log("List of components changed");
    componentRegistry.clear();
    for (const [k, v] of registry)
      componentRegistry.set(k, v);
    const id = import_path.default.join(dirs.templateDir, "index");
    const modules = [...devServer.moduleGraph.urlToModuleMap.values()];
    const rootModule = modules.find((m) => m.file?.startsWith(id + ".ts") || m.file?.startsWith(id + ".js"));
    if (rootModule)
      devServer.moduleGraph.onFileChange(rootModule.file);
  });
  await globalWatcher.update([...projectDirs], [...projectOutputs], false);
  return () => Promise.all([devServer.close(), globalWatcher.close()]).then(() => {
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  runDevServer
});
