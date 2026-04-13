import {defineConfig} from "vitest/config";
import {backend} from "vitest-config-silverwind";

export default defineConfig(backend({
  url: import.meta.url,
  test: {
    // tests share mutable module-level state (connection counters)
    sequence: {concurrent: false},
  },
}));
