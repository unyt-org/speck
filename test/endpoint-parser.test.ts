import { parseAndPackStructure } from "../packer.ts";
import type { StructureDefinition } from "../types.ts";
import { assertEquals } from "@std/assert";

const struct: StructureDefinition = {
    name: "TestStruct",
    sections: [
        {
            name: "TestSection",
            fields: [
                {
                    name: "Endpoint",
                    byteSize: 21,
                    parser: { type: "endpoint" },
                },
            ],
        },
    ],
};

Deno.test("endpoint local", () => {
    const data = new Uint8Array(new Array(21).fill(0));
    const parsed = parseAndPackStructure(struct, data);
    assertEquals(parsed, {
        testsection: { endpoint: `@local` },
    });
});

Deno.test("endpoint local org", () => {
    const data = new Uint8Array([0x01, ...new Array(20).fill(0)]);
    const parsed = parseAndPackStructure(struct, data);
    assertEquals(parsed, {
        testsection: { endpoint: `@+local` },
    });
});

Deno.test("endpoint local anon", () => {
    const data = new Uint8Array([0x02, ...new Array(20).fill(0)]);
    const parsed = parseAndPackStructure(struct, data);
    assertEquals(parsed, {
        testsection: { endpoint: `@@local` },
    });
});

Deno.test("endpoint person", () => {
    const data = new Uint8Array([
        0,
        106,
        111,
        110,
        97,
        115,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
    ]);
    const parsed = parseAndPackStructure(struct, data);
    assertEquals(parsed, {
        testsection: { endpoint: `@jonas` },
    });
});

Deno.test("endpoint anonymous", () => {
    const data = new Uint8Array([
        2,
        198,
        216,
        67,
        251,
        161,
        123,
        245,
        31,
        78,
        104,
        250,
        99,
        199,
        9,
        104,
        179,
        77,
        244,
        0,
        0,
    ]);
    const parsed = parseAndPackStructure(struct, data);
    assertEquals(parsed, {
        testsection: { endpoint: `@@c6d843fba17bf51f4e68fa63c70968b34df4` },
    });
});
