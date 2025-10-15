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
var router_exports = {};
__export(router_exports, {
  Router: () => Router
});
module.exports = __toCommonJS(router_exports);
let lastRequestId = 0;
let fetchOverrideCounter = 0;
const currentlyInterceptingInContexts = /* @__PURE__ */ new Map();
const originalFetch = globalThis.fetch;
async function executeRequestHandlers(request, handlers, baseUrl) {
  const requestId = String(++lastRequestId);
  const resolutionContext = { baseUrl };
  for (const handler of handlers) {
    const result = await handler.run({ request, requestId, resolutionContext });
    if (result?.response)
      return result.response;
  }
}
function isMswRequestPassthrough(headers) {
  if (headers.get("x-msw-intention") === "bypass")
    return true;
  if (headers.get("accept")?.includes("msw/passthrough"))
    return true;
  return false;
}
async function globalFetch(...args) {
  if (args[0] && args[0] instanceof Request) {
    const request = args[0];
    if (isMswRequestPassthrough(request.headers)) {
      const cookieHeaders = await Promise.all([...currentlyInterceptingInContexts.keys()].map(async (context) => {
        const cookies = await context.cookies(request.url);
        if (!cookies.length)
          return void 0;
        return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
      }));
      if (!cookieHeaders.length)
        throw new Error(`Cannot call fetch(bypass()) outside of a request handler`);
      if (cookieHeaders.some((h) => h !== cookieHeaders[0]))
        throw new Error(`Cannot call fetch(bypass()) while concurrently handling multiple requests from different browser contexts`);
      const headers = new Headers(request.headers);
      headers.set("cookie", cookieHeaders[0]);
      {
        headers.delete("x-msw-intention");
        const accept = headers.get("accept")?.split(",").filter((h) => !h.includes("msw/")).join(",");
        if (accept)
          headers.set("accept", accept);
        else
          headers.delete("accept");
      }
      args[0] = new Request(request.clone(), { headers });
    }
  }
  return originalFetch(...args);
}
class Router {
  constructor(context, baseURL) {
    this._requestHandlers = [];
    this._requestHandlersActive = false;
    this._routes = [];
    this._context = context;
    this._requestHandlersRoute = async (route) => {
      if (route.request().isNavigationRequest()) {
        await route.fallback();
        return;
      }
      const request = route.request();
      const headersArray = await request.headersArray();
      const headers = new Headers();
      for (const { name, value } of headersArray)
        headers.append(name, value);
      const buffer = request.postDataBuffer();
      const body = buffer?.byteLength ? new Int8Array(buffer.buffer, buffer.byteOffset, buffer.length) : void 0;
      const newRequest = new Request(request.url(), {
        body,
        headers,
        method: request.method(),
        referrer: headersArray.find((h) => h.name.toLowerCase() === "referer")?.value
      });
      currentlyInterceptingInContexts.set(context, 1 + (currentlyInterceptingInContexts.get(context) || 0));
      const response = await executeRequestHandlers(newRequest, this._requestHandlers, baseURL).finally(() => {
        const value = currentlyInterceptingInContexts.get(context) - 1;
        if (value)
          currentlyInterceptingInContexts.set(context, value);
        else
          currentlyInterceptingInContexts.delete(context);
      });
      if (!response) {
        await route.fallback();
        return;
      }
      if (response.status === 302 && response.headers.get("x-msw-intention") === "passthrough") {
        await route.continue();
        return;
      }
      if (response.type === "error") {
        await route.abort();
        return;
      }
      const responseHeaders = {};
      for (const [name, value] of response.headers.entries()) {
        if (responseHeaders[name])
          responseHeaders[name] = responseHeaders[name] + (name.toLowerCase() === "set-cookie" ? "\n" : ", ") + value;
        else
          responseHeaders[name] = value;
      }
      await route.fulfill({
        status: response.status,
        body: Buffer.from(await response.arrayBuffer()),
        headers: responseHeaders
      });
    };
  }
  async route(...routeArgs) {
    this._routes.push(routeArgs);
    return await this._context.route(...routeArgs);
  }
  async use(...handlers) {
    this._requestHandlers = handlers.concat(this._requestHandlers);
    await this._updateRequestHandlersRoute();
  }
  async dispose() {
    this._requestHandlers = [];
    await this._updateRequestHandlersRoute();
    for (const route of this._routes)
      await this._context.unroute(route[0], route[1]);
  }
  async _updateRequestHandlersRoute() {
    if (this._requestHandlers.length && !this._requestHandlersActive) {
      await this._context.route("**/*", this._requestHandlersRoute);
      if (!fetchOverrideCounter)
        globalThis.fetch = globalFetch;
      ++fetchOverrideCounter;
      this._requestHandlersActive = true;
    }
    if (!this._requestHandlers.length && this._requestHandlersActive) {
      await this._context.unroute("**/*", this._requestHandlersRoute);
      this._requestHandlersActive = false;
      --fetchOverrideCounter;
      if (!fetchOverrideCounter)
        globalThis.fetch = originalFetch;
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Router
});
