const vscode = window['acquireVsCodeApi']?.();
const postMessage = (message: { type: string; content?: unknown }) => { if (vscode) { vscode.postMessage(message) } }

const events: Record<string, (content: unknown) => void> = {}
function receive({ data }: MessageEvent) {
    if (!data)
        return;
    if (events[data.type]) {
        events[data.type](data.content);
    }
}
window.addEventListener('message', receive)
const getVscodeEvent = () => {
    return {
        on(event: string, callback: (content: unknown) => void) {
            events[event] = callback
            return this;
        },
        emit(event: string, data?: unknown) {
            postMessage({ type: event, content: data })
        }
    }
}
export const handler = getVscodeEvent();

export function isCompose(e: KeyboardEvent) {
    return e.metaKey || e.ctrlKey;
}

window.addEventListener('keydown', e => {
    if (e.code == 'F12') handler.emit('developerTool')
    // Prevent double-paste bug with Hebrew keyboard layout in VS Code
    else if ((isCompose(e) && e.code == 'KeyV')) e.preventDefault()
})