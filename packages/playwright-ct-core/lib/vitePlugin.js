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
var vitePlugin_exports = {};
__export(vitePlugin_exports, {
  buildBundle: () => buildBundle,
  createPlugin: () => createPlugin
});
module.exports = __toCommonJS(vitePlugin_exports);
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_utils = require("playwright-core/lib/utils");
var import_utilsBundle = require("playwright-core/lib/utilsBundle");
var import_compilationCache = require("playwright/lib/transform/compilationCache");
var import_transform = require("playwright/lib/transform/transform");
var import_util = require("playwright/lib/util");
var import_utilsBundle2 = require("playwright/lib/utilsBundle");
var import_devServer = require("./devServer");
var import_indexSource = require("./generated/indexSource");
var import_viteUtils = require("./viteUtils");
const log = (0, import_utilsBundle.debug)("pw:vite");
let stoppableServer;
const playwrightVersion = (0, import_utils.getPlaywrightVersion)();
function createPlugin() {
  let configDir;
  let config;
  return {
    name: "playwright-vite-plugin",
    setup: async (configObject, configDirectory) => {
      config = configObject;
      configDir = configDirectory;
    },
    begin: async (suite) => {
      const result = await buildBundle(config, configDir);
      if (!result)
        return;
      const { viteConfig } = result;
      const { preview } = await import("vite");
      const previewServer = await preview(viteConfig);
      stoppableServer = (0, import_utilsBundle2.stoppable)(previewServer.httpServer, 0);
      const isAddressInfo = (x) => x?.address;
      const address = previewServer.httpServer.address();
      if (isAddressInfo(address)) {
        const protocol = viteConfig.preview.https ? "https:" : "http:";
        process.env.PLAYWRIGHT_TEST_BASE_URL = `${protocol}//${viteConfig.preview.host}:${address.port}`;
      }
    },
    end: async () => {
      if (stoppableServer)
        await new Promise((f) => stoppableServer.stop(f));
    },
    populateDependencies: async () => {
      await buildBundle(config, configDir);
    },
    startDevServer: async () => {
      return await (0, import_devServer.runDevServer)(config);
    },
    clearCache: async () => {
      const configDir2 = config.configFile ? import_path.default.dirname(config.configFile) : config.rootDir;
      const dirs = await (0, import_viteUtils.resolveDirs)(configDir2, config);
      if (dirs)
        await (0, import_util.removeDirAndLogToConsole)(dirs.outDir);
    }
  };
}
async function buildBundle(config, configDir) {
  const { registerSourceFile, frameworkPluginFactory } = (0, import_viteUtils.frameworkConfig)(config);
  {
    const endpoint = (0, import_viteUtils.resolveEndpoint)(config);
    const protocol = endpoint.https ? "https:" : "http:";
    const url = new URL(`${protocol}//${endpoint.host}:${endpoint.port}`);
    if (await (0, import_utils.isURLAvailable)(url, true)) {
      console.log(`Dev Server is already running at ${url.toString()}, using it.
`);
      process.env.PLAYWRIGHT_TEST_BASE_URL = url.toString();
      return null;
    }
  }
  const dirs = await (0, import_viteUtils.resolveDirs)(configDir, config);
  if (!dirs) {
    console.log(import_utilsBundle.colors.red(`Component testing template file playwright/index.html is missing and there is no existing Vite server. Component tests will fail.
`));
    return null;
  }
  const buildInfoFile = import_path.default.join(dirs.outDir, "metainfo.json");
  let buildExists = false;
  let buildInfo;
  const registerSource = import_indexSource.source + "\n" + await import_fs.default.promises.readFile(registerSourceFile, "utf-8");
  const registerSourceHash = (0, import_utils.calculateSha1)(registerSource);
  const { version: viteVersion, build, mergeConfig } = await import("vite");
  try {
    buildInfo = JSON.parse(await import_fs.default.promises.readFile(buildInfoFile, "utf-8"));
    (0, import_utils.assert)(buildInfo.version === playwrightVersion);
    (0, import_utils.assert)(buildInfo.viteVersion === viteVersion);
    (0, import_utils.assert)(buildInfo.registerSourceHash === registerSourceHash);
    buildExists = true;
  } catch (e) {
    buildInfo = {
      version: playwrightVersion,
      viteVersion,
      registerSourceHash,
      components: [],
      sources: {},
      deps: {}
    };
  }
  log("build exists:", buildExists);
  const componentRegistry = /* @__PURE__ */ new Map();
  const componentsByImportingFile = /* @__PURE__ */ new Map();
  await (0, import_viteUtils.populateComponentsFromTests)(componentRegistry, componentsByImportingFile);
  const hasNewComponents = await checkNewComponents(buildInfo, componentRegistry);
  log("has new components:", hasNewComponents);
  const sourcesDirty = !buildExists || hasNewComponents || await checkSources(buildInfo);
  log("sourcesDirty:", sourcesDirty);
  buildInfo.components = [...componentRegistry.values()];
  const jsxInJS = (0, import_viteUtils.hasJSComponents)(buildInfo.components);
  const viteConfig = await (0, import_viteUtils.createConfig)(dirs, config, frameworkPluginFactory, jsxInJS);
  if (sourcesDirty) {
    log("build");
    const depsCollector = /* @__PURE__ */ new Map();
    const buildConfig = mergeConfig(viteConfig, {
      plugins: [vitePlugin(registerSource, dirs.templateDir, buildInfo, componentRegistry, depsCollector)]
    });
    await build(buildConfig);
    buildInfo.deps = Object.fromEntries(depsCollector.entries());
  }
  {
    for (const [importingFile, components] of componentsByImportingFile) {
      const deps = /* @__PURE__ */ new Set();
      for (const component of components) {
        for (const d of buildInfo.deps[component])
          deps.add(d);
      }
      (0, import_compilationCache.setExternalDependencies)(importingFile, [...deps]);
    }
  }
  if (hasNewComponents || sourcesDirty) {
    log("write manifest");
    await import_fs.default.promises.writeFile(buildInfoFile, JSON.stringify(buildInfo, void 0, 2));
  }
  return { buildInfo, viteConfig };
}
async function checkSources(buildInfo) {
  for (const [source, sourceInfo] of Object.entries(buildInfo.sources)) {
    try {
      const timestamp = (await import_fs.default.promises.stat(source)).mtimeMs;
      if (sourceInfo.timestamp !== timestamp) {
        log("source has changed:", source);
        return true;
      }
    } catch (e) {
      log("check source failed:", e);
      return true;
    }
  }
  return false;
}
async function checkNewComponents(buildInfo, componentRegistry) {
  const newComponents = [...componentRegistry.keys()];
  const oldComponents = new Map(buildInfo.components.map((c) => [c.id, c]));
  let hasNewComponents = false;
  for (const c of newComponents) {
    if (!oldComponents.has(c)) {
      hasNewComponents = true;
      break;
    }
  }
  for (const c of oldComponents.values()) {
    try {
      if (await import_fs.default.promises.stat(c.filename))
        componentRegistry.set(c.id, c);
    } catch (e) {
      if (e.code !== "ENOENT")
        throw e;
      log("non existent file, skipping component registry:", c.filename);
    }
  }
  return hasNewComponents;
}
function vitePlugin(registerSource, templateDir, buildInfo, importInfos, depsCollector) {
  buildInfo.sources = {};
  let moduleResolver;
  return {
    name: "playwright:component-index",
    configResolved(config) {
      moduleResolver = config.createResolver();
    },
    async transform(content, id) {
      const queryIndex = id.indexOf("?");
      const file = queryIndex !== -1 ? id.substring(0, queryIndex) : id;
      if (!buildInfo.sources[file]) {
        try {
          const timestamp = (await import_fs.default.promises.stat(file)).mtimeMs;
          buildInfo.sources[file] = { timestamp };
        } catch {
        }
      }
      return (0, import_viteUtils.transformIndexFile)(id, content, templateDir, registerSource, importInfos);
    },
    async writeBundle() {
      for (const importInfo of importInfos.values()) {
        const importPath = (0, import_transform.resolveHook)(importInfo.filename, importInfo.importSource);
        if (!importPath)
          continue;
        const deps = /* @__PURE__ */ new Set();
        const id = await moduleResolver(importPath);
        if (!id)
          continue;
        collectViteModuleDependencies(this, id, deps);
        depsCollector.set(importPath, [...deps]);
      }
    }
  };
}
function collectViteModuleDependencies(context, id, deps) {
  if (!import_path.default.isAbsolute(id))
    return;
  const normalizedId = import_path.default.normalize(id);
  if (deps.has(normalizedId))
    return;
  deps.add(normalizedId);
  const module2 = context.getModuleInfo(id);
  for (const importedId of module2?.importedIds || [])
    collectViteModuleDependencies(context, importedId, deps);
  for (const importedId of module2?.dynamicallyImportedIds || [])
    collectViteModuleDependencies(context, importedId, deps);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildBundle,
  createPlugin
});
