// The pinned WASM toolchain imports absolute Windows paths as module names.
// Preload in both the CLI and its workers; leave CommonJS resolution alone.
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";

if (process.platform === "win32") {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (!context.conditions.includes("require") && /^[A-Za-z]:[\\/]/.test(specifier)) {
        return nextResolve(pathToFileURL(specifier).href, context);
      }
      return nextResolve(specifier, context);
    },
  });
  const preload = `--import=${import.meta.url}`;
  if (!(process.env.NODE_OPTIONS ?? "").includes(preload)) {
    process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ""} ${preload}`.trim();
  }
}
