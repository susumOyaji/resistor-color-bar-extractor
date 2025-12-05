var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-pyi1BF/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// src/index.js
var src_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "POST") {
      if (url.pathname === "/api/analyze") {
        return handleAnalysis(request);
      }
      if (url.pathname === "/api/scan") {
        return handleScan(request);
      }
    }
    return new Response("Not Found", { status: 404 });
  }
};
async function handleAnalysis(request) {
  try {
    const { pixels } = await request.json();
    if (!pixels || !Array.isArray(pixels)) {
      return new Response("Invalid data", { status: 400 });
    }
    const bands = analyzePixels(pixels);
    return new Response(JSON.stringify({
      success: true,
      bands,
      totalPixels: pixels.length
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
__name(handleAnalysis, "handleAnalysis");
async function handleScan(request) {
  try {
    const { slices } = await request.json();
    if (!slices || !Array.isArray(slices)) {
      return new Response("Invalid data", { status: 400 });
    }
    const sliceResults = slices.map((slicePixels) => {
      const bands = analyzePixels(slicePixels);
      const colors = bands.map((b) => ({
        r: b.rgb.r,
        g: b.rgb.g,
        b: b.rgb.b,
        name: b.colorName,
        hex: rgbToHex(b.rgb.r, b.rgb.g, b.rgb.b),
        count: b.width
        // Use width as count
      }));
      const validBands = bands.filter((b) => b.colorName !== "Beige (Body)").map((b) => b.colorName);
      return {
        colors,
        detected_bands: validBands
      };
    });
    const detectedBands = aggregateBands(sliceResults);
    const resistorValue = calculateResistorValue(detectedBands);
    return new Response(JSON.stringify({
      slices: sliceResults,
      detected_bands: detectedBands,
      resistor_value: resistorValue
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
__name(handleScan, "handleScan");
var RESISTOR_COLORS = [
  { name: "Black", r: 0, g: 0, b: 0, value: 0 },
  { name: "Brown", r: 139, g: 69, b: 19, value: 1, tolerance: 1 },
  { name: "Red", r: 255, g: 0, b: 0, value: 2, tolerance: 2 },
  { name: "Orange", r: 255, g: 165, b: 0, value: 3 },
  { name: "Yellow", r: 255, g: 255, b: 0, value: 4 },
  { name: "Green", r: 0, g: 128, b: 0, value: 5, tolerance: 0.5 },
  { name: "Blue", r: 0, g: 0, b: 255, value: 6, tolerance: 0.25 },
  { name: "Violet", r: 238, g: 130, b: 238, value: 7, tolerance: 0.1 },
  { name: "Gray", r: 128, g: 128, b: 128, value: 8, tolerance: 0.05 },
  { name: "White", r: 255, g: 255, b: 255, value: 9 },
  { name: "Gold", r: 218, g: 165, b: 32, tolerance: 5 },
  { name: "Silver", r: 192, g: 192, b: 192, tolerance: 10 },
  { name: "Beige (Body)", r: 225, g: 204, b: 153 }
  // Adjusted Beige
];
function analyzePixels(pixels) {
  const segments = [];
  let currentSegment = null;
  const classifiedPixels = pixels.map((p) => findClosestColor(p));
  for (const p of classifiedPixels) {
    if (!currentSegment) {
      currentSegment = { ...p, count: 1 };
    } else if (p.name === currentSegment.name) {
      currentSegment.count++;
    } else {
      segments.push(currentSegment);
      currentSegment = { ...p, count: 1 };
    }
  }
  if (currentSegment) segments.push(currentSegment);
  const width = pixels.length;
  const threshold = width * 0.015;
  const filtered = segments.filter((s) => s.count > threshold);
  return filtered.map((s) => ({
    colorName: s.name,
    rgb: { r: s.r, g: s.g, b: s.b },
    width: s.count
  }));
}
__name(analyzePixels, "analyzePixels");
function findClosestColor(pixel) {
  let minDist = Infinity;
  let closest = RESISTOR_COLORS[0];
  for (const color of RESISTOR_COLORS) {
    const dist = Math.sqrt(
      Math.pow(pixel.r - color.r, 2) + Math.pow(pixel.g - color.g, 2) + Math.pow(pixel.b - color.b, 2)
    );
    if (dist < minDist) {
      minDist = dist;
      closest = color;
    }
  }
  return closest;
}
__name(findClosestColor, "findClosestColor");
function aggregateBands(sliceResults) {
  const sequenceCounts = {};
  for (const res of sliceResults) {
    if (res.detected_bands.length >= 3) {
      const key = res.detected_bands.join(",");
      sequenceCounts[key] = (sequenceCounts[key] || 0) + 1;
    }
  }
  let maxCount = 0;
  let bestSequence = [];
  for (const [seq, count] of Object.entries(sequenceCounts)) {
    if (count > maxCount) {
      maxCount = count;
      bestSequence = seq.split(",");
    }
  }
  return bestSequence;
}
__name(aggregateBands, "aggregateBands");
function calculateResistorValue(bands) {
  if (!bands || bands.length < 3) return null;
  const colorObjs = bands.map((name) => RESISTOR_COLORS.find((c) => c.name === name));
  if (colorObjs.some((c) => !c)) return "Unknown Colors";
  let resistance = 0;
  let tolerance = 20;
  const lastBand = colorObjs[colorObjs.length - 1];
  const isTolerance = ["Gold", "Silver"].includes(lastBand.name);
  if (bands.length === 3) {
    resistance = (colorObjs[0].value * 10 + colorObjs[1].value) * Math.pow(10, colorObjs[2].value);
  } else if (bands.length === 4) {
    resistance = (colorObjs[0].value * 10 + colorObjs[1].value) * Math.pow(10, colorObjs[2].value);
    if (lastBand.tolerance) tolerance = lastBand.tolerance;
  } else if (bands.length === 5) {
    resistance = (colorObjs[0].value * 100 + colorObjs[1].value * 10 + colorObjs[2].value) * Math.pow(10, colorObjs[3].value);
    if (lastBand.tolerance) tolerance = lastBand.tolerance;
  } else {
    return "Complex/Unknown";
  }
  return formatResistance(resistance) + ` \xB1${tolerance}%`;
}
__name(calculateResistorValue, "calculateResistorValue");
function formatResistance(ohms) {
  if (ohms >= 1e6) {
    return (ohms / 1e6).toFixed(1).replace(/\.0$/, "") + "M\u03A9";
  }
  if (ohms >= 1e3) {
    return (ohms / 1e3).toFixed(1).replace(/\.0$/, "") + "k\u03A9";
  }
  return ohms + "\u03A9";
}
__name(formatResistance, "formatResistance");
function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}
__name(rgbToHex, "rgbToHex");

// ../../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-pyi1BF/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-pyi1BF/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
