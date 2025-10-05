// Parser: Parse a byte array according to a structure definition and return the parsed structure.

const CUSTOM_PARSERS: Map<string, (bytes: Uint8Array) => ParsedValue> =
    new Map();

/**
 * Register a custom parser function that can be used in structure definitions.
 * @param name The name of the custom parser.
 * @param parser The parser function.
 */
export function registerCustomParser<T extends ParsedValue>(
    name: string,
    parser: (bytes: Uint8Array) => T,
) {
    CUSTOM_PARSERS.set(name, parser);
}

/**
 * Unregister a custom parser function.
 * @param name The name of the custom parser to unregister.
 */
export function unregisterCustomParser(name: string) {
    CUSTOM_PARSERS.delete(name);
}

import type {
    AssertCondition,
    BitMaskDefinition,
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

/**
 * Interface for reading bytes from a Uint8Array with support for peeking.
 */
export interface Uint8ArrayReader {
    readBytes(count: number, fieldPath: string[]): Uint8Array;
    peekBytes(count: number, fieldPath: string[]): Uint8Array;
}

/**
 * Default implementation of the Uint8ArrayReader interface.
 */
export class DefaultUint8ArrayReader implements Uint8ArrayReader {
    private offset = 0;
    private data: Uint8Array;

    constructor(data: Uint8Array | number[]) {
        this.data = data instanceof Uint8Array ? data : new Uint8Array(data);
    }

    /**
     * Read a specified number of bytes from the current offset and advance the offset.
     * @param count Number of bytes to read
     * @returns
     */
    readBytes(count: number): Uint8Array {
        if (this.offset + count > this.data.length) {
            throw new Error("Attempt to read beyond end of data");
        }
        const bytes = this.data.slice(this.offset, this.offset + count);
        this.offset += count;
        return bytes;
    }

    /**
     * Peek at a specified number of bytes from the current offset without advancing the offset.
     * @param count Number of bytes to peek
     * @returns The peeked bytes as a copy
     */
    peekBytes(count: number): Uint8Array {
        if (this.offset + count > this.data.length) {
            throw new Error("Attempt to read beyond end of data");
        }
        return this.data.slice(this.offset, this.offset + count);
    }
}

/**
 * Helper class for reading bits from a byte array.
 */
export class BitReader {
    private bitOffset = 0;
    private data: Uint8Array;

    constructor(data: Uint8Array | number[]) {
        this.data = data instanceof Uint8Array ? data : new Uint8Array(data);
    }

    /**
     * Read a specified number of bits from the current bit offset and advance the offset.
     * @param count Number of bits to read
     * @returns The read bits as a Uint8Array
     */
    readBits(count: number): Uint8Array {
        if (count < 0) throw new Error("Cannot read negative bits");

        const bytesNeeded = Math.ceil(count / 8);
        const result = new Uint8Array(bytesNeeded);

        for (let i = 0; i < count; i++) {
            const byteIndex = Math.floor(this.bitOffset / 8);
            const bitIndex = this.bitOffset % 8;

            const bit = (this.data[byteIndex] >> bitIndex) & 1;
            const resByteIndex = Math.floor(i / 8);
            const resBitIndex = i % 8;
            result[resByteIndex] |= bit << resBitIndex;
            this.bitOffset++;
        }
        return result;
    }
}

/**
 * Parses a byte array according to the provided structure definition and
 * returns the parsed structure.
 * @param definition The structure definition to use for parsing.
 * @param bytes The byte array to parse.
 * @returns The parsed structure.
 */
export function parseStructure(
    definition: StructureDefinition,
    bytes: Uint8Array | number[],
): ParsedStructure {
    const reader = new DefaultUint8ArrayReader(bytes);
    return parseStructureWithReader(definition, reader);
}

/**
 * Parse a structure from a byte array using a reader.
 * @param definition The structure definition to use for parsing.
 * @param reader The reader to use for reading bytes.
 * @returns The parsed structure.
 */
export function parseStructureWithReader(
    definition: StructureDefinition,
    reader: Uint8ArrayReader,
): ParsedStructure {
    return definition.sections.map((sectionDef) =>
        parseSection(sectionDef, reader, definition.endian || "little")
    );
}

/**
 * Parse a section from a byte array using a reader.
 * @param sectionDef The section definition to parse.
 * @param reader The reader to use for reading bytes.
 * @param endianness The endianness to use for reading multi-byte values.
 * @returns The parsed section.
 */
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
            [sectionDef.name, fieldDef.name],
        );
        if (parsedField) {
            parsedSection.fields.push(...parsedField);
        }
    }
    return parsedSection;
}

