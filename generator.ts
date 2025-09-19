import { parseStructureWithReader, type Uint8ArrayReader } from "./parser.ts";
import type { ParsedStructure, StructureDefinition } from "./types.ts";

type CustomBytes = {[key: string]: CustomBytes|Record<string, number[]>}

export class Uint8ArrayGeneratorReader implements Uint8ArrayReader {

	constructor(private customByteData?: CustomBytes) {}

	readBytes(count: number, fieldPath: string[]): Uint8Array {
		// if no custom data for field path, return zeros
		let customBytes: CustomBytes|Record<string, number[]>|number[]|undefined = this.customByteData;
		for (const part of fieldPath) {
			if (!customBytes) break;
			if (Array.isArray(customBytes)) throw new Error(`Invalid path to custom byte data: ${fieldPath.join('.')}`);
			customBytes = customBytes[part];
		}

		if (!customBytes) {
			return new Uint8Array(new Array(count).fill(0));
		}
		if (!Array.isArray(customBytes)) {
			throw new Error(`Invalid path to custom byte data: ${fieldPath.join('.')}`);
		}
		if (customBytes.length < count) {
			throw new Error(`Not enough custom byte data for field ${fieldPath.join('.')} - expected ${count}, got ${customBytes.length}`);
		}
		return new Uint8Array(customBytes);
	}

	peekBytes(count: number, fieldPath: string[]): Uint8Array {
		return this.readBytes(count, fieldPath);
	}
}

export function generateStructure(structDefinition: StructureDefinition, customByteData?: CustomBytes): ParsedStructure {
	const generator = new Uint8ArrayGeneratorReader(customByteData);
	return parseStructureWithReader(structDefinition, generator);
}

export function generateBytes(structDefinition: StructureDefinition, customByteData?: CustomBytes): Uint8Array {
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