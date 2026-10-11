import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { detectZoteroPaths } from '../service/zotero/zoteroDetect';

// Profile layout per platform: where profiles.ini lives and its relative Path= value
const layout = process.platform === 'darwin'
    ? { root: ['Library', 'Application Support', 'Zotero'], profile: 'Profiles/abc.default' }
    : { root: ['.zotero', 'zotero'], profile: 'abc.default' };

describe.skipIf(process.platform === 'win32')('detectZoteroPaths', () => {
    let home: string;
    const originalHome = process.env.HOME;

    const writeProfile = (dataDir: string) => {
        const root = join(home, ...layout.root);
        mkdirSync(join(root, layout.profile), { recursive: true });
        writeFileSync(join(root, 'profiles.ini'),
            `[General]\nStartWithLastProfile=1\n\n[Profile0]\nName=default\nIsRelative=1\nPath=${layout.profile}\nDefault=1\n`);
        writeFileSync(join(root, layout.profile, 'prefs.js'),
            `user_pref("extensions.zotero.dataDir", "${dataDir}");\nuser_pref("extensions.zotero.useDataDir", true);\n`);
    };

    beforeEach(() => {
        home = mkdtempSync(join(tmpdir(), 'zotero-detect-'));
        process.env.HOME = home;
    });

    afterEach(() => {
        process.env.HOME = originalHome;
        rmSync(home, { recursive: true, force: true });
    });

    it('should find a custom data directory through the default profile', async () => {
        const dataDir = join(home, 'CustomZotero');
        mkdirSync(dataDir);
        writeFileSync(join(dataDir, 'zotero.sqlite'), '');
        writeProfile(dataDir);

        const result = await detectZoteroPaths();
        expect(result.source).toBe('prefs');
        expect(result.zoteroDbPath).toBe(join(dataDir, 'zotero.sqlite'));
        // Current Better BibTeX keeps citation keys in zotero.sqlite
        expect(result.betterBibtexDbPath).toBeNull();
        expect(result.error).toBeUndefined();
    });

    it('should fall back to ~/Zotero when the configured directory is stale', async () => {
        mkdirSync(join(home, 'Zotero'));
        writeFileSync(join(home, 'Zotero', 'zotero.sqlite'), '');
        writeProfile(join(home, 'Moved'));

        const result = await detectZoteroPaths();
        expect(result.source).toBe('default');
        expect(result.zoteroDbPath).toBe(join(home, 'Zotero', 'zotero.sqlite'));
    });
});
