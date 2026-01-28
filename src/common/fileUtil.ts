import { parse } from 'path';
import * as vscode from 'vscode';
import { Global } from './global';
import { ConfigKeys } from '../types/config';

export function adjustImgPath(uri: vscode.Uri): { relPath: string; fullPath: string } {
    const imgPath = Global.getConfig<string>(ConfigKeys.pasterImgPath)
        .replace("${fileName}", parse(uri.fsPath).name.replace(/\s/g, ''))
        .replace("${now}", new Date().getTime() + "")
    return {
        relPath: imgPath.replace(/\$\{workspaceDir\}\/?/, ''),
        fullPath: imgPath.replace("${workspaceDir}", getWorkspacePath(uri))

    };
}

/**
 * Get the workspace path for a given URI.
 * In multi-root workspaces, returns the folder containing the URI.
 */
export function getWorkspacePath(uri: vscode.Uri): string {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return '';
    const workspacePath = folders[0]?.uri?.fsPath;
    if (folders.length > 1) {
        for (const folder of folders) {
            if (uri.fsPath.includes(folder.uri.fsPath)) {
                return folder.uri.fsPath;
            }
        }
    }
    return workspacePath;
}
