// Packer: Convert a parsed structure into a JSON representation based on its definition.
// This is useful for exporting parsed data in a structured and human-readable format.
// It handles nested fields, repeated fields, and bit masks according to the structure definition.
import { parseStructure } from "./parser.ts";
import type {
    FieldDefinition,
    ParsedField,
    ParsedSection,
    ParsedStructure,
    ParsedValue,
    SectionDefinition,
    StructureDefinition,
} from "./types.ts";

export type FieldJSON = ParsedValue | string | null;
export interface FieldsJSONObject {
    [key: string]: FieldsJSON | null;
}
export type FieldsJSON = FieldJSON | FieldsJSONObject | FieldsJSON[];
export type SectionJSON = Record<string, FieldsJSON | null>;
export type StructureJSON = Record<string, SectionJSON>;

/**
 * Convert a parsed structure into a JSON representation based on its definition.
 * It respects the structure definition, including nested fields, repeated fields, and bit masks.
 * Fields or sections marked with usage "omit" are excluded from the output.
 * @param structure  The parsed structure to convert.
 * @param definition  The structure definition used for conversion.
 * @returns A JSON representation of the parsed structure.
 */
export function parsedStructureToJSON(
    structure: ParsedStructure,
    definition: StructureDefinition,
): StructureJSON {
    const result: StructureJSON = {};
    for (const section of definition.sections) {
        if (section.usage === "omit") continue;
        result[normalizeName(section.name)] = parsedSectionToJSON(
            structure.find((s) => s.name === section.name)!,
            section,
        );
    }
    return result;
}

/**
 * Parses a byte array according to a structure definition and converts it to JSON.
 * @param definition The structure definition to use for parsing.
 * @param bytes The byte array to parse.
 * @returns A JSON representation of the parsed structure.
 */
export function parseAndPackStructure(
    definition: StructureDefinition,
    bytes: Uint8Array | number[],
): StructureJSON {
    return parsedStructureToJSON(
        parseStructure(definition, bytes),
        definition,
    );
}

/**
 * Convert a parsed section into a JSON representation based on its definition.
 * @param section The parsed section to convert.
 * @param definition The section definition used for conversion.
 * @returns A JSON representation of the parsed section.
 */
function parsedSectionToJSON(
    section: ParsedSection,
    definition: SectionDefinition,
): SectionJSON {
    const result: SectionJSON = {};
    for (const field of definition.fields) {
        if (field.usage === "omit") continue;
        const parsedFields = section.fields.filter((f) =>
            f.name === field.name
        );
        result[normalizeName(field.name)] = parsedFields.length > 0
            ? parsedFieldsToJSON(parsedFields, field)
            : null;
    }
    return result;
}

/**
 * Convert parsed fields into a JSON representation based on their definition.
 * @param fields  The parsed fields to convert.
 * @param definition  The field definition used for conversion.
 * @returns A JSON representation of the parsed fields.
 */
function parsedFieldsToJSON(
    fields: ParsedField[],
    definition: FieldDefinition,
): FieldsJSON {
    if (definition.repeat) {
        return fields.map((f) => parsedFieldToJSON(f, definition));
    } else {
        return parsedFieldToJSON(fields[0], definition);
    }
}

/**
 * Convert a single parsed field into a JSON representation based on its definition.
 * @param field  The parsed field to convert.
 * @param definition  The field definition used for conversion.
 * @returns A JSON representation of the parsed field.
 */
function parsedFieldToJSON(
    field: ParsedField,
    definition: FieldDefinition,
): FieldsJSON {
    const result: Record<string, FieldsJSON | null> = {};
    if ("subFields" in definition && definition.subFields) {
        const current = field as ParsedField & { subFields: ParsedField[][] };
        for (const subFieldDef of definition.subFields) {
            if (subFieldDef.usage === "omit") continue;
            const parsedSubFields = current.subFields.map((subFields) =>
                subFields.find((f) => f.name === subFieldDef.name)
            ).filter((f) => f !== undefined);
            result[normalizeName(subFieldDef.name)] = parsedSubFields.length > 0
                ? parsedFieldsToJSON(parsedSubFields, subFieldDef)
                : null;
        }
    } else if ("bitMasks" in definition && definition.bitMasks) {
        const current = field as ParsedField & { subFields: ParsedField[][] };
        for (const bitMask of definition.bitMasks) {
            if (bitMask.usage === "omit") continue;
            const bitMaskField = current.subFields.flat().find((f) =>
                f.name === bitMask.name
            );
            if (
                bitMaskField && "parsedValue" in bitMaskField &&
                bitMaskField.parsedValue !== undefined
            ) {
                result[normalizeName(bitMask.name)] = bitMaskField.parsedValue;
            } else {
                result[normalizeName(bitMask.name)] = null;
            }
        }
    } else if ("parsedValue" in field) {
        if (field.parsedValue !== undefined) {
            return field.parsedValue;
        } else {
            return Array.from(field.bytes).map((b) =>
                b.toString(16).padStart(2, "0")
            ).join("");
        }
    }
    return result;
}

/**
 * Normalize a field or section name by converting it to lowercase and replacing non-alphanumeric characters with underscores.
 * @param name The name to normalize.
 * @returns The normalized name.
 */
function normalizeName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(
        /^-+|-+$/g,
        "",
    );
}
