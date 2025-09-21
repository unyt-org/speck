import { parseStructureWithReader, type Uint8ArrayReader } from "./parser.ts";
import type { ParsedStructure, FieldDefinition,  StructureDefinition, SectionDefinition } from "./types.ts";
import { tablemark } from "tablemark";
    

export type CustomBytes = {
    [key: string]: CustomBytes | Record<string, number[]>;
};

export class Uint8ArrayGeneratorReader implements Uint8ArrayReader {
    constructor(private customByteData?: CustomBytes) {}

    readBytes(count: number, fieldPath: string[]): Uint8Array {
        // if no custom data for field path, return zeros
        let customBytes:
            | CustomBytes
            | Record<string, number[]>
            | number[]
            | undefined = this.customByteData;
        for (const part of fieldPath) {
            if (!customBytes) break;
            if (Array.isArray(customBytes)) {
                throw new Error(
                    `Invalid path to custom byte data: ${fieldPath.join(".")}`,
                );
            }
            customBytes = customBytes[part];
        }

        if (!customBytes) {
            return new Uint8Array(new Array(count).fill(0));
        }
        if (!Array.isArray(customBytes)) {
            throw new Error(
                `Invalid path to custom byte data: ${fieldPath.join(".")}`,
            );
        }
        if (customBytes.length < count) {
            throw new Error(
                `Not enough custom byte data for field ${
                    fieldPath.join(".")
                } - expected ${count}, got ${customBytes.length}`,
            );
        }
        return new Uint8Array(customBytes);
    }

    peekBytes(count: number, fieldPath: string[]): Uint8Array {
        return this.readBytes(count, fieldPath);
    }
}

export function generateStructure(
    structDefinition: StructureDefinition,
    customByteData?: CustomBytes,
): ParsedStructure {
    const generator = new Uint8ArrayGeneratorReader(customByteData);
    return parseStructureWithReader(structDefinition, generator);
}

export function generateBytes(
    structDefinition: StructureDefinition,
    customByteData?: CustomBytes,
): Uint8Array {
    const struct = generateStructure(structDefinition, customByteData);
    return convertStructureToBytes(struct);
}

export function convertStructureToBytes(struct: ParsedStructure): Uint8Array {
    const bytes: number[] = [];
    for (const section of struct) {
        for (const field of section.fields) {
            bytes.push(...field.bytes);
        }
    }
    return new Uint8Array(bytes);
}

export function generateTable(section: SectionDefinition) {
    const fields = section.fields.map((field) => {
        const fields = [
            {
                Field: field.name,
                "Byte Size": field.byteSize.toString(),
                Type: getFieldType(field),
                Description: field.description ?? "-",
            }
        ]

        if ("bitMasks" in field) {
            for (const bitmask of field.bitMasks) {
                fields.push({
                    Field: `- ${bitmask.name}`,
                    "Byte Size": bitmask.length ? `${bitmask.length} bits` : "1 bit",
                    Type: bitmask.parser ? getFieldType({ byteSize: 0, parser: bitmask.parser, name: "" }) : "-",
                    Description: "",
                });
            }
        }
        return fields;
    }).flat(1);
    return tablemark(fields); 
}

function getFieldType(field: FieldDefinition): string {
    if ("parser" in field) {
        if (field.parser?.type == "uint") {
            return `uint${field.byteSize * 8}`;
        }
        else if (field.parser?.type == "int") {
            return `int${field.byteSize * 8}`;
        }
        else if (field.parser?.type == "float") {
            return `float${field.byteSize * 8}`;
        }
        else if (field.parser?.type == "enum") {
            return `enum (${Object.keys(field.parser.mapping).join(", ")})`;
        }
        else {
            return field.parser?.type ?? "-";
        }
    }
    else if ("bitMasks" in field) {
        return `bitmask`;
    }
    return "-";
}