import * as vscode from 'vscode';
import { CONFIG_PREFIX, ConfigKey } from '../types/config';

export class Global {
    /**
     * Get configuration from vscode setting.
     * @param key config key from ConfigKeys
     */
    public static getConfig<T>(key: ConfigKey, defaultValue?: T): T {
        const config = vscode.workspace.getConfiguration(CONFIG_PREFIX);
        return config.get<T>(key, defaultValue as T);
    }

    /**
     * Update config for vscode, config must be defined in package.json.
     * @param key config key from ConfigKeys
     * @param value config value
     */
    public static async updateConfig(key: ConfigKey, value: unknown): Promise<void> {
        const config = vscode.workspace.getConfiguration(CONFIG_PREFIX);
        const meta = config.inspect(key);
        const newValue = meta?.defaultValue === value ? undefined : value;
        await config.update(key, newValue, true);
    }

    /**
     * Get the full workspace configuration object
     */
    public static getConfiguration(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration(CONFIG_PREFIX);
    }
}
