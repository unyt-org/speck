import { parseAndPackStructure } from "../packer.ts";
import { registerCustomParser, unregisterCustomParser } from "../parser.ts";
import type { StructureDefinition } from "../types.ts";
import { assertEquals } from "@std/assert";

Deno.test("structure", () => {
    const struct: StructureDefinition = {
        name: "TestStruct",
        sections: [
            {
                name: "TestSection",
                fields: [
                    {
                        name: "Field 1",
                        byteSize: 4,
                        parser: { type: "custom", name: "my-custom-parser" },
                    },
                ],
            },
        ],
    };
    registerCustomParser("my-custom-parser", (bytes: Uint8Array) => {
        return `size<${bytes.length}>`;
    });
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    const parsed = parseAndPackStructure(struct, data);
    assertEquals(parsed, {
        testsection: { field_1: `size<4>` },
    });
    unregisterCustomParser("my-custom-parser");
});
