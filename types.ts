// block-types.ts
export const Category = {
    red: '#f9015a',
    green: '#29b570',
    blue: '#1a87ad',
    yellow: '#dfa72e',
	purple: '#893fd0',
    gray: '#6B7280',
    dark_blue: '#2e37df',
}

export type ParsedValue = string | number | boolean;
export type Category = keyof typeof Category;

export type AndCondition = {
	and: FieldCondition[];
}
export type OrCondition = {
	or: FieldCondition[];
}
export type NotCondition = {
	not: FieldCondition;
}

export type EqualsCondition = {
	equals: [string, ParsedValue];
}
export type IncludesCondition = {
	includes: [string, ParsedValue[]];
}
export type GreaterThanCondition = {
	greaterThan: [string, number];
}
export type LessThanCondition = {
	lessThan: [string, number];
}

export type FieldCondition = AndCondition | OrCondition | NotCondition | EqualsCondition | GreaterThanCondition | LessThanCondition | IncludesCondition;

export type EnumParser = {
	[type: string]: ParsedValue;
}


export type ValueParser = 
	{
		type: 'enum',
		mapping: EnumParser
	}
	| 
	{
		type: 'boolean'|'int'|'uint'|'float'|'string'|'endpoint'|'pointer',
	}

export type BaseFieldDefinition = {
	id?: string; // optional id to reference this field in conditions or repeat
	name: string;
	description?: string,
	group?: string;
	category: Category;
	byteSize: number;
	repeat?: string|number; // name of the field that indicates how many times to repeat or a fixed number
	if?: FieldCondition; // condition to include this field
}

export type NestedFieldDefinition = BaseFieldDefinition & {
	subFields: FieldDefinition[];
}
export type FieldWithBitMaskDefinition = BaseFieldDefinition & {
  	bitMasks: BitMask[];
}
export type DirectFieldDefinition = BaseFieldDefinition & {
	parser?: ValueParser; // function to compute the parsed value based on other fields
}

export type FieldDefinition = NestedFieldDefinition | FieldWithBitMaskDefinition | DirectFieldDefinition;


export type SectionDefinition = {
	name: string;
	fields: FieldDefinition[];
}

export type Endianness =  "little" | "big";

export type BitMask = {
	id?: string;
	name: string;
	length?: number; // number of bits (default 1)
	parser?: ValueParser
}

export type ParsedFieldWithSubFields = {
	subFields: ParsedField[][]
}
export type DirectParsedField = {
	parsedValue?: ParsedValue,
}
export type ParsedField = {
	id?: string,
	name: string,
	bytes: Uint8Array 
} & (ParsedFieldWithSubFields | DirectParsedField);

export type ParsedSection = {
	name: string,
	fields: ParsedField[]
}
export type ParsedStructure = ParsedSection[];


export type StructureDefinition = {
	name: string;
	endian?: Endianness; // default is little
	sections: SectionDefinition[];
}