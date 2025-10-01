/**
 * Generates markdown tables from structure definitions and inserts them into markdown files.
 * @module markdown-generator
 */

import { walk } from "jsr:@std/fs@1/walk";
import { generateTable } from "./generator.ts";
import type { SectionDefinition, StructureDefinition } from "./types.ts";

/**
 * Get the file name from a file path or URL.
 * @param path The file path or URL.
 * @returns The file name.
 */
function getFileNameFromPath(path: URL | string): string {
    const parts = path.toString().split("/");
    return parts.at(-1) || path.toString();
}

export type Attrs = { file: string; section: string; level?: number };

/**
 * Extract attributes from a speck-table tag.
 * @param attrsString The string containing attributes.
 * @param mdFilePath The file path of the markdown file.
 * @returns The extracted attributes.
 */
function extractAttrs(
    attrsString: string,
    mdFilePath: URL,
): { file: string; section: string; level?: number } {
    // parse attributes
    const attrs: Partial<Attrs> = {};
    const attrRegex = /(\w+)="([^"]+)"/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrsString)) !== null) {
        const key = attrMatch[1];
        const value = attrMatch[2];
        if (key == "level") attrs[key] = parseInt(value);
        else attrs[key as "file" | "section"] = value;
    }
    if (!attrs.file) {
        console.error(
            `Missing 'file' attribute in speck-table tag (${
                getFileNameFromPath(mdFilePath)
            })`,
        );
    }
    if (!attrs.section) {
        console.error(
            `Missing 'section' attribute in speck-table tag (${
                getFileNameFromPath(mdFilePath)
            })`,
        );
    }
    return attrs as Attrs;
}

/**
 * Generate a markdown table from the extracted attributes.
 * @param file The file path of the structure definition.
 * @param section The section name to generate the table for.
 * @param level The heading level for the table.
 * @param mdFilePath The file path of the markdown file.
 * @returns The generated markdown table, or null if generation failed.
 */
function generateTableFromAttrs(
    file: string,
    section: string,
    level: number | undefined,
    mdFilePath: URL,
): string | null {
    console.log(`- Generating table for section '${section}' from ${file}`);

    const definition: StructureDefinition = JSON.parse(
        Deno.readTextFileSync(new URL(file, mdFilePath)),
    );
    const sectionDefinition: SectionDefinition | undefined = definition.sections
        .find((s: { name: string }) => s.name === section);
    if (!sectionDefinition) {
        console.error(`Section '${section}' not found in file: ${file}`);
        return null;
    }
    // generate tables + descriptions
    return generateTable(sectionDefinition, sectionDefinition, level);
}

/**
 * Update a markdown file by replacing speck-table tags with generated tables.
 * @param filePath The file path of the markdown file to update.
 */
export function updateMarkdownFile(filePath: URL) {
    const content = Deno.readTextFileSync(filePath);
    // replace <speck-table/> or <speck-table>...</speck-table> with generated table
    const regex =
        /<speck-table?\s+([^>]+?)\/>|<speck-table?\s+([^>]+?)>[\S\s]*?<\/\s*speck-table>/g;
    const newContent = content.replace(
        regex,
        (match, attrsString1, attrsString2) => {
            const attrs = extractAttrs(attrsString1 || attrsString2, filePath);
            const table = generateTableFromAttrs(
                attrs.file,
                attrs.section,
                attrs.level,
                filePath,
            );
            if (table) {
                return `<speck-table level="${
                    attrs.level ?? 1
                }" file="${attrs.file}" section="${attrs.section}">\n\n${table}\n</speck-table>`;
            } else {
                return match; // no change
            }
        },
    );
    if (newContent !== content) {
        Deno.writeTextFileSync(filePath, newContent);
        console.log(`Updated ${getFileNameFromPath(filePath)}`);
    }
}

/**
 * Update all markdown files in a directory.
 * @param dirPath The directory path to search for markdown files.
 */
export async function updateMarkdownFiles(dirPath: URL) {
    // walk dir and find all .md files
    for await (const entry of walk(dirPath, { exts: [".md"] })) {
        if (entry.isFile) {
            updateMarkdownFile(new URL("file://" + entry.path));
        }
    }
}
