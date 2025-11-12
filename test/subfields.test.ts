import { parseStructure } from "../parser.ts";
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
                        subFields: [
                            { name: "SubField A", byteSize: 2 },
                            { name: "SubField B", byteSize: 2 },
                            { name: "SubField C", byteSize: 1, repeat: 2 },
                        ],
                    },
                    {
                        name: "Bitmask Field",
                        bitMasks: [
                            { name: "Bit 0", length: 1 },
                            { name: "Bits 1-3", length: 3 },
                            { name: "Bits 4-7", length: 4 },
                        ],
                        byteSize: 1,
                    },
                ],
            },
        ],
    };
    const data = new Uint8Array([
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
    ]);
    const parsed = parseStructure(struct, data);
    assertEquals(parsed, [
        {
            fields: [
                {
                    bytes: new Uint8Array([
                        0,
                        0,
                        0,
                        0,
                    ]),
                    name: "Field 1",
                    parsedValue: undefined,
                    subFields: [
                        {
                            bytes: new Uint8Array([0, 0]),
                            name: "SubField A",
                            parsedValue: undefined,
                        },
                        {
                            bytes: new Uint8Array([0, 0]),
                            name: "SubField B",
                            parsedValue: undefined,
                        },
                        {
                            bytes: new Uint8Array([0]),
                            name: "SubField C",
                            parsedValue: undefined,
                        },
                        {
                            bytes: new Uint8Array([0]),
                            name: "SubField C",
                            parsedValue: undefined,
                        },
                    ],
                },
                {
                    bytes: new Uint8Array([0]),
                    name: "Bitmask Field",
                    subFields: [
                        {
                            bytes: new Uint8Array([0]),
                            name: "Bit 0",
                            parsedValue: "0",
                        },
                        {
                            bytes: new Uint8Array([0]),
                            name: "Bits 1-3",
                            parsedValue: "0",
                        },
                        {
                            bytes: new Uint8Array([0]),
                            name: "Bits 4-7",
                            parsedValue: "0",
                        },
                    ],
                },
            ],
            name: "TestSection",
        },
    ]);
});
