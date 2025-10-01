import type {
    BitMask,
    Endianness,
    FieldCondition,
    FieldDefinition,
    ParsedField,
    ParsedSection,
    ParsedStructure,
    ParsedValue,
    SectionDefinition,
    StructureDefinition,
    ValueParser,
} from "./types.ts";

export interface Uint8ArrayReader {
    readBytes(count: number, fieldPath: string[]): Uint8Array;
    peekBytes(count: number, fieldPath: string[]): Uint8Array;
}

export class DefaultUint8ArrayReader implements Uint8ArrayReader {
    private offset = 0;
    private data: Uint8Array;

    constructor(data: Uint8Array | number[]) {
        this.data = data instanceof Uint8Array ? data : new Uint8Array(data);
    }

    readBytes(count: number): Uint8Array {
        if (this.offset + count > this.data.length) {
            throw new Error("Attempt to read beyond end of data");
        }
        const bytes = this.data.slice(this.offset, this.offset + count);
        this.offset += count;
        return bytes;
    }

    peekBytes(count: number): Uint8Array {
        if (this.offset + count > this.data.length) {
            throw new Error("Attempt to read beyond end of data");
        }
        return this.data.slice(this.offset, this.offset + count);
    }
}

export class BitReader {
    private bitOffset = 0;
    private data: Uint8Array;

    constructor(data: Uint8Array | number[]) {
        this.data = data instanceof Uint8Array ? data : new Uint8Array(data);
    }

    readBits(count: number): Uint8Array {
        if (count <= 0) throw new Error("Bit count must be positive");

        const result = new Uint8Array(Math.ceil(count / 8));
        let bitsWritten = 0;

        while (bitsWritten < count) {
            const byteIndex = Math.floor(this.bitOffset / 8);
            const bitIndex = this.bitOffset % 8;

            if (byteIndex >= this.data.length) {
                throw new Error("Reached end of buffer");
            }

            const bitsAvailable = 8 - bitIndex;
            const bitsToRead = Math.min(count - bitsWritten, bitsAvailable);

            const mask = (1 << bitsToRead) - 1;
            const bits = (this.data[byteIndex] >> (bitsAvailable - bitsToRead)) & mask;
            
            const resultByteIndex = Math.floor(bitsWritten / 8);
            const resultBitIndex = bitsWritten % 8;

            result[resultByteIndex] |= bits << (8 - resultBitIndex - bitsToRead);

            bitsWritten += bitsToRead;
            this.bitOffset += bitsToRead;
        }

        // Right-align all bits in the last byte
        const remainingBits = count % 8;
        if (remainingBits !== 0) {
            result[result.length - 1] >>= 8 - remainingBits;
        }

        return result;
    }
}

/**
 * Parses a byte array according to the provided structure definition and
 * returns the parsed structure.
 */
export function parseStructure(
    definition: StructureDefinition,
    bytes: Uint8Array | number[],
): ParsedStructure {
    const reader = new DefaultUint8ArrayReader(bytes);
    return parseStructureWithReader(definition, reader);
}

export function parseStructureWithReader(
    definition: StructureDefinition,
    reader: Uint8ArrayReader,
): ParsedStructure {
    return definition.sections.map((sectionDef) =>
        parseSection(sectionDef, reader, definition.endian || "little")
    );
}

function parseSection(
    sectionDef: SectionDefinition,
    reader: Uint8ArrayReader,
    endianness: Endianness,
): ParsedSection {
    const parsedSection: ParsedSection = {
        name: sectionDef.name,
        fields: [],
    };

    for (const fieldDef of sectionDef.fields) {
        const parsedField = parseField(
            sectionDef,
            fieldDef,
            reader,
            parsedSection,
            endianness,
            [sectionDef.name, fieldDef.name]
        );
        if (parsedField) {
            parsedSection.fields.push(...parsedField);
        }
    }

    return parsedSection;
}

