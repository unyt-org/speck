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
    },
    typeCheck: "both",
    scriptModule: false,
    compilerOptions: {
        lib: ["ESNext", "DOM"],
    },
    package: {
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
    postBuild() {
        Deno.copyFileSync("README.md", "npm/README.md");
    },
});
