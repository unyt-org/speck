# Speck

> Declarative Specification Parser and Generator for Binary Data Formats

Speck is a TypeScript library for parsing and generating binary data formats
based on declarative specifications. It is designed to be flexible and
extensible, allowing users to define their own data structures and parsing
rules.

---

## Features

- Declarative binary structure definitions
- Support for **endianness** (little and big)
- Nested fields and repeated fields
- Conditional inclusion of fields using logical conditions (`and`, `or`, `not`,
  `equals`, `includes`, `greaterThan`, `lessThan`)
- Built-in value parsers: `boolean`, `int`, `uint`, `float`, `string`, `enum`,
  `endpoint`, `pointer`
- Bit masks for extracting values at the bit level
- Extensible design for building custom binary parsers

---

## Installation

With Deno:

```bash
deno add jsr:@unyt/speck
```

or with npm:

```bash
npm install @unyt/speck
```

or with yarn:

```bash
yarn add jsr:@unyt/speck
```

---

## Usage Example

### 1. Define a structure (JSON or TypeScript)

```json
{
    "name": "ExampleStruct",
    "sections": [
        {
            "name": "FirstSection",
            "fields": [
                {
                    "name": "FieldA",
                    "byteSize": 4,
                    "parser": { "type": "int" }
                }
            ]
        }
    ]
}
```

### 2. Parse binary data

```ts
import { parseStructure, type StructureDefinition } from "@unyt/speck";

const definition: StructureDefinition = {
    name: "ExampleStruct",
    sections: [
        {
            name: "FirstSection",
            fields: [
                {
                    name: "FieldA",
                    byteSize: 4,
                    parser: { type: "int" },
                },
            ],
        },
    ],
};

const bytes = new Uint8Array([0x01, 0x00, 0x00, 0x00]);
parseStructure(definition, bytes);
```

Results in:

```ts
[
    {
        name: "FirstSection",
        fields: [
            {
                name: "FieldA",
                bytes: Uint8Array(4)[1, 0, 0, 0],
                parsedValue: 1,
            },
        ],
    },
];
```

---

## Definitions

### StructureDefinition

- `name`: string – Name of the structure
- `endian`: `"little"` | `"big"` (default `"little"`)
- `sections`: list of `SectionDefinition`

### SectionDefinition

- `name`: string
- `fields`: list of `FieldDefinition`

### FieldDefinition

- `id`: optional string identifier (used in conditions or repeat)
- `name`: string
- `description`: optional string
- `category`: optional string
- `usage`: optional `"omit"`
- `byteSize`: number of bytes to read
- `repeat`: number | _field reference_ for repetition
- `if`: optional `FieldCondition` to conditionally include the field
- `parser`: optional `ValueParser` to interpret bytes
- `subFields`: for nested structures
- `bitMasks`: for extracting bit-level subfields

### FieldCondition

Logical and comparison operators for conditional parsing:

- `equals`, `greaterThan`, `lessThan`, `includes`
- `and`, `or`, `not`

### ValueParser

- `boolean`
- `int`, `uint`, `float`
- `string`
- `enum` (with mapping)
- `endpoint`
- `pointer`

### ParsedStructure

The result of parsing is a structured array of `ParsedSection`, each containing
`ParsedField` objects with:

- `name`
- `bytes` (raw Uint8Array slice)
- `parsedValue` (if a parser is provided)
- `subFields` (if nested or bit-masked)

---

## Advanced Example

### Conditional Field

```ts
{
  "name": "optionalField",
  "byteSize": 2,
  "parser": { "type": "uint" },
  "if": { "equals": ["controlField", 1] }
}
```

This field is only parsed if `controlField == 1`.

### Bit Masks

```ts
{
  "name": "flags",
  "byteSize": 1,
  "bitMasks": [
    { "name": "flagA", "length": 1, "parser": { "type": "boolean" } },
    { "name": "flagB", "length": 2, "parser": { "type": "uint" } }
  ]
}
```

This extracts `flagA` and `flagB` from a single byte.

---

<sub>&copy; unyt 2025 • [unyt.org](https://unyt.org)</sub>