export function parseField(
    sectionDef: SectionDefinition,
    fieldDef: FieldDefinition,
    reader: Uint8ArrayReader,
    parsedSection: ParsedSection,
    endianness: Endianness,
    path: string[] = []
): ParsedField[] {

    // check condition and skip if not met
    if (fieldDef.if && !checkFieldCondition(parsedSection, fieldDef.if)) {
        return [];
    }

    let repeatCount = 1;

    // handle repeat
    if (fieldDef.repeat) {
        if (typeof fieldDef.repeat === "number") {
            repeatCount = fieldDef.repeat;
        } else {
            const repeatField = findFieldById(
                fieldDef.repeat,
                parsedSection.fields,
            );
            if (!repeatField) {
                throw new Error(
                    `Repeat field ${fieldDef.repeat} not found for field ${
                        path.join(".")
                    }`,
                );
            }
            if (
                !("parsedValue" in repeatField) ||
                typeof repeatField.parsedValue !== "number"
            ) {
                throw new Error(
                    `Repeat field ${fieldDef.repeat} does not have a numeric parsed value`,
                );
            }
            repeatCount = repeatField.parsedValue;
        }
    }

    const parsedFields: ParsedField[] = [];

    for (let i = 0; i < repeatCount; i++) {
        // return sub fields
        if ("subFields" in fieldDef && fieldDef.subFields) {
            const bytes = reader.peekBytes(fieldDef.byteSize, path);
            const subFields = fieldDef.subFields.map((subField) =>
                parseField(
                    sectionDef,
                    subField,
                    reader,
                    parsedSection,
                    endianness,
                    [...path, subField.name]
                )
            );
            parsedFields.push({
                ...fieldDef.id && { id: fieldDef.id },
                name: fieldDef.name,
                bytes,
                parsedValue: "parser" in fieldDef && fieldDef.parser
                    ? parseFieldValue(bytes, fieldDef.parser, endianness)
                    : undefined,
                subFields: subFields.filter((f) => f !== null),
            });
            continue;
        }

        const bytes = reader.readBytes(fieldDef.byteSize, path);

        // bit masks
        if ("bitMasks" in fieldDef) {
            parsedFields.push({
                ...fieldDef.id && { id: fieldDef.id },
                name: fieldDef.name,
                bytes,
                subFields: [
                    parseBitMasks(bytes, fieldDef.bitMasks, endianness),
                ],
            });
        } // direct field
        else {
            parsedFields.push({
                ...fieldDef.id && { id: fieldDef.id },
                name: fieldDef.name,
                bytes,
                parsedValue: "parser" in fieldDef && fieldDef.parser
                    ? parseFieldValue(bytes, fieldDef.parser, endianness)
                    : undefined,
            });
        }
    }
    return parsedFields;
}

export function checkFieldCondition(
    parsedSection: ParsedSection,
    condition: FieldCondition,
): boolean {
    if ("equals" in condition) {
        const field = findFieldById(condition.equals[0], parsedSection.fields);
        if (!field) return false;
        return "parsedValue" in field &&
            field.parsedValue === condition.equals[1];
    } else if ("lessThan" in condition) {
        const field = findFieldById(
            condition.lessThan[0],
            parsedSection.fields,
        );
        if (!field) return false;
        return "parsedValue" in field &&
            typeof field.parsedValue === "number" &&
            field.parsedValue < condition.lessThan[1];
    } else if ("greaterThan" in condition) {
        const field = findFieldById(
            condition.greaterThan[0],
            parsedSection.fields,
        );
        if (!field) return false;
        return "parsedValue" in field &&
            typeof field.parsedValue === "number" &&
            field.parsedValue > condition.greaterThan[1];
    } else if ("includes" in condition) {
        const field = findFieldById(
            condition.includes[0],
            parsedSection.fields,
        );
        if (!field) return false;
        return "parsedValue" in field && Array.isArray(field.parsedValue) &&
            condition.includes[1].includes(field.parsedValue);
    } else if ("not" in condition) {
        return !checkFieldCondition(parsedSection, condition.not);
    } else if ("and" in condition) {
        return condition.and.every((cond) =>
            checkFieldCondition(parsedSection, cond)
        );
    } else if ("or" in condition) {
        return condition.or.some((cond) =>
            checkFieldCondition(parsedSection, cond)
        );
    } else {
        throw new Error("Unknown condition type");
    }
}

