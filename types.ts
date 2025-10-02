/**
 * Exported types for defining and parsing binary structures.
 */
export type ParsedValue = string | number | boolean;

/**
 * And condition to include fields only if all conditions are met.
 */
export type AndCondition = {
    and: FieldCondition[];
};

/**
 * Or condition to include fields if any of the conditions are met.
 */
export type OrCondition = {
    or: FieldCondition[];
};

/**
 * Not condition to include fields if the condition is not met.
 */
export type NotCondition = {
    not: FieldCondition;
};

/**
 * Equals condition to check if a field equals a specific value.
 */
export type EqualsCondition = {
    equals: [string, ParsedValue];
};

/**
 * Includes condition to check if a field includes any of the specified values.
 */
export type IncludesCondition = {
    includes: [string, ParsedValue[]];
};

/**
 * Greater than condition to check if a field is greater than a specific value.
 */
export type GreaterThanCondition = {
    greaterThan: [string, number];
};

/**
 * Less than condition to check if a field is less than a specific value.
 */
export type LessThanCondition = {
    lessThan: [string, number];
};

/**
 * A condition to include fields based on other field values.
 */
export type FieldCondition =
    | AndCondition
    | OrCondition
    | NotCondition
    | EqualsCondition
    | GreaterThanCondition
    | LessThanCondition
    | IncludesCondition;

/**
 * A mapping of enum values to their parsed representations.
 */
export type EnumParser = {
    [type: string]: ParsedValue;
};

/**
 * A parser to convert raw field values into parsed representations.
 */
export type ValueParser =
    | {
        type: "enum";
        mapping: EnumParser;
    }
    | {
        type: "custom";
        name: string;
    }
    | {
        type:
            | "boolean"
            | "int"
            | "uint"
            | "float"
            | "string"
            | "endpoint"
            | "pointer";
    };

/**
 * Usage types for fields and sections.
 */
export type Usage = "omit";

/**
 * Base definition for a field in a structure.
 */
export type BaseFieldDefinition = {
    id?: string; // optional id to reference this field in conditions or repeat
    name: string;
    description?: string;
    category?: string;
    usage?: Usage;
    byteSize: number;
    repeat?: string | number; // name of the field that indicates how many times to repeat or a fixed number
    if?: FieldCondition; // condition to include this field
    parser?: ValueParser; // function to compute the parsed value based on other fields
};

/**
 * A field that can contain sub-fields or bit masks.
 */
export type NestedFieldDefinition = BaseFieldDefinition & {
    subFields?: FieldDefinition[];
};

/**
 * A field that contains bit masks.
 */
export type FieldWithBitMaskDefinition = BaseFieldDefinition & {
    bitMasks: BitMaskDefinition[];
};

/**
 * A field definition which can be either a nested field or a field with bit masks.
 */
export type FieldDefinition =
    | NestedFieldDefinition
    | FieldWithBitMaskDefinition;

/**
 * A structure field that has been parsed and contains its raw bytes.
 */
export type SectionDefinition = {
    name: string;
    fields: FieldDefinition[];
    usage?: Usage;
};

/**
 * Endianness types for structures.
 */
export type Endianness = "little" | "big";

/**
 * Definition for a bit mask within a field.
 */
export type BitMaskDefinition = {
    id?: string;
    name: string;
    length: number;
    description?: string;
    parser?: ValueParser;
    usage?: Usage;
};

/**
 * A parsed field which can either have sub-fields or a direct parsed value.
 */
export type ParsedFieldWithSubFields = {
    subFields: ParsedField[][];
};

/**
 * A parsed field which has a direct parsed value.
 */
export type DirectParsedField = {
    parsedValue?: ParsedValue;
};

/**
 * A parsed field which can either have sub-fields or a direct parsed value.
 */
export type ParsedField = {
    id?: string;
    name: string;
    bytes: Uint8Array;
} & (ParsedFieldWithSubFields | DirectParsedField);

/**
 * A parsed section containing its name and parsed fields.
 */
export type ParsedSection = {
    name: string;
    fields: ParsedField[];
};

/**
 * A parsed structure containing its sections.
 */
export type ParsedStructure = ParsedSection[];

/**
 * Definition for a structure including its sections and endianness.
 */
export type StructureDefinition = {
    name: string;
    endian?: Endianness; // default is little
    sections: SectionDefinition[];
};