/**
 * Parse a section from a byte array using a reader.
 * @param sectionDef The section definition to parse.
 * @param fieldDef The field definition to parse.
 * @param reader The reader to use for reading bytes.
 * @param parsedSection The parsed section to update.
 * @param endianness The endianness to use for reading multi-byte values.
 * @param path The path to the field being parsed.
 * @returns The parsed field.
 */
function parseField(
    sectionDef: SectionDefinition,
    fieldDef: FieldDefinition,
    reader: Uint8ArrayReader,
    parsedSection: ParsedSection,
    endianness: Endianness,
    path: string[] = [],
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
                    [...path, subField.name],
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

    if (
        fieldDef.assert &&
        !assertCondition(
            fieldDef.repeat ? parsedFields : parsedFields[0],
            fieldDef.assert,
        )
    ) {
        throw new Error(
            `Assertion failed for field ${path.join(".")}: ${
                JSON.stringify(
                    fieldDef.assert,
                )
            }`,
        );
    }
    return parsedFields;
}

function assertCondition(
    parsedFields: ParsedField | ParsedField[],
    condition: AssertCondition,
): boolean {
    if ("is" in condition) {
        if (Array.isArray(parsedFields)) {
            return parsedFields.every((field, index) => {
                if (!("parsedValue" in field)) return false;
                const expectedValue = Array.isArray(condition.is)
                    ? condition.is[index]
                    : condition.is;
                return JSON.stringify(field.parsedValue) ===
                    JSON.stringify(expectedValue);
            });
        } else {
            if (!("parsedValue" in parsedFields)) return false;
            return JSON.stringify(parsedFields.parsedValue) ===
                JSON.stringify(condition.is);
        }
    } else {
        throw new Error("Unknown assert condition type");
    }
}

/**
 * Check if a field condition is met in the parsed section.
 * @param parsedSection The parsed section to check against.
 * @param condition The condition to check.
 * @returns True if the condition is met, false otherwise.
 */
function checkFieldCondition(
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
        return "parsedValue" in field && field.parsedValue != null &&
            Array.isArray(condition.includes[1]) &&
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

/**
 * Parse a field value from a byte array using a parser.
 * @param bytes The byte array to parse.
 * @param parser The parser to use for parsing the value.
 * @param endianness The endianness to use for reading multi-byte values.
 * @returns The parsed value.
 */
function parseFieldValue(
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
        return uint8ArrayToNumberLE(bytes);
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
        throw new Error(
            `Value 0x${
                [...bytes].map((b) => b.toString(16).padStart(2, "0")).join(" ")
            } not found in enum mapping ${JSON.stringify(parser.mapping)}`,
        );
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

        let id: string;
        if (idBytes.every((b) => b === 0)) {
            id = "local";
        } else {
            const decoder = new TextDecoder("utf-8");
            id = decoder.decode(idBytes).replace(/\0.*$/g, "");
        }

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
    } else if (parser.type == "custom") {
        const customParser = CUSTOM_PARSERS.get(parser.name);
        if (!customParser) {
            throw new Error(`Custom parser ${parser.name} not found`);
        }
        return customParser(bytes);
    } else if (parser.type == "hex") {
        return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    } else if (parser.type == "array") {
        return [...bytes];
    }
    throw new Error(`Unknown parser type: ${parser.type}`);
}

/**
 * Parse a byte array into individual bit fields.
 * @param bytes The byte array to parse.
 * @param bitMasks The bit masks to apply.
 * @param endianness The endianness to use for reading multi-byte values.
 * @returns An array of parsed fields.
 */
function parseBitMasks(
    bytes: Uint8Array,
    bitMasks: BitMaskDefinition[],
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

/**
 * Find a field by its ID.
 * @param id The ID of the field to find.
 * @param fields The list of fields to search.
 * @returns The found field, or null if not found.
 */
function findFieldById(
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

/**
 * Convert a byte array to a little-endian number.
 * @param arr The byte array to convert (up to 6 bytes for safe JS number).
 * @returns The converted number.
 */
function uint8ArrayToNumberLE(arr: Uint8Array): number {
    if (arr.length > 6) throw new Error("Too many bytes for a safe JS number");
    let num = 0;
    for (let i = arr.length - 1; i >= 0; i--) {
        num = (num << 8) | arr[i];
    }
    return num;
}
