import { build, emptyDir } from "@deno/dnt";

await emptyDir("./npm");

// get version from deno.json
const VERSION: string = await Deno.readTextFile(
    new URL("../deno.json", import.meta.url),
).then(JSON.parse).then((data: { version: string }) => data.version);

await build({
    entryPoints: [
        "./mod.ts",
    ],
    outDir: "./npm",
    shims: {
        deno: true,
        timers: true,
        prompts: true,
        undici: true,
        crypto: true,
        weakRef: true,
        webSocket: true,
    },
    typeCheck: "both",
    scriptModule: false,

    package: {
        // package.json properties
        name: "@unyt/speck",
        version: VERSION,
        license: "MIT",
        repository: {
            type: "git",
            url: "git+https://github.com/unyt-org/speck.git",
        },
        bugs: {
            url: "https://github.com/unyt-org/speck/issues",
        },
    },
    // steps to run after building and before running the tests
    postBuild() {
        Deno.copyFileSync("README.md", "npm/README.md");
    },
});
