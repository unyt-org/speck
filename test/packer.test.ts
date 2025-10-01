import { parseAndPackStructure } from "../packer.ts";
import type { StructureDefinition } from "../types.ts";
import { assertEquals } from "jsr:@std/assert";

Deno.test("structure", () => {
    const struct: StructureDefinition = {
        name: "TestStruct",
        sections: [
            {
                name: "TestSection",
                fields: [
                    { name: "Field 1", byteSize: 2, parser: { type: "uint" } },
                    { name: "Field 2", byteSize: 2, parser: { type: "uint" } },
                    {
                        name: "Field 3",
                        byteSize: 1,
                        parser: { type: "boolean" },
                    },
                ],
            },
        ],
    };
    const data = new Uint8Array([0xFF, 0x00, 0x00, 0x01, 0x01]);
    const parsed = parseAndPackStructure(struct, data);
    assertEquals(parsed, {
        testsection: { field_1: 255, field_2: 256, field_3: true },
    });
});
