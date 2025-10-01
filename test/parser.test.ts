import { parseStructure } from "../parser.ts";
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
    const parsed = parseStructure(struct, data);

    assertEquals(parsed, [
        {
            name: "TestSection",
            fields: [
                {
                    name: "Field 1",
                    bytes: new Uint8Array([255, 0]),
                    parsedValue: 255,
                },
                {
                    name: "Field 2",
                    bytes: new Uint8Array([0, 1]),
                    parsedValue: 256,
                },
                {
                    name: "Field 3",
                    bytes: new Uint8Array([1]),
                    parsedValue: true,
                },
            ],
        },
    ]);
});

Deno.test("structure with array", () => {
    const struct: StructureDefinition = {
        name: "TestStruct",
        sections: [
            {
                name: "TestSection",
                fields: [
                    {
                        name: "Field 1",
                        byteSize: 2,
                        parser: { type: "uint" },
                        repeat: 2,
                    },
                    {
                        name: "Field 2",
                        byteSize: 1,
                        parser: { type: "boolean" },
                    },
                ],
            },
        ],
    };
    const data = new Uint8Array([0xFF, 0x00, 0x00, 0x01, 0x00, 0x02, 0x01]);
    const parsed = parseStructure(struct, data);

    assertEquals(parsed, [
        {
            name: "TestSection",
            fields: [
                {
                    name: "Field 1",
                    bytes: new Uint8Array([255, 0]),
                    parsedValue: 255,
                },
                {
                    name: "Field 1",
                    bytes: new Uint8Array([0, 1]),
                    parsedValue: 256,
                },
                {
                    name: "Field 2",
                    bytes: new Uint8Array([0]),
                    parsedValue: false,
                },
            ],
        },
    ]);
});
