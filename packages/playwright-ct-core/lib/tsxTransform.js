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
var tsxTransform_exports = {};
__export(tsxTransform_exports, {
  default: () => tsxTransform_default,
  importInfo: () => importInfo
});
module.exports = __toCommonJS(tsxTransform_exports);
var import_path = __toESM(require("path"));
var import_babelBundle = require("playwright/lib/transform/babelBundle");
var import_transform = require("playwright/lib/transform/transform");
const t = import_babelBundle.types;
let jsxComponentNames;
let importInfos;
var tsxTransform_default = (0, import_babelBundle.declare)((api) => {
  api.assertVersion(7);
  const result = {
    name: "playwright-debug-transform",
    visitor: {
      Program: {
        enter(path2) {
          jsxComponentNames = collectJsxComponentUsages(path2.node);
          importInfos = /* @__PURE__ */ new Map();
        },
        exit(path2) {
          let firstDeclaration;
          let lastImportDeclaration;
          path2.get("body").forEach((p) => {
            if (p.isImportDeclaration())
              lastImportDeclaration = p;
            else if (!firstDeclaration)
              firstDeclaration = p;
          });
          const insertionPath = lastImportDeclaration || firstDeclaration;
          if (!insertionPath)
            return;
          for (const [localName, componentImport] of [...importInfos.entries()].reverse()) {
            insertionPath.insertAfter(
              t.variableDeclaration(
                "const",
                [
                  t.variableDeclarator(
                    t.identifier(localName),
                    t.objectExpression([
                      t.objectProperty(t.identifier("__pw_type"), t.stringLiteral("importRef")),
                      t.objectProperty(t.identifier("id"), t.stringLiteral(componentImport.id))
                    ])
                  )
                ]
              )
            );
          }
          (0, import_transform.setTransformData)("playwright-ct-core", [...importInfos.values()]);
        }
      },
      ImportDeclaration(p) {
        const importNode = p.node;
        if (!t.isStringLiteral(importNode.source))
          return;
        const ext = import_path.default.extname(importNode.source.value);
        if (artifactExtensions.has(ext)) {
          for (const specifier of importNode.specifiers) {
            if (t.isImportNamespaceSpecifier(specifier))
              continue;
            const { localName, info } = importInfo(importNode, specifier, this.filename);
            importInfos.set(localName, info);
          }
          p.skip();
          p.remove();
          return;
        }
        let importCount = 0;
        for (const specifier of importNode.specifiers) {
          if (t.isImportNamespaceSpecifier(specifier))
            continue;
          const { localName, info } = importInfo(importNode, specifier, this.filename);
          if (jsxComponentNames.has(localName)) {
            importInfos.set(localName, info);
            ++importCount;
          }
        }
        if (importCount && importCount === importNode.specifiers.length) {
          p.skip();
          p.remove();
        }
      },
      MemberExpression(path2) {
        if (!t.isIdentifier(path2.node.object))
          return;
        if (!importInfos.has(path2.node.object.name))
          return;
        if (!t.isIdentifier(path2.node.property))
          return;
        path2.replaceWith(
          t.objectExpression([
            t.spreadElement(t.identifier(path2.node.object.name)),
            t.objectProperty(t.identifier("property"), t.stringLiteral(path2.node.property.name))
          ])
        );
      }
    }
  };
  return result;
});
function collectJsxComponentUsages(node) {
  const names = /* @__PURE__ */ new Set();
  (0, import_babelBundle.traverse)(node, {
    enter: (p) => {
      if (t.isJSXElement(p.node)) {
        if (t.isJSXIdentifier(p.node.openingElement.name))
          names.add(p.node.openingElement.name.name);
        if (t.isJSXMemberExpression(p.node.openingElement.name) && t.isJSXIdentifier(p.node.openingElement.name.object) && t.isJSXIdentifier(p.node.openingElement.name.property))
          names.add(p.node.openingElement.name.object.name);
      }
    }
  });
  return names;
}
function importInfo(importNode, specifier, filename) {
  const importSource = importNode.source.value;
  const idPrefix = import_path.default.join(filename, "..", importSource).replace(/[^\w_\d]/g, "_");
  const result = {
    id: idPrefix,
    filename,
    importSource,
    remoteName: void 0
  };
  if (t.isImportDefaultSpecifier(specifier)) {
  } else if (t.isIdentifier(specifier.imported)) {
    result.remoteName = specifier.imported.name;
  } else {
    result.remoteName = specifier.imported.value;
  }
  if (result.remoteName)
    result.id += "_" + result.remoteName;
  return { localName: specifier.local.name, info: result };
}
const artifactExtensions = /* @__PURE__ */ new Set([
  // Frameworks
  ".vue",
  ".svelte",
  // Images
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".svg",
  ".bmp",
  ".webp",
  ".ico",
  // CSS
  ".css",
  // Fonts
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot"
]);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  importInfo
});
