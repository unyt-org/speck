import { walk } from "jsr:@std/fs@1/walk";
import { generateTable } from "../generator.ts";
import type { SectionDefinition, StructureDefinition } from "../types.ts";

const dirPath = new URL(Deno.args[0] ?? './', "file://" + Deno.cwd() + '/');
console.log(`Updating markdown files in ${dirPath.pathname}`);
await updateMarkdownFiles(dirPath);

function updateMarkdownFile(filePath: URL) {
	const content = Deno.readTextFileSync(filePath);
	// replace <speck-table/> or <speck-table>...</speck-table> with generated table
	const regex = /<speck-table?\s+([^>]+?)\/>|<speck-table?\s+([^>]+?)>[\S\s]*?<\/\s*speck-table>/g;	
	const newContent = content.replace(regex, (match, attrsString1, attrsString2) => {
		const attrs = extractAttrs(attrsString1 || attrsString2);
		const table = generateTableFromAttrs(attrs.file, attrs.section, filePath)
		if (table) {
			return `<speck-table file="${attrs.file}" section="${attrs.section}">\n\n${table}\n</speck-table>`;
		} else {
			return match; // no change
		} 
	});
	if (newContent !== content) {
		Deno.writeTextFileSync(filePath, newContent);
		console.log(`Updated ${filePath}`);
	} else {
		console.log(`No changes in ${filePath}`);
	}
}

function extractAttrs(attrsString: string): Record<string, string> {
	// parse attributes
	const attrs: Record<string, string> = {};
	const attrRegex = /(\w+)="([^"]+)"/g;
	let attrMatch;
	while ((attrMatch = attrRegex.exec(attrsString)) !== null) {
		attrs[attrMatch[1]] = attrMatch[2];
	}
	if (!attrs.file) {
		console.error(`Missing 'file' attribute in tag`);
	}
	if (!attrs.section) {
		console.error(`Missing 'section' attribute in tag`);
	}
	return attrs;
}


function generateTableFromAttrs(file: string, section: string, mdFilePath: URL): string | null {
	console.log(`Generating table for file=${file}, section=${section}`);

	const definition: StructureDefinition = JSON.parse(Deno.readTextFileSync(new URL(file, mdFilePath)));
	const sectionDefinition: SectionDefinition|undefined = definition.sections.find((s: { name: string }) => s.name === section);
	if (!sectionDefinition) {
		console.error(`Section '${section}' not found in file: ${file}`);
		return null;
	}
	// generate table
	const table = generateTable(sectionDefinition);
	return table;
}

async function updateMarkdownFiles(dirPath: URL) {
	// walk dir and find all .md files
	for await (const entry of walk(dirPath, { exts: [".md"] })) {
		if (entry.isFile) {
			console.log(`Updating ${entry.path}`);
			updateMarkdownFile(new URL("file://" + entry.path));
		}
	}
}