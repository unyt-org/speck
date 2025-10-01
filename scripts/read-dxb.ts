#!/usr/bin/env -S deno run --allow-read
import { exists } from "jsr:@std/fs/exists";
import { parseAndPackStructure } from "../packer.ts";
import dxbStructure from "../examples/dxb.json" with { type: "json" };
import type { StructureDefinition } from "../types.ts";
if (Deno.args.length !== 1) {
    console.error("Usage: ./read-dxb.ts <file>");
    Deno.exit(1);
}

const relativePath = Deno.args[0];
const absolutePath = new URL(relativePath, `file://${Deno.cwd()}/`).pathname;
console.log("absolutePath", absolutePath)
if (!await exists(absolutePath)) {
    console.error(`Error: File not found: '${absolutePath}'`);
    Deno.exit(1);
}
const data = Deno.readFileSync(absolutePath);
const packed = parseAndPackStructure(dxbStructure as StructureDefinition, data);
console.dir(packed, { depth: null });