export function parseFieldValue(
    bytes: Uint8Array,
    parser: ValueParser,
    endianness: Endianness,
): ParsedValue {
    if (parser.type == "boolean") {
        if (bytes.length !== 1) {
            throw new Error("Invalid byte length for boolean");
        }
        return bytes[0] !== 0;
    } else if (parser.type == "uint") {
        if (bytes.length == 1) {
            return bytes[0];
        } else if (bytes.length == 2) {
            return new DataView(bytes.buffer).getUint16(
                0,
                endianness === "little",
            );
        } else if (bytes.length == 4) {
            return new DataView(bytes.buffer).getUint32(
                0,
                endianness === "little",
            );
        } else {
            throw new Error("Unsupported byte length for integer");
        }
    } else if (parser.type == "int") {
        if (bytes.length == 1) {
            return bytes[0];
        } else if (bytes.length == 2) {
            return new DataView(bytes.buffer).getInt16(
                0,
                endianness === "little",
            );
        } else if (bytes.length == 4) {
            return new DataView(bytes.buffer).getInt32(
                0,
                endianness === "little",
            );
        } else {
            throw new Error("Unsupported byte length for signed integer");
        }
    } else if (parser.type == "float") {
        if (bytes.length == 4) {
            return new DataView(bytes.buffer).getFloat32(
                0,
                endianness === "little",
            );
        } else if (bytes.length == 8) {
            return new DataView(bytes.buffer).getFloat64(
                0,
                endianness === "little",
            );
        } else {
            throw new Error("Unsupported byte length for float");
        }
    } else if (parser.type == "string") {
        const decoder = new TextDecoder("utf-8");
        return decoder.decode(bytes);
    } else if (parser.type == "enum") {
        for (const [key, value] of Object.entries(parser.mapping)) {
            // interpret key as hex/bin/dec
            const keyInteger = key.startsWith("0x")
                ? parseInt(key.slice(2), 16)
                : key.startsWith("0b")
                ? parseInt(key.slice(2), 2)
                : parseInt(key, 10);
            const dataView = new DataView(new ArrayBuffer(bytes.length));
            if (bytes.length == 1) {
                dataView.setUint8(0, bytes[0]);
                if (dataView.getUint8(0) === keyInteger) return value;
            } else if (bytes.length == 2) {
                dataView.setUint16(0, keyInteger, endianness === "little");
                if (
                    dataView.getUint16(0, endianness === "little") ===
                        keyInteger
                ) return value;
            } else if (bytes.length == 4) {
                dataView.setUint32(0, keyInteger, endianness === "little");
                if (
                    dataView.getUint32(0, endianness === "little") ===
                        keyInteger
                ) return value;
            } else {
                throw new Error("Unsupported byte length for mapping");
            }
        }
        throw new Error(`Value 0x${[...bytes].map((b) =>
            b.toString(16).padStart(2, "0")
        ).join(" ")} not found in enum mapping ${JSON.stringify(parser.mapping)}`);
    } else if (parser.type == "endpoint") {
        if (bytes.length !== 21) {
            throw new Error("Invalid byte length for endpoint");
        }
        const type = bytes[0];
        const typePrefix = type === 0 ? "@" : type === 1 ? "@+" : "@@";
        // 18 bytes id
        const idBytes = bytes.slice(1, 19);
        // 2 bytes instance
        const instanceBytes = bytes.slice(19, 21);
        const decoder = new TextDecoder("utf-8");
        const id = decoder.decode(idBytes).replace(/\0.*$/g, "");
        const instance = new DataView(instanceBytes.buffer).getUint16(
            0,
            endianness === "little",
        );
        const MAX_UINT16 = 65_535;
        const instanceString = instance == 0
            ? ""
            : instance == MAX_UINT16
            ? "*"
            : instance.toString();
        return `${typePrefix}${id}${
            instance !== 0 ? `/${instanceString}` : ""
        }`;
    } else if (parser.type == "pointer") {
        if (bytes.length !== 26) {
            throw new Error("Invalid byte length for pointer");
        }
        const bytesHex = [...bytes].map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        return `$${bytesHex}`;
    }

    throw new Error(`Unknown parser type: ${parser.type}`);
}

export function parseBitMasks(
    bytes: Uint8Array,
    bitMasks: BitMask[],
    endianness: Endianness,
): ParsedField[] {
    const bitReader = new BitReader(bytes);
    const results: ParsedField[] = [];
    for (const mask of bitMasks) {
        const length = mask.length ?? 1;
        const bitData = bitReader.readBits(length);
        const parsedValue = mask.parser
            ? parseFieldValue(bitData, mask.parser, endianness)
            : [...bitData].map((b) => b.toString(2)).join("");
        results.push({
            ...mask.id && { id: mask.id },
            name: mask.name,
            bytes: bitData,
            parsedValue,
        });
    }
    return results;
}

export function findFieldById(
    id: string,
    fields: ParsedField[],
): ParsedField | null {
    for (const field of fields) {
        if (field.id === id) return field;
        if ("subFields" in field) {
            for (const subFields of field.subFields) {
                const subField = findFieldById(id, subFields);
                if (subField) return subField;
            }
        }
    }
    return null;
}
