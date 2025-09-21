import type {
    BitMask,
    EnumParser,
    FieldCondition,
    ParsedValue,
} from "./mod.ts";
import { parseStructureWithReader, type Uint8ArrayReader } from "./parser.ts";
import type {
    FieldDefinition,
    ParsedStructure,
    SectionDefinition,
    StructureDefinition,
} from "./types.ts";
import { tablemark } from "tablemark";
import GithubSlugger from "github-slugger";

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

export function generateTable(
    definition: SectionDefinition | FieldDefinition,
    sectionDefinition: SectionDefinition = definition as SectionDefinition,
    level: number = 1,
): string {
    const isBitMasksField = "bitMasks" in definition;
    const iterable: FieldDefinition[] | BitMask[] = "fields" in definition
        ? definition.fields
        : (isBitMasksField
            ? definition.bitMasks
            : "subFields" in definition
            ? definition.subFields!
            : []);
    const conditionKey = "Condition (for optional fields)";
    const fields: Record<string, unknown>[] = iterable.map((field) => {
        const fields = [
            {
                Field: generateFieldName(sectionDefinition.name, field),
                "Size": generateSize(sectionDefinition, field),
                Type: getFieldType(field),
                [conditionKey]: generateCondition(
                    sectionDefinition,
                    field as FieldDefinition,
                ),
            },
        ];
        return fields;
    }).flat(1);

    // remove description if empty for all fields
    if (fields.every((f) => f[conditionKey] === "-")) {
        for (const f of fields) {
            delete f[conditionKey];
        }
    }

    const table = tablemark(
        fields,
        {
            maxWidth: 160,
            headerCase: "preserve",
        },
    );
    const descriptions = generateFieldDescriptions(
        definition,
        sectionDefinition,
        level,
    );

    return table + "\n\n" + descriptions;
}

export function fieldHasDescription(field: FieldDefinition | BitMask): boolean {
    if (field.description) return true;
    if ("subFields" in field || "bitMasks" in field) return true;
    if (field.parser?.type == "enum") return true;
    return false;
}

export function generateFieldDescriptions(
    definition: SectionDefinition | FieldDefinition,
    sectionDefinition: SectionDefinition = definition as SectionDefinition,
    level: number = 1,
): string {
    const isBitMasksField = "bitMasks" in definition;
    const iterable: FieldDefinition[] | BitMask[] = "fields" in definition
        ? definition.fields
        : (isBitMasksField ? definition.bitMasks : []);

    let text = "";
    for (const field of iterable) {
        if (!fieldHasDescription(field)) continue;
        text += `<a id="${
            generateFieldSlug(sectionDefinition.name, field)
        }"></a>\n${"#".repeat(level + 1)} ${field.name}\n${
            field.description ?? ""
        }\n`;
        if ("bitMasks" in field || "subFields" in field) {
            text += generateTable(field, sectionDefinition, level + 1);
        }
        if ("parser" in field && field.parser?.type == "enum") {
            text += `**Enum Mapping:**\n\n`;
            text += generateEnumMappingTable(field.parser.mapping);
            text += `\n\n`;
        }
    }
    return text;
}

function generateEnumMappingTable(enumParser: EnumParser): string {
    const rows = Object.entries(enumParser).map(([key, value]) => ({
        "Integer Value": wrapCodeBlock(key),
        "Mapped Value": stringifyParsedValue(value),
    }));
    return tablemark(rows, { headerCase: "preserve" });
}

function wrapCodeBlock(text: string): string {
    return `\`${text}\``;
}

function generateFieldSlug(
    sectionName: string,
    field: FieldDefinition | BitMask,
): string {
    return generateFieldSlugFromId(sectionName, field.id ?? field.name);
}

function generateFieldSlugFromId(sectionName: string, id: string): string {
    return new GithubSlugger().slug(sectionName + "-" + id);
}

