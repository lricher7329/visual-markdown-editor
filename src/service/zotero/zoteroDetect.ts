/**
 * Zotero data directory auto-detection
 *
 * Reads Zotero's profile configuration to find the data directory,
 * supporting custom data directory locations set by the user.
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface ZoteroDetectionResult {
    dataDir: string | null;
    zoteroDbPath: string | null;
    betterBibtexDbPath: string | null;
    source: 'prefs' | 'default' | 'not_found';
    error?: string;
}

/**
 * Get the directory holding Zotero's profiles.ini based on platform
 */
function getZoteroProfileRoot(): string {
    const platform = process.platform;
    const home = os.homedir();

    switch (platform) {
        case 'darwin':
            return path.join(home, 'Library', 'Application Support', 'Zotero');
        case 'win32':
            return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Zotero', 'Zotero');
        case 'linux':
        default:
            return path.join(home, '.zotero', 'zotero');
    }
}

/**
 * Get the default Zotero data directory based on platform
 */
function getDefaultDataDir(): string {
    const home = os.homedir();
    // Default is ~/Zotero on all platforms (since Zotero 5+)
    return path.join(home, 'Zotero');
}

/**
 * Find the active Zotero profile directory
 * Looks for profiles.ini and finds the default profile
 */
async function findActiveProfileDir(): Promise<string | null> {
    const profileRoot = getZoteroProfileRoot();

    try {
        const iniContent = await fs.readFile(path.join(profileRoot, 'profiles.ini'), 'utf-8');

        // Parse profiles.ini to find the default profile
        // Format: [Profile0] Name=default IsRelative=1 Path=Profiles/xxxxxxxx.default Default=1
        let currentProfile: { path?: string; isRelative?: boolean; isDefault?: boolean } = {};
        let defaultProfile: { path: string; isRelative: boolean } | null = null;
        const saveIfDefault = () => {
            if (currentProfile.isDefault && currentProfile.path) {
                defaultProfile = { path: currentProfile.path, isRelative: currentProfile.isRelative !== false };
            }
        };

        for (const line of iniContent.split(/\r?\n/)) {
            const trimmed = line.trim();

            if (trimmed.startsWith('[')) {
                saveIfDefault();
                currentProfile = {};
            } else if (trimmed.startsWith('Path=')) {
                currentProfile.path = trimmed.substring(5);
            } else if (trimmed.startsWith('IsRelative=')) {
                currentProfile.isRelative = trimmed.substring(11) === '1';
            } else if (trimmed.startsWith('Default=')) {
                currentProfile.isDefault = trimmed.substring(8) === '1';
            }
        }
        saveIfDefault();

        if (defaultProfile) {
            const { path: profilePath, isRelative } = defaultProfile;
            // Relative paths are relative to the directory holding profiles.ini
            return isRelative ? path.join(profileRoot, profilePath) : profilePath;
        }
    } catch {
        // profiles.ini not found
    }

    // No default profile recorded: use the first profile directory found.
    // Profiles sit in a Profiles/ subfolder on macOS and Windows.
    const profilesDir = process.platform === 'darwin' || process.platform === 'win32'
        ? path.join(profileRoot, 'Profiles')
        : profileRoot;
    try {
        const entries = await fs.readdir(profilesDir, { withFileTypes: true });
        const profileDirs = entries.filter(e => e.isDirectory() && e.name.includes('.'));
        if (profileDirs.length > 0) {
            return path.join(profilesDir, profileDirs[0].name);
        }
    } catch {
        // Profiles directory doesn't exist
    }
    return null;
}

/**
 * Parse prefs.js to find the Zotero data directory
 */
async function parsePrefsForDataDir(profileDir: string): Promise<string | null> {
    const prefsPath = path.join(profileDir, 'prefs.js');

    try {
        const prefsContent = await fs.readFile(prefsPath, 'utf-8');

        // Look for: user_pref("extensions.zotero.dataDir", "/path/to/data");
        const match = prefsContent.match(/user_pref\s*\(\s*["']extensions\.zotero\.dataDir["']\s*,\s*["']([^"']+)["']\s*\)/);

        if (match && match[1]) {
            return match[1];
        }

        return null; // Not set, use default
    } catch {
        return null;
    }
}

/**
 * Verify that database files exist in a directory
 */
async function verifyDatabaseFiles(dataDir: string): Promise<{ zotero: boolean; bbt: boolean }> {
    const zoteroDb = path.join(dataDir, 'zotero.sqlite');
    const bbtDb = path.join(dataDir, 'better-bibtex.sqlite');

    const [zoteroExists, bbtExists] = await Promise.all([
        fs.access(zoteroDb).then(() => true).catch(() => false),
        fs.access(bbtDb).then(() => true).catch(() => false)
    ]);

    return { zotero: zoteroExists, bbt: bbtExists };
}

/**
 * Auto-detect Zotero database paths
 */
export async function detectZoteroPaths(): Promise<ZoteroDetectionResult> {
    // Step 1: Find the active profile directory
    const profileDir = await findActiveProfileDir();

    let dataDir: string | null = null;
    let source: 'prefs' | 'default' | 'not_found' = 'not_found';

    // Step 2: Try to read data directory from prefs.js
    if (profileDir) {
        dataDir = await parsePrefsForDataDir(profileDir);
        if (dataDir) {
            source = 'prefs';
        }
    }

    // Step 3: Fall back to the default location, also when the configured one is stale
    if (!dataDir || !(await verifyDatabaseFiles(dataDir)).zotero) {
        dataDir = getDefaultDataDir();
        source = 'default';
    }

    // Step 4: Verify the database files exist
    const { zotero, bbt } = await verifyDatabaseFiles(dataDir);

    if (!zotero) {
        return {
            dataDir,
            zoteroDbPath: null,
            betterBibtexDbPath: null,
            source: 'not_found',
            error: `Zotero database not found at ${path.join(dataDir, 'zotero.sqlite')}. Is Zotero installed?`
        };
    }

    const result: ZoteroDetectionResult = {
        dataDir,
        zoteroDbPath: path.join(dataDir, 'zotero.sqlite'),
        betterBibtexDbPath: bbt ? path.join(dataDir, 'better-bibtex.sqlite') : null,
        source
    };

    return result;
}

/**
 * Get a human-readable description of the detection result
 */
export function describeDetectionResult(result: ZoteroDetectionResult): string {
    if (result.source === 'not_found') {
        return result.error || 'Zotero installation not found';
    }

    const sourceDesc = result.source === 'prefs'
        ? 'custom data directory (from Zotero settings)'
        : 'default location';

    let message = `Found Zotero at ${result.dataDir} (${sourceDesc})`;

    if (result.error) {
        message += `\nWarning: ${result.error}`;
    }

    return message;
}
