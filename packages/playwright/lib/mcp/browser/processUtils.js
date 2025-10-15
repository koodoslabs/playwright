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
var processUtils_exports = {};
__export(processUtils_exports, {
  findBrowserProcess: () => findBrowserProcess,
  getBrowserExecPath: () => getBrowserExecPath
});
module.exports = __toCommonJS(processUtils_exports);
var import_child_process = __toESM(require("child_process"));
var import_fs = __toESM(require("fs"));
var import_registry = require("playwright-core/lib/server/registry/index");
function getBrowserExecPath(channelOrName) {
  return import_registry.registry.findExecutable(channelOrName)?.executablePath("javascript");
}
function findBrowserProcess(execPath, arg) {
  const predicate = (line) => line.includes(execPath) && line.includes(arg) && !line.includes("--type");
  try {
    switch (process.platform) {
      case "darwin":
        return findProcessMacos(predicate);
      case "linux":
        return findProcessLinux(predicate);
      case "win32":
        return findProcessWindows(execPath, arg, predicate);
      default:
        return void 0;
    }
  } catch {
    return void 0;
  }
}
function findProcessLinux(predicate) {
  const procDirs = import_fs.default.readdirSync("/proc").filter((name) => /^\d+$/.test(name));
  for (const pid of procDirs) {
    try {
      const cmdlineBuffer = import_fs.default.readFileSync(`/proc/${pid}/cmdline`);
      const cmdline = cmdlineBuffer.toString().replace(/\0/g, " ").trim();
      if (predicate(cmdline))
        return `${pid} ${cmdline}`;
    } catch {
      continue;
    }
  }
  return void 0;
}
function findProcessMacos(predicate) {
  const result = import_child_process.default.spawnSync("/bin/ps", ["-axo", "pid=,command="]);
  if (result.status !== 0 || !result.stdout)
    return void 0;
  return findMatchingLine(result.stdout.toString(), predicate);
}
function findProcessWindows(execPath, arg, predicate) {
  const psEscape = (path) => `'${path.replaceAll("'", "''")}'`;
  const filter = `$_.ExecutablePath -eq ${psEscape(execPath)} -and $_.CommandLine.Contains(${psEscape(arg)}) -and $_.CommandLine -notmatch '--type'`;
  const ps = import_child_process.default.spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Get-CimInstance Win32_Process | Where-Object { ${filter} } | Select-Object -Property ProcessId,CommandLine | ForEach-Object { "$($_.ProcessId) $($_.CommandLine)" }`
    ],
    { encoding: "utf8" }
  );
  if (ps.status !== 0 || !ps.stdout)
    return void 0;
  return findMatchingLine(ps.stdout.toString(), predicate);
}
function findMatchingLine(psOutput, predicate) {
  const lines = psOutput.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.find(predicate);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  findBrowserProcess,
  getBrowserExecPath
});
