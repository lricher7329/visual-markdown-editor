import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ConfigKeys, CONFIG_PREFIX, EditorThemes, SAVE_DEBOUNCE_MS } from '../types/config';

describe('ConfigKeys', () => {
    it('should have all required configuration keys', () => {
        expect(ConfigKeys.editorTheme).toBe('editorTheme');
        expect(ConfigKeys.pdfMarginTop).toBe('pdfMarginTop');
        expect(ConfigKeys.chromiumPath).toBe('chromiumPath');
        expect(ConfigKeys.pasterImgPath).toBe('pasterImgPath');
        expect(ConfigKeys.workspacePathAsImageBasePath).toBe('workspacePathAsImageBasePath');
        expect(ConfigKeys.openOutline).toBe('openOutline');
        expect(ConfigKeys.hideToolbar).toBe('hideToolbar');
        expect(ConfigKeys.previewCode).toBe('previewCode');
    });

    it('should use the correct configuration prefix', () => {
        expect(CONFIG_PREFIX).toBe('document-viewer');
    });
});

describe('EditorThemes', () => {
    it('should all be accepted by the editorTheme setting', () => {
        // The theme picker writes these names; VS Code flags values missing from the enum
        const manifest = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));
        const setting = manifest.contributes.configuration.properties['document-viewer.editorTheme'];
        expect(setting.enum).toEqual([...EditorThemes]);
    });

    it('should include Auto theme', () => {
        expect(EditorThemes).toContain('Auto');
    });

    it('should include light themes', () => {
        expect(EditorThemes).toContain('Light');
        expect(EditorThemes).toContain('Solarized');
    });

    it('should include dark themes', () => {
        expect(EditorThemes).toContain('One Dark');
        expect(EditorThemes).toContain('Dracula');
        expect(EditorThemes).toContain('Nord');
    });
});

describe('SAVE_DEBOUNCE_MS', () => {
    it('should be a reasonable debounce value', () => {
        expect(SAVE_DEBOUNCE_MS).toBeGreaterThan(0);
        expect(SAVE_DEBOUNCE_MS).toBeLessThan(2000);
    });
});
