"use strict";
import * as vscode from "vscode";

export class Output {

    public static debug(value: unknown): void {
        this.log(value, false);
    }

    public static log(value: unknown, showLog = true): void {
        if (this.outputChannel == null) {
            this.outputChannel = vscode.window.createOutputChannel("Markdown Editor");
        }
        if (showLog) this.outputChannel.show(true);
        this.outputChannel.appendLine(`${value}`);
        this.outputChannel.appendLine("-----------------------------------------------------------------------------------------");
    }

    private static outputChannel: vscode.OutputChannel;
}
