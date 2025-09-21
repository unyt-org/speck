import { updateMarkdownFiles } from "../markdown-generator.ts";

const dirPath = new URL(Deno.args[0] ?? "./", "file://" + Deno.cwd() + "/");
console.log(`Updating markdown files in ${dirPath.pathname}`);
await updateMarkdownFiles(dirPath);
