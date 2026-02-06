import path from 'path';

// 10 digits for Group ID
const GROUP_ID_DIGITS = 10;
// 14 digits for Variant ID
const VARIANT_ID_DIGITS = 14;

export function formatCanonicalName(groupId: number, variantId: number, extension: string = '.png'): string {
    const g = groupId.toString().padStart(GROUP_ID_DIGITS, '0');
    const v = variantId.toString().padStart(VARIANT_ID_DIGITS, '0');
    // Ensure extension has dot
    const ext = extension.startsWith('.') ? extension : `.${extension}`;
    return `${g}_${v}${ext}`;
}

export function parseCanonicalName(filename: string): { groupId: number; variantId: number } | null {
    const base = path.basename(filename, path.extname(filename));
    const parts = base.split('_');

    // Simplest check: 2 parts, specific lengths?
    // User format: ##########_##############
    if (parts.length !== 2) return null;

    const [gStr, vStr] = parts;

    if (gStr.length !== GROUP_ID_DIGITS || vStr.length !== VARIANT_ID_DIGITS) return null;

    const groupId = parseInt(gStr, 10);
    const variantId = parseInt(vStr, 10);

    if (isNaN(groupId) || isNaN(variantId)) return null;

    return { groupId, variantId };
}