function generateSize(
    sectionDefinition: SectionDefinition,
    field: FieldDefinition | BitMask,
): string {
    if (isBitmask(field)) {
        return `${field.length} bit${field.length === 1 ? "" : "s"}`;
    }
    if (typeof field.repeat == "string") {
        return `${field.byteSize} byte${field.byteSize === 1 ? "" : "s"} x ${
            generateLinkedField(sectionDefinition, field.repeat)
        }`;
    } else if (typeof field.repeat == "number") {
        return `${field.byteSize} byte${
            field.byteSize === 1 ? "" : "s"
        } x ${field.repeat}`;
    }
    return `${field.byteSize} byte${field.byteSize === 1 ? "" : "s"}`;
}

function isBitmask(
    definition: FieldDefinition | BitMask,
): definition is BitMask {
    return "length" in definition;
}

function generateCondition(
    sectionDefinition: SectionDefinition,
    field: FieldDefinition,
): string {
    if (field.if) {
        return stringifyFieldCondition(sectionDefinition, field.if);
    } else {
        return "-";
    }
}

function stringifyFieldCondition(
    sectionDefinition: SectionDefinition,
    condition: FieldCondition,
): string {
    const key = Object.keys(condition)[0] as keyof typeof condition;
    const value =
        condition[key] as (FieldCondition | ParsedValue | ParsedValue[])[];
    if (key == "or" || key == "and") {
        return value
            .map((v) =>
                stringifyFieldCondition(sectionDefinition, v as FieldCondition)
            )
            .join(` ${key} `);
    } else if (key == "not") {
        return `not (${
            stringifyFieldCondition(
                sectionDefinition,
                value[0] as FieldCondition,
            )
        })`;
    } else if (key == "includes") {
        return `${
            generateLinkedField(sectionDefinition, value[0] as string)
        } in (${
            (value[1] as ParsedValue[]).map(stringifyParsedValue).join(",")
        })`;
    } else {
        return `${
            generateLinkedField(sectionDefinition, value[0] as string)
        } ${key} ` +
            stringifyParsedValue(value[1] as ParsedValue);
    }
}

function generateLinkedField(sectionDefinition: SectionDefinition, id: string) {
    const referredField = findDefinitionById(id, sectionDefinition.fields);
    if (!referredField) throw new Error(`Field #${id} not found`);
    if (!fieldHasDescription(referredField)) {
        return wrapCodeBlock(referredField.name);
    }
    return `[${wrapCodeBlock(referredField.name)}](#${
        generateFieldSlugFromId(sectionDefinition.name, id)
    })`;
}

function stringifyParsedValue(value: ParsedValue) {
    return wrapCodeBlock(JSON.stringify(value));
}

function generateFieldName(
    sectionName: string,
    field: FieldDefinition | BitMask,
): string {
    if (!fieldHasDescription(field)) return field.name;
    return `[${field.name}](#${generateFieldSlug(sectionName, field)})`;
}

function getFieldType(field: FieldDefinition | BitMask): string {
    if ("parser" in field) {
        if (field.parser?.type == "uint") {
            return "byteSize" in field ? `uint${field.byteSize * 8}` : `uint`;
        } else if (field.parser?.type == "int") {
            return "byteSize" in field ? `int${field.byteSize * 8}` : `int`;
        } else if (field.parser?.type == "float") {
            return "byteSize" in field ? `float${field.byteSize * 8}` : `float`;
        } else if (field.parser?.type == "enum") {
            return `enum`;
        } else {
            return field.parser?.type ?? "-";
        }
    } else if ("bitMasks" in field) {
        return `bitmask`;
    }
    return "-";
}

function findDefinitionById(
    id: string,
    fields: FieldDefinition[],
): FieldDefinition | BitMask | null {
    for (const field of fields) {
        if (field.id === id) return field;
        if ("subFields" in field && field.subFields) {
            const subField = findDefinitionById(id, field.subFields);
            if (subField) return subField;
        } else if ("bitMasks" in field) {
            for (const bitMask of field.bitMasks) {
                if (bitMask.id == id) return bitMask;
            }
        }
    }
    return null;
}
