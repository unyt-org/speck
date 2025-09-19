#!/usr/bin/env -S deno run --allow-read
import { convertStructureToBytes, generateStructure } from "../generator.ts";
import { parseStructure } from "../parser.ts";

// read json from file
const relativeFilePath = Deno.args[0];
const filePath = new URL(relativeFilePath, "file://" + Deno.cwd() + "/");
const definition = JSON.parse(await Deno.readTextFile(filePath));

const struct = generateStructure(definition);
const bytes = convertStructureToBytes(struct);
const reparsedStruct = parseStructure(definition, bytes);

if (JSON.stringify(struct) !== JSON.stringify(reparsedStruct)) {
    console.log(struct);
    console.log("---");
    console.log(reparsedStruct);
    throw new Error("Struct does not match after re-parsing!");
}

console.log(struct);
console.log(
    "Bytes:",
    [...bytes].map((b) => b.toString(16).padStart(2, "0")).join(" "),
);
