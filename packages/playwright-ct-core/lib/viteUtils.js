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
var viteUtils_exports = {};
__export(viteUtils_exports, {
  createConfig: () => createConfig,
  frameworkConfig: () => frameworkConfig,
  hasJSComponents: () => hasJSComponents,
  populateComponentsFromTests: () => populateComponentsFromTests,
  resolveDirs: () => resolveDirs,
  resolveEndpoint: () => resolveEndpoint,
  transformIndexFile: () => transformIndexFile
});
module.exports = __toCommonJS(viteUtils_exports);
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_compilationCache = require("playwright/lib/transform/compilationCache");
var import_transform = require("playwright/lib/transform/transform");
var import_utilsBundle = require("playwright-core/lib/utilsBundle");
const log = (0, import_utilsBundle.debug)("pw:vite");
async function resolveDirs(configDir, config) {
  const use = config.projects[0].use;
  const relativeTemplateDir = use.ctTemplateDir || "playwright";
  const templateDir = await import_fs.default.promises.realpath(import_path.default.normalize(import_path.default.join(configDir, relativeTemplateDir))).catch(() => void 0);
  if (!templateDir)
    return null;
  const outDir = use.ctCacheDir ? import_path.default.resolve(configDir, use.ctCacheDir) : import_path.default.resolve(templateDir, ".cache");
  return {
    configDir,
    outDir,
    templateDir
  };
}
function resolveEndpoint(config) {
  const use = config.projects[0].use;
  const baseURL = new URL(use.baseURL || "http://localhost");
  return {
    https: baseURL.protocol.startsWith("https:") ? {} : void 0,
    host: baseURL.hostname,
    port: use.ctPort || Number(baseURL.port) || 3100
  };
}
async function createConfig(dirs, config, frameworkPluginFactory, supportJsxInJs) {
  const endpoint = resolveEndpoint(config);
  const use = config.projects[0].use;
  const baseConfig = {
    root: dirs.templateDir,
    configFile: false,
    publicDir: import_path.default.join(dirs.configDir, "public"),
    define: {
      __VUE_PROD_DEVTOOLS__: true
    },
    css: {
      devSourcemap: true
    },
    build: {
      outDir: dirs.outDir
    },
    preview: endpoint,
    server: endpoint,
    // Vite preview server will otherwise always return the index.html with 200.
    appType: "mpa"
  };
  const { mergeConfig } = await import("vite");
  const userConfig = typeof use.ctViteConfig === "function" ? await use.ctViteConfig() : use.ctViteConfig || {};
  const baseAndUserConfig = mergeConfig(baseConfig, userConfig);
  const frameworkOverrides = { plugins: [] };
  if (supportJsxInJs) {
    log("jsx-in-js detected");
    frameworkOverrides.esbuild = {
      loader: "jsx",
      include: /.*\.jsx?$/,
      exclude: []
    };
    frameworkOverrides.optimizeDeps = {
      esbuildOptions: {
        loader: { ".js": "jsx" }
      }
    };
  }
  frameworkOverrides.build = {
    target: "esnext",
    minify: false,
    rollupOptions: {
      treeshake: false,
      input: {
        index: import_path.default.join(dirs.templateDir, "index.html")
      }
    },
    sourcemap: true
  };
  if (frameworkPluginFactory && !baseAndUserConfig.plugins?.length)
    frameworkOverrides.plugins = [await frameworkPluginFactory()];
  return mergeConfig(baseAndUserConfig, frameworkOverrides);
}
async function populateComponentsFromTests(componentRegistry, componentsByImportingFile) {
  const importInfos = await (0, import_compilationCache.getUserData)("playwright-ct-core");
  for (const [file, importList] of importInfos) {
    for (const importInfo of importList)
      componentRegistry.set(importInfo.id, importInfo);
    if (componentsByImportingFile)
      componentsByImportingFile.set(file, importList.map((i) => (0, import_transform.resolveHook)(i.filename, i.importSource)).filter(Boolean));
  }
}
function hasJSComponents(components) {
  for (const component of components) {
    const importPath = (0, import_transform.resolveHook)(component.filename, component.importSource);
    const extname = importPath ? import_path.default.extname(importPath) : "";
    if (extname === ".js" || importPath && !extname && import_fs.default.existsSync(importPath + ".js"))
      return true;
  }
  return false;
}
const importReactRE = /(^|\n|;)import\s+(\*\s+as\s+)?React(,|\s+)/;
const compiledReactRE = /(const|var)\s+React\s*=/;
function transformIndexFile(id, content, templateDir, registerSource, importInfos) {
  if (id.endsWith(".js") && content.includes("React.createElement") && !content.match(importReactRE) && !content.match(compiledReactRE)) {
    const code = `import React from 'react';
${content}`;
    return { code, map: { mappings: "" } };
  }
  const indexTs = import_path.default.join(templateDir, "index.ts");
  const indexTsx = import_path.default.join(templateDir, "index.tsx");
  const indexJs = import_path.default.join(templateDir, "index.js");
  const indexJsx = import_path.default.join(templateDir, "index.jsx");
  const idResolved = import_path.default.resolve(id);
  if (!idResolved.endsWith(indexTs) && !idResolved.endsWith(indexTsx) && !idResolved.endsWith(indexJs) && !idResolved.endsWith(indexJsx))
    return null;
  const lines = [content, ""];
  lines.push(registerSource);
  for (const value of importInfos.values()) {
    const importPath = (0, import_transform.resolveHook)(value.filename, value.importSource) || value.importSource;
    lines.push(`const ${value.id} = () => import('${importPath?.replaceAll(import_path.default.sep, "/")}').then((mod) => mod.${value.remoteName || "default"});`);
  }
  lines.push(`__pwRegistry.initialize({ ${[...importInfos.keys()].join(",\n  ")} });`);
  return {
    code: lines.join("\n"),
    map: { mappings: "" }
  };
}
function frameworkConfig(config) {
  return config["@playwright/experimental-ct-core"];
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createConfig,
  frameworkConfig,
  hasJSComponents,
  populateComponentsFromTests,
  resolveDirs,
  resolveEndpoint,
  transformIndexFile
});
