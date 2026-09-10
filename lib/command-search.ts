export type SearchableCommand = {
    label: string;
    description?: string;
    keywords?: string[];
    category: string;
};

const normalize = (value: string) => value.normalize('NFKC').toLowerCase().trim();
const compact = (value: string) => normalize(value).replace(/\s+/gu, '');

/** Literal keyword search: Korean spacing and English case never change a match. */
export function commandSearchScore(command: SearchableCommand, query: string): number {
    const normalized = normalize(query);
    if (!normalized) return 1;
    const label = compact(command.label), exact = compact(query);
    if (label === exact) return 1;
    if (label.startsWith(exact)) return .95;
    if (label.includes(exact)) return .9;
    const aliases = (command.keywords ?? []).map(compact);
    if (aliases.includes(exact)) return .85;
    const fields = [label, ...aliases, compact(command.category), compact(command.description ?? '')];
    const words = normalized.split(/\s+/u);
    if (!words.every(word => fields.some(field => field.includes(word)))) return 0;
    if (words.every(word => label.includes(word))) return .8;
    if (words.every(word => [label, ...aliases].some(field => field.includes(word)))) return .7;
    return .5;
}
