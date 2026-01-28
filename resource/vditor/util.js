// Cleanup registry for event listeners
const cleanupFunctions = [];

// Constants
const SCROLL_OFFSET = 70;
const SCROLL_HACK_INTERVAL_MS = 10;
const CONTEXT_MENU_OFFSET_X = 10;
const SEARCH_DEBOUNCE_MS = 150;
const TEXT_PREVIEW_MAX_LENGTH = 100;
const TEXT_PREVIEW_SHORT_LENGTH = 60;

export function cleanup() {
    cleanupFunctions.forEach(fn => fn());
    cleanupFunctions.length = 0;
}

const latexSymbols = [
    // Operators
    { name: 'log', value: "\\log" },
    // Relational operators
    { name: 'pm', value: "\\pm" },
    { name: 'times', value: "\\times" },
    { name: 'leq', value: "\\leq" },
    { name: 'eq', value: "\\eq" },
    { name: 'geq', value: "\\geq" },
    { name: 'neq', value: "\\neq" },
    { name: 'approx', value: "\\approx" },
    { name: 'prod', value: "\\prod" },
    { name: 'bigodot', value: "\\bigodot" },
    // Logical symbols
    { name: 'exists', value: "\\exists" },
    { name: 'forall', value: "\\forall" },
    { name: 'rightarrow', value: "\\rightarrow" },
    { name: 'leftarrow', value: "\\leftarrow" },
    // Trigonometric functions
    { name: 'sin', value: "\\sin" },
    { name: 'cos', value: "\\cos" },
    { name: 'tan', value: "\\tan" },
    // Functions
    { name: 'fraction', value: "\\frac{}{}" },
    { name: 'sqrt', value: "\\sqrt{}" },
    { name: 'sum', value: "\\sum_{i=0}^n" },
    // Greek letters
    { name: 'alpha', value: "\\alpha" },
    { name: 'beta', value: "\\beta" },
    { name: 'Delta', value: "\\Delta" },
    { name: 'delta', value: "\\delta" },
    { name: 'epsilon', value: "\\epsilon" },
    { name: 'theta', value: "\\theta" },
    { name: 'lambda', value: "\\lambda" },
    { name: 'Lambda', value: "\\Lambda" },
    { name: 'phi', value: "\\phi" },
    { name: 'Phi', value: "\\Phi" },
    { name: 'omega', value: "\\omega" },
    { name: 'Omega', value: "\\Omega" },
];

export const hotKeys = [
    {
        key: '\\',
        hint: (key) => {
            if (document.getSelection()?.anchorNode?.parentElement?.getAttribute('data-type') != "math-inline") {
                return []
            }
            const results = !key ? latexSymbols : latexSymbols.filter((symbol) => symbol.name.toLowerCase().startsWith(key.toLowerCase()));
            return results.map(com => ({
                html: com.name, value: com.value
            }));
        },
    },
]

const isMac = navigator.userAgent.includes('Mac OS');
const shortcutTip = isMac ? '⌘ ^ E' : 'Ctrl Alt E';

// Zoom functionality
let currentZoom = 100;
const ZOOM_STEP = 10;
const ZOOM_MIN = 50;
const ZOOM_MAX = 200;

export function zoomIn() {
    setZoom(Math.min(currentZoom + ZOOM_STEP, ZOOM_MAX));
}

export function zoomOut() {
    setZoom(Math.max(currentZoom - ZOOM_STEP, ZOOM_MIN));
}

export function zoomReset() {
    setZoom(100);
}

export function setZoom(level) {
    currentZoom = level;
    const content = document.querySelector('.vditor-reset');
    if (content) {
        content.style.fontSize = `${level}%`;
    }
    updateZoomIndicator();
}

export function getZoom() {
    return currentZoom;
}

function updateZoomIndicator() {
    const indicator = document.getElementById('zoom-indicator');
    if (indicator) {
        indicator.textContent = `${currentZoom}%`;
        indicator.title = `Zoom: ${currentZoom}% (Ctrl+0 to reset)`;
    }
}

export function initZoomControls() {
    // Mouse wheel zoom with Ctrl/Cmd
    const wheelHandler = (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.deltaY < 0) {
                zoomIn();
            } else {
                zoomOut();
            }
        }
    };
    document.addEventListener('wheel', wheelHandler, { passive: false });

    // Keyboard shortcuts for zoom
    const zoomKeyHandler = (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === '=' || e.key === '+') {
                e.preventDefault();
                zoomIn();
            } else if (e.key === '-') {
                e.preventDefault();
                zoomOut();
            } else if (e.key === '0') {
                e.preventDefault();
                zoomReset();
            }
        }
    };
    document.addEventListener('keydown', zoomKeyHandler);

    // Register cleanup
    cleanupFunctions.push(() => {
        document.removeEventListener('wheel', wheelHandler);
        document.removeEventListener('keydown', zoomKeyHandler);
    });
}

export async function getToolbar() {
    // Icons based on VS Code Codicons style (filled, clear at small sizes)
    const icons = {
        // Panel left - sidebar toggle (Codicon: layout-sidebar-left)
        panelLeft: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2 1L1 2v12l1 1h12l1-1V2l-1-1H2zm0 13V2h4v12H2zm5 0V2h7v12H7z"/></svg>',
        // Search - magnifying glass (Codicon: search)
        search: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M11.5 7a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0zm-.82 4.74a6 6 0 1 1 1.06-1.06l3.04 3.04-1.06 1.06-3.04-3.04z"/></svg>',
        // Zoom out - minus in circle (Codicon: zoom-out)
        zoomOut: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M11.5 7a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0zm-.82 4.74a6 6 0 1 1 1.06-1.06l3.04 3.04-1.06 1.06-3.04-3.04zM4 7h6v1H4V7z"/></svg>',
        // Zoom in - plus in circle (Codicon: zoom-in)
        zoomIn: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M11.5 7a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0zm-.82 4.74a6 6 0 1 1 1.06-1.06l3.04 3.04-1.06 1.06-3.04-3.04zM6.5 4v2.5H4v1h2.5V10h1V7.5H10v-1H7.5V4h-1z"/></svg>',
        // Comment - speech bubble (Codicon: comment)
        comment: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M1 2h14v9H7.707l-3.5 3.5L3.5 13H1V2zm13 8V3H2v7h2v2.293L6.293 10H14z"/></svg>',
        // Edit in VS Code - code brackets (Codicon: code)
        code: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M5.854 4.146L10.207 8.5l-4.353 4.354-.708-.708L8.793 8.5 5.146 4.854l.708-.708zm-3.708 0L6.5 8.5l-4.354 4.354-.707-.708L5.086 8.5 1.439 4.854l.707-.708zm9.708 0l.707.708L8.914 8.5l3.647 3.646-.707.708L7.5 8.5l4.354-4.354z"/></svg>',
        // Open in Typora - external link with T (custom icon)
        typora: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2h10v1H9v10H7V3H3V2z"/><path d="M12 7v5H7v1h6V7h-1z"/><path d="M13 6l2 2-2 2V6z"/></svg>',
        // File media - image icon (Codicon: file-media)
        fileMedia: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M2 2h12l1 1v10l-1 1H2l-1-1V3l1-1zm0 1v10h12V3H2zm3.5 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM3 11l2-3 1.5 2 2.5-4 4 5H3z"/></svg>',
        // Insert - plus icon (Codicon: add)
        insert: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M14 7v1H8v6H7V8H1V7h6V1h1v6h6z"/></svg>',
        // Citation - book with bookmark (Codicon: references)
        citation: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M2 2h3v12H2V2zm4 0h8l1 1v10l-1 1H6V2zm1 1v10h7V3H7zm2 2h4v1H9V5zm-4 2h2v1H5V7zm4 0h4v1H9V7zm-4 2h2v1H5V9zm4 0h4v1H9V9z"/></svg>',
    };

    return [
        // === Document Structure ===
        { name: 'outline', tipPosition: 's', tip: 'Toggle Outline', icon: icons.panelLeft },
        "headings",
        "|",

        // === Text Formatting ===
        "bold",
        "italic",
        "strike",
        "|",

        // === Lists ===
        "list",
        "ordered-list",
        "check",
        "|",

        // === Insert ===
        "table",
        {
            name: 'insert-menu',
            tipPosition: 's',
            tip: 'Insert',
            icon: icons.insert,
            toolbar: [
                "link",
                "upload",
                "quote",
                "code",
                "inline-code",
                "line",
            ]
        },
        {
            name: 'insert-image',
            tipPosition: 's',
            tip: 'Insert Image from File',
            icon: icons.fileMedia,
            click() {
                handler.emit('insertImage');
            }
        },
        "|",

        // === View ===
        {
            name: 'find',
            tipPosition: 's',
            tip: `Find (${isMac ? '⌘' : 'Ctrl'}F)`,
            icon: icons.search,
            click() {
                showSearchDialog();
            }
        },
        {
            name: 'zoom-out',
            tipPosition: 's',
            tip: `Zoom Out (${isMac ? '⌘' : 'Ctrl'}-)`,
            icon: icons.zoomOut,
            click() {
                zoomOut();
            }
        },
        {
            name: 'zoom-in',
            tipPosition: 's',
            tip: `Zoom In (${isMac ? '⌘' : 'Ctrl'}+)`,
            icon: icons.zoomIn,
            click() {
                zoomIn();
            }
        },
        "|",

        // === Collaboration ===
        {
            name: 'add-comment',
            tipPosition: 's',
            tip: 'Add Comment',
            icon: icons.comment,
            click() {
                const line = getCurrentEditorLine();
                const selectedText = document.getSelection()?.toString()?.trim() || '';
                showAddCommentDialog(line, selectedText);
            }
        },
        {
            name: 'insert-citation',
            tipPosition: 's',
            tip: 'Insert Citation (Zotero)',
            icon: icons.citation,
            click() {
                handler.emit("openCitationPicker");
            }
        },
        "|",

        // === Right-aligned Tools ===
        {
            name: 'open-typora',
            tipPosition: 's',
            tip: 'Open in Typora',
            className: 'right',
            icon: icons.typora,
            click() {
                handler.emit("openInTypora", true)
            }
        },
        {
            name: 'edit-vscode',
            tipPosition: 's',
            tip: `Edit in VS Code (${shortcutTip})`,
            className: 'right',
            icon: icons.code,
            click() {
                handler.emit("editInVSCode", true)
            }
        },
    ]
}

/**
 * Handle hyperlinks differently for wysiwyg and ir modes
 */
export const openLink = () => {
    const content = document.querySelector(".vditor-wysiwyg");
    const resetEl = document.querySelector(".vditor-reset");
    const irEl = document.querySelector(".vditor-ir");

    if (!content) {
        console.warn('Vditor wysiwyg element not found');
        return;
    }

    const clickCallback = e => {
        let ele = e.target;
        e.stopPropagation()
        const isSpecial = ['dblclick', 'auxclick'].includes(e.type)
        if (!isCompose(e) && !isSpecial) {
            return;
        }
        if (ele.tagName == 'A') {
            handler.emit("openLink", ele.href)
        } else if (ele.tagName == 'IMG') {
            const parent = ele.parentElement;
            if (parent?.tagName == 'A' && parent.href) {
                handler.emit("openLink", parent.href)
                return;
            }
            const src = ele.src;
            if (src?.match(/http/)) {
                handler.emit("openLink", src)
            }
        }
    }

    const scrollHandler = e => {
        handler.emit("scroll", { scrollTop: e.target.scrollTop - SCROLL_OFFSET })
    };

    const irClickHandler = e => {
        let ele = e.target;
        if (ele.classList.contains('vditor-ir__link')) {
            ele = e.target.nextElementSibling?.nextElementSibling?.nextElementSibling
        }
        if (ele?.classList?.contains('vditor-ir__marker--link')) {
            handler.emit("openLink", ele.textContent)
        }
    };

    // Add event listeners
    content.addEventListener('dblclick', clickCallback);
    content.addEventListener('click', clickCallback);
    content.addEventListener('auxclick', clickCallback);
    resetEl?.addEventListener("scroll", scrollHandler);
    irEl?.addEventListener('click', irClickHandler);

    // Register cleanup
    cleanupFunctions.push(() => {
        content.removeEventListener('dblclick', clickCallback);
        content.removeEventListener('click', clickCallback);
        content.removeEventListener('auxclick', clickCallback);
        resetEl?.removeEventListener("scroll", scrollHandler);
        irEl?.removeEventListener('click', irClickHandler);
    });
}

export function scrollEditor(top) {
    const scrollHack = setInterval(() => {
        const editorContainer = document.querySelector(".vditor-reset");
        if (!editorContainer) return;
        editorContainer.scrollTo({ top })
        clearInterval(scrollHack)
    }, SCROLL_HACK_INTERVAL_MS);
}


// Listen for toolbar option changes
export function onToolbarClick(editor) {
    const toolbar = document.querySelector('.vditor-toolbar');
    if (!toolbar) return;

    const clickHandler = (e) => {
        let target = e.target, type;
        for (let i = 0; i < 3; i++) {
            if (type = target.dataset.type) break;
            target = target.parentElement;
        }
        if (type == 'outline') {
            handler.emit("saveOutline", editor.vditor.options.outline.enable)
        }
    };

    toolbar.addEventListener("click", clickHandler);

    // Register cleanup
    cleanupFunctions.push(() => {
        toolbar.removeEventListener("click", clickHandler);
    });
}

export const createContextMenu = (editor) => {
    const menu = document.getElementById('context-menu');
    if (!menu) return;

    const mousedownHandler = e => {
        if (!e.target?.classList?.contains('dropdown-item')) {
            menu.classList.remove('show')
            menu.style.display = 'none'
        }
    };

    const contextmenuHandler = e => {
        e.stopPropagation();
        const top = e.pageY;
        const left = e.pageX + CONTEXT_MENU_OFFSET_X;
        menu.style.display = 'block'
        menu.style.top = top + "px";
        menu.style.left = left + "px";
        menu.classList.add('show')
    };

    const menuClickHandler = e => {
        menu.style.display = 'none'
        menu.classList.remove('show')
        const id = e.target.getAttribute("id");
        switch (id) {
            case "copy":
                document.execCommand("copy")
                break;
            case "paste":
                if (document.getSelection()?.toString()) { document.execCommand("delete") }
                handler.emit('command', 'document-viewer.markdown.paste')
                break;
            case "insertCitation":
                handler.emit('openCitationPicker')
                break;
            case "exportPdf":
                handler.emit('export', { type: 'pdf' })
                break;
            case "exportPdfWithoutOutline":
                handler.emit('export', { type: 'pdf', withoutOutline: true })
                break;
            case "exportDocx":
                handler.emit('export', { type: 'docx' })
                break;
            case "exportHtml":
                handler.emit('export', { type: 'html' })
                break;
            case "exportPdfPandoc":
                handler.emit('export', { type: 'pdf-pandoc' })
                break;
            case "exportDocxPandoc":
                handler.emit('export', { type: 'docx-pandoc' })
                break;
            case "exportWithOptions":
                handler.emit('openExportOptions')
                break;
        }
    };

    document.addEventListener("mousedown", mousedownHandler);
    document.addEventListener("contextmenu", contextmenuHandler);
    menu.addEventListener("click", menuClickHandler);

    // Register cleanup
    cleanupFunctions.push(() => {
        document.removeEventListener("mousedown", mousedownHandler);
        document.removeEventListener("contextmenu", contextmenuHandler);
        menu.removeEventListener("click", menuClickHandler);
    });
}

export const imageParser = (viewAbsoluteLocal) => {
    if (!viewAbsoluteLocal) return;

    const observer = new MutationObserver(mutationList => {
        for (const mutation of mutationList) {
            for (const node of mutation.addedNodes) {
                if (!node.querySelector) continue;
                const imgs = node.querySelectorAll('img')
                for (const img of imgs) {
                    const url = img.src;
                    if (url.startsWith("http")) { continue; }
                    if (url.startsWith("vscode-webview-resource") || url.includes("file:///")) {
                        img.src = `https://file+.vscode-resource.vscode-cdn.net/${url.split("file:///")[1]}`
                    }
                }
            }
        }
    });

    observer.observe(document, {
        childList: true,
        subtree: true
    });

    // Register cleanup
    cleanupFunctions.push(() => {
        observer.disconnect();
    });
}

function matchShortcut(hotkey, event) {

    const matchAlt = hotkey.match(/!/) != null == event.altKey
    const matchMeta = hotkey.match(/⌘/) != null == event.metaKey
    const matchCtrl = hotkey.match(/\^/) != null == event.ctrlKey
    const matchShifter = hotkey.match(/\+/) != null == event.shiftKey

    if (matchAlt && matchCtrl && matchShifter && matchMeta) {
        return hotkey.match(new RegExp(`\\b${event.key}\\b`, "i"))
    }

}


/**
 * Auto-complete symbols
 */
const keyCodes = [222, 219, 57];
export const autoSymbol = (handler, editor, config) => {
    // Store original execCommand
    const _exec = document.execCommand.bind(document);
    document.execCommand = (cmd, ...args) => {
        if (cmd === 'delete') {
            setTimeout(() => {
                return _exec(cmd, ...args)
            })
        } else {
            return _exec(cmd, ...args)
        }
    }

    const keydownHandler = async e => {
        if (matchShortcut('^⌘e', e) || matchShortcut('^!e', e)) {
            e.stopPropagation();
            e.preventDefault();
            return handler.emit("editInVSCode", true);
        }

        if (isMac && config.preventMacOptionKey && e.altKey && e.shiftKey && ['Digit1', 'Digit2', 'KeyW'].includes(e.code)) {
            return e.preventDefault();
        }
        if (e.code == 'F12') return handler.emit('developerTool')
        if (isCompose(e)) {
            if (e.altKey && isMac) {
                e.preventDefault()
            }
            switch (e.code) {
                case 'KeyS':
                    handler.emit("doSave", editor.getValue());
                    e.stopPropagation();
                    e.preventDefault();
                    break;
                case 'KeyV':
                    if (e.shiftKey) {
                        const text = await navigator.clipboard.readText();
                        if (text) document.execCommand('insertText', false, text.trim());
                        e.stopPropagation();
                    }
                    else if (document.getSelection()?.toString()) {
                        // Fix: selected text not cleared after cut
                        document.execCommand("delete")
                    }
                    e.preventDefault();
                    break;
            }
        }
        if (!keyCodes.includes(e.keyCode)) return;
        const selectText = document.getSelection().toString();
        if (selectText != "") { return; }
        if (e.key == '(') {
            document.execCommand('insertText', false, ')');
            document.getSelection().modify('move', 'left', 'character')
        } else if (e.key == '{') {
            document.execCommand('insertText', false, '}');
            document.getSelection().modify('move', 'left', 'character')
        } else if (e.key == '"') {
            document.execCommand('insertText', false, e.key);
            document.getSelection().modify('move', 'left', 'character')
        }
    };

    window.addEventListener('keydown', keydownHandler, isMac ? true : undefined);

    const resizeHandler = () => {
        const vditorEl = document.getElementById('vditor');
        if (vditorEl) {
            vditorEl.style.height = `${document.documentElement.clientHeight}px`;
        }
    };
    window.addEventListener('resize', resizeHandler);

    let app;
    let needFocus = false;

    const blurHandler = () => {
        if (!app) { app = document.querySelector('.vditor-reset'); }
        // Plain text has no offsetTop, so need to get parent node
        const targetNode = document.getSelection()?.baseNode?.parentNode;
        // If editor doesn't have focus now, no need to refocus
        if (!app?.contains(targetNode)) {
            needFocus = false;
            return;
        }
        // Determine if focus is needed
        const curPosition = targetNode?.offsetTop ?? 0;
        const appPosition = app?.scrollTop ?? 0;
        if (appPosition - curPosition < window.innerHeight) {
            needFocus = true;
        }
    };
    window.addEventListener('blur', blurHandler);

    const focusHandler = () => {
        if (!app) { app = document.querySelector('.vditor-reset'); }
        if (needFocus) {
            app?.focus();
            needFocus = false;
        }
    };
    window.addEventListener('focus', focusHandler);

    // Register cleanup
    cleanupFunctions.push(() => {
        window.removeEventListener('keydown', keydownHandler, isMac ? true : undefined);
        window.removeEventListener('resize', resizeHandler);
        window.removeEventListener('blur', blurHandler);
        window.removeEventListener('focus', focusHandler);
        document.execCommand = _exec; // Restore original
    });
}

/**
 * Get the current line number in the editor (1-indexed)
 */
function getCurrentEditorLine() {
    const selection = document.getSelection();
    if (!selection || !selection.anchorNode) return 1;

    // Find the parent paragraph/block element
    let node = selection.anchorNode;
    while (node && node.parentElement) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node;
            // Check if it's a block-level element in the editor
            if (el.closest('.vditor-wysiwyg') || el.closest('.vditor-ir')) {
                // Count preceding sibling elements to estimate line
                let line = 1;
                let sibling = el;
                while (sibling.previousElementSibling) {
                    sibling = sibling.previousElementSibling;
                    line++;
                }
                return line;
            }
        }
        node = node.parentElement;
    }
    return 1;
}

// Store comments in memory for rendering
let currentComments = [];

/**
 * Show dialog to add a new comment
 */
function showAddCommentDialog(line, selectedText = '') {
    // Remove existing dialog if any
    const existingDialog = document.getElementById('comment-dialog');
    if (existingDialog) existingDialog.remove();

    const dialog = document.createElement('div');
    dialog.id = 'comment-dialog';
    dialog.className = 'comment-dialog';

    const selectedTextHtml = selectedText
        ? `<div class="comment-selected-text">"${escapeHtml(selectedText.substring(0, TEXT_PREVIEW_MAX_LENGTH))}${selectedText.length > TEXT_PREVIEW_MAX_LENGTH ? '...' : ''}"</div>`
        : '';

    dialog.innerHTML = `
        <div class="comment-dialog-content">
            <div class="comment-dialog-header">Add Comment</div>
            ${selectedTextHtml}
            <textarea class="comment-input" placeholder="Enter your comment..." rows="3"></textarea>
            <div class="comment-dialog-buttons">
                <button class="comment-btn comment-btn-cancel">Cancel</button>
                <button class="comment-btn comment-btn-save">Save</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    const textarea = dialog.querySelector('.comment-input');
    textarea.focus();

    // Cancel button
    dialog.querySelector('.comment-btn-cancel').onclick = () => dialog.remove();

    // Save button
    dialog.querySelector('.comment-btn-save').onclick = () => {
        const text = textarea.value.trim();
        if (text) {
            window.handler.emit("addComment", { line, text, selectedText: selectedText || undefined });
        }
        dialog.remove();
    };

    // Handle Enter key (Shift+Enter for newline)
    textarea.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            dialog.querySelector('.comment-btn-save').click();
        } else if (e.key === 'Escape') {
            dialog.remove();
        }
    };

    // Close on backdrop click
    dialog.onclick = (e) => {
        if (e.target === dialog) dialog.remove();
    };
}

/**
 * Show dialog to edit an existing comment
 */
function showEditCommentDialog(comment) {
    const existingDialog = document.getElementById('comment-dialog');
    if (existingDialog) existingDialog.remove();

    const dialog = document.createElement('div');
    dialog.id = 'comment-dialog';
    dialog.className = 'comment-dialog';
    dialog.innerHTML = `
        <div class="comment-dialog-content">
            <div class="comment-dialog-header">Edit Comment</div>
            <textarea class="comment-input" rows="3">${escapeHtml(comment.text)}</textarea>
            <div class="comment-dialog-buttons">
                <button class="comment-btn comment-btn-cancel">Cancel</button>
                <button class="comment-btn comment-btn-save">Save</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    const textarea = dialog.querySelector('.comment-input');
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);

    dialog.querySelector('.comment-btn-cancel').onclick = () => dialog.remove();

    dialog.querySelector('.comment-btn-save').onclick = () => {
        const text = textarea.value.trim();
        if (text) {
            window.handler.emit("updateComment", { id: comment.id, text });
        }
        dialog.remove();
    };

    textarea.onkeydown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            dialog.querySelector('.comment-btn-save').click();
        } else if (e.key === 'Escape') {
            dialog.remove();
        }
    };

    dialog.onclick = (e) => {
        if (e.target === dialog) dialog.remove();
    };
}

/**
 * Show delete confirmation dialog
 */
function showDeleteConfirmDialog(commentId) {
    const existingDialog = document.getElementById('comment-dialog');
    if (existingDialog) existingDialog.remove();

    const dialog = document.createElement('div');
    dialog.id = 'comment-dialog';
    dialog.className = 'comment-dialog';
    dialog.innerHTML = `
        <div class="comment-dialog-content">
            <div class="comment-dialog-header">Delete Comment</div>
            <p style="margin: 10px 0;">Are you sure you want to delete this comment?</p>
            <div class="comment-dialog-buttons">
                <button class="comment-btn comment-btn-cancel">Cancel</button>
                <button class="comment-btn comment-btn-delete">Delete</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelector('.comment-btn-cancel').onclick = () => dialog.remove();

    dialog.querySelector('.comment-btn-delete').onclick = () => {
        window.handler.emit("deleteComment", { id: commentId });
        dialog.remove();
    };

    dialog.onclick = (e) => {
        if (e.target === dialog) dialog.remove();
    };
}

/**
 * Initialize comment system
 */
export function initComments() {
    // Request comments from backend
    window.handler.emit("loadComments");

    // Listen for comment updates
    window.handler.on("commentsLoaded", (comments) => {
        currentComments = comments || [];
        renderComments();
    });
}

/**
 * Render comment panel showing all comments
 */
function renderComments() {
    // Remove existing panel
    const existingPanel = document.getElementById('comment-panel');
    if (existingPanel) existingPanel.remove();

    // Update toggle button (including hiding when no comments)
    addCommentPanelToggle();

    if (!currentComments || currentComments.length === 0) return;

    // Create comment panel
    const panel = document.createElement('div');
    panel.id = 'comment-panel';
    panel.className = 'comment-panel';

    const header = document.createElement('div');
    header.className = 'comment-panel-header';
    header.innerHTML = `<span>Comments (${currentComments.length})</span><button class="comment-panel-close">&times;</button>`;
    panel.appendChild(header);

    header.querySelector('.comment-panel-close').onclick = () => {
        panel.classList.add('collapsed');
        const toggle = document.getElementById('comment-panel-toggle');
        if (toggle) toggle.classList.remove('panel-open');
    };

    const list = document.createElement('div');
    list.className = 'comment-panel-list';

    currentComments.forEach(comment => {
        const item = document.createElement('div');
        item.className = 'comment-panel-item';
        const date = new Date(comment.timestamp).toLocaleDateString();
        const selectedTextHtml = comment.selectedText
            ? `<div class="comment-panel-selected">"${escapeHtml(comment.selectedText.substring(0, TEXT_PREVIEW_SHORT_LENGTH))}${comment.selectedText.length > TEXT_PREVIEW_SHORT_LENGTH ? '...' : ''}"</div>`
            : '';
        item.innerHTML = `
            <div class="comment-panel-item-header">
                <span class="comment-panel-date">${date}</span>
            </div>
            ${selectedTextHtml}
            <div class="comment-panel-text">${escapeHtml(comment.text)}</div>
            <div class="comment-panel-actions">
                <button class="comment-panel-edit" title="Edit">Edit</button>
                <button class="comment-panel-delete" title="Delete">Delete</button>
            </div>
        `;

        item.querySelector('.comment-panel-edit').onclick = () => showEditCommentDialog(comment);
        item.querySelector('.comment-panel-delete').onclick = () => showDeleteConfirmDialog(comment.id);

        list.appendChild(item);
    });

    panel.appendChild(list);
    document.body.appendChild(panel);

    // Add toggle button to toolbar area if not exists
    addCommentPanelToggle();
}

/**
 * Add a toggle button near the toolbar to show/hide comment panel
 */
function addCommentPanelToggle() {
    let toggle = document.getElementById('comment-panel-toggle');

    if (!toggle) {
        toggle = document.createElement('div');
        toggle.id = 'comment-panel-toggle';
        toggle.className = 'comment-panel-toggle';
        toggle.title = 'Toggle Comments Panel';
        toggle.onclick = () => {
            const panel = document.getElementById('comment-panel');
            if (panel) {
                const isCollapsed = panel.classList.toggle('collapsed');
                toggle.classList.toggle('panel-open', !isCollapsed);
            }
        };
        document.body.appendChild(toggle);
    }

    // Always update the count
    toggle.innerHTML = `💬 <span id="comment-count">${currentComments.length}</span>`;
    toggle.style.display = currentComments.length > 0 ? 'flex' : 'none';

    // Update position based on panel state
    const panel = document.getElementById('comment-panel');
    const isPanelOpen = panel && !panel.classList.contains('collapsed');
    toggle.classList.toggle('panel-open', isPanelOpen);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// Search/Find Functionality
// ============================================

let searchState = {
    isOpen: false,
    query: '',
    matches: [],
    currentIndex: -1,
    originalNodes: []
};

/**
 * Show the search dialog
 */
export function showSearchDialog() {
    if (searchState.isOpen) {
        const input = document.querySelector('.search-input');
        if (input) {
            input.focus();
            input.select();
        }
        return;
    }

    searchState.isOpen = true;

    const dialog = document.createElement('div');
    dialog.id = 'search-dialog';
    dialog.className = 'search-dialog';
    dialog.innerHTML = `
        <div class="search-input-container">
            <input type="text" class="search-input" placeholder="Find in document..." value="${escapeHtml(searchState.query)}" />
            <span class="search-count">0/0</span>
        </div>
        <div class="search-buttons">
            <button class="search-btn search-prev" title="Previous (Shift+Enter)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
            </button>
            <button class="search-btn search-next" title="Next (Enter)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>
        </div>
        <button class="search-close" title="Close (Escape)">&times;</button>
    `;

    document.body.appendChild(dialog);

    const input = dialog.querySelector('.search-input');
    const prevBtn = dialog.querySelector('.search-prev');
    const nextBtn = dialog.querySelector('.search-next');
    const closeBtn = dialog.querySelector('.search-close');

    input.focus();
    if (searchState.query) {
        input.select();
        performSearch(searchState.query);
    }

    // Input handler with debounce
    let searchTimeout;
    input.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performSearch(e.target.value);
        }, SEARCH_DEBOUNCE_MS);
    });

    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) {
                navigateSearch(-1);
            } else {
                navigateSearch(1);
            }
        } else if (e.key === 'Escape') {
            closeSearchDialog();
        }
    });

    prevBtn.addEventListener('click', () => navigateSearch(-1));
    nextBtn.addEventListener('click', () => navigateSearch(1));
    closeBtn.addEventListener('click', closeSearchDialog);

    // Register cleanup
    cleanupFunctions.push(closeSearchDialog);
}

/**
 * Close the search dialog and clear highlights
 */
export function closeSearchDialog() {
    const dialog = document.getElementById('search-dialog');
    if (dialog) {
        dialog.remove();
    }
    searchState.isOpen = false;
    clearSearchHighlights();
}

/**
 * Perform search in the editor content
 */
function performSearch(query) {
    searchState.query = query;
    clearSearchHighlights();

    if (!query || query.length === 0) {
        updateSearchCount(0, 0);
        return;
    }

    const editorContent = document.querySelector('.vditor-wysiwyg') || document.querySelector('.vditor-ir');
    if (!editorContent) return;

    // Find all text nodes in the editor
    const walker = document.createTreeWalker(
        editorContent,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                // Skip hidden elements and script/style
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                const tagName = parent.tagName.toLowerCase();
                if (tagName === 'script' || tagName === 'style') {
                    return NodeFilter.FILTER_REJECT;
                }
                // Skip if parent is hidden
                const style = window.getComputedStyle(parent);
                if (style.display === 'none' || style.visibility === 'hidden') {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    const matches = [];
    const queryLower = query.toLowerCase();
    let node;

    while (node = walker.nextNode()) {
        const text = node.textContent;
        const textLower = text.toLowerCase();
        let startIndex = 0;
        let index;

        while ((index = textLower.indexOf(queryLower, startIndex)) !== -1) {
            matches.push({
                node: node,
                startOffset: index,
                endOffset: index + query.length
            });
            startIndex = index + 1;
        }
    }

    searchState.matches = matches;
    searchState.currentIndex = matches.length > 0 ? 0 : -1;

    // Highlight all matches
    highlightMatches();
    updateSearchCount(searchState.currentIndex + 1, matches.length);

    // Navigate to first match
    if (matches.length > 0) {
        scrollToCurrentMatch();
    }
}

/**
 * Highlight all search matches
 */
function highlightMatches() {
    // We need to be careful not to break the DOM structure
    // Use a more conservative approach: just add visual highlights via CSS
    const matches = searchState.matches;
    if (matches.length === 0) return;

    // Group matches by node (in reverse order to preserve offsets)
    const nodeMatches = new Map();
    matches.forEach((match, index) => {
        if (!nodeMatches.has(match.node)) {
            nodeMatches.set(match.node, []);
        }
        nodeMatches.get(match.node).push({ ...match, index });
    });

    // Process each node's matches (in reverse order within each node)
    nodeMatches.forEach((nodeMatchList, textNode) => {
        // Sort in reverse order by startOffset to process from end to start
        nodeMatchList.sort((a, b) => b.startOffset - a.startOffset);

        let parent = textNode.parentNode;
        if (!parent) return;

        for (const match of nodeMatchList) {
            try {
                const range = document.createRange();
                range.setStart(textNode, match.startOffset);
                range.setEnd(textNode, match.endOffset);

                const span = document.createElement('span');
                span.className = 'search-highlight';
                span.dataset.searchIndex = match.index;

                if (match.index === searchState.currentIndex) {
                    span.classList.add('current');
                }

                range.surroundContents(span);
            } catch {
                // If surroundContents fails (e.g., across element boundaries), skip this match
                console.debug('Could not highlight match at offset', match.startOffset);
            }
        }
    });
}

/**
 * Clear all search highlights
 */
function clearSearchHighlights() {
    const highlights = document.querySelectorAll('.search-highlight');
    highlights.forEach(span => {
        const parent = span.parentNode;
        if (parent) {
            // Replace the span with its text content
            const text = document.createTextNode(span.textContent);
            parent.replaceChild(text, span);
            // Normalize to merge adjacent text nodes
            parent.normalize();
        }
    });
    searchState.matches = [];
    searchState.currentIndex = -1;
}

/**
 * Navigate to next or previous match
 */
function navigateSearch(direction) {
    if (searchState.matches.length === 0) return;

    // Update current index
    searchState.currentIndex += direction;
    if (searchState.currentIndex >= searchState.matches.length) {
        searchState.currentIndex = 0;
    } else if (searchState.currentIndex < 0) {
        searchState.currentIndex = searchState.matches.length - 1;
    }

    // Update highlight classes
    const highlights = document.querySelectorAll('.search-highlight');
    highlights.forEach(span => {
        const index = parseInt(span.dataset.searchIndex, 10);
        if (index === searchState.currentIndex) {
            span.classList.add('current');
        } else {
            span.classList.remove('current');
        }
    });

    updateSearchCount(searchState.currentIndex + 1, searchState.matches.length);
    scrollToCurrentMatch();
}

/**
 * Scroll to the current match
 */
function scrollToCurrentMatch() {
    const currentHighlight = document.querySelector('.search-highlight.current');
    if (currentHighlight) {
        currentHighlight.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }
}

/**
 * Update the search count display
 */
function updateSearchCount(current, total) {
    const countEl = document.querySelector('.search-count');
    if (countEl) {
        countEl.textContent = total > 0 ? `${current}/${total}` : 'No results';
    }

    // Update button states
    const prevBtn = document.querySelector('.search-prev');
    const nextBtn = document.querySelector('.search-next');
    if (prevBtn) prevBtn.disabled = total === 0;
    if (nextBtn) nextBtn.disabled = total === 0;
}

/**
 * Initialize search keyboard shortcut (Ctrl/Cmd+F)
 */
export function initSearch() {
    const searchKeyHandler = (e) => {
        // Ctrl+F or Cmd+F
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            e.stopPropagation();
            showSearchDialog();
        }
        // Close search on Escape (when search is open but input not focused)
        if (e.key === 'Escape' && searchState.isOpen) {
            const input = document.querySelector('.search-input');
            if (document.activeElement !== input) {
                closeSearchDialog();
            }
        }
    };

    // Use capture phase to intercept before other handlers
    window.addEventListener('keydown', searchKeyHandler, true);

    cleanupFunctions.push(() => {
        window.removeEventListener('keydown', searchKeyHandler, true);
        closeSearchDialog();
    });
}

// ============================================
// Code Block Copy Functionality
// ============================================

/**
 * Add copy button to a code block
 */
function addCopyButtonToCodeBlock(preElement) {
    // Skip if already has a copy button
    if (preElement.querySelector('.code-block-copy-btn')) {
        return;
    }

    // Create copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'code-block-copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.type = 'button';
    copyBtn.contentEditable = 'false';

    copyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Get code content from the pre element, excluding the button text
        const codeElement = preElement.querySelector('code') || preElement;
        let codeText = '';
        for (const node of codeElement.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                codeText += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('code-block-copy-btn')) {
                codeText += node.textContent;
            }
        }

        try {
            await navigator.clipboard.writeText(codeText);
            copyBtn.textContent = 'Copied!';
            copyBtn.classList.add('copied');

            setTimeout(() => {
                copyBtn.textContent = 'Copy';
                copyBtn.classList.remove('copied');
            }, 2000);
        } catch (err) {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = codeText;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);

            copyBtn.textContent = 'Copied!';
            copyBtn.classList.add('copied');

            setTimeout(() => {
                copyBtn.textContent = 'Copy';
                copyBtn.classList.remove('copied');
            }, 2000);
        }
    });

    // Append button inside the pre element
    preElement.appendChild(copyBtn);
}

/**
 * Process all code blocks in the document
 */
function processCodeBlocks() {
    const editorContent = document.querySelector('.vditor-wysiwyg') || document.querySelector('.vditor-ir');
    if (!editorContent) return;

    // Find code blocks - in WYSIWYG mode they're wrapped in div.vditor-wysiwyg__block
    // The preview pre inside these blocks contains the rendered code
    const codeBlocks = editorContent.querySelectorAll('.vditor-wysiwyg__block .vditor-wysiwyg__preview');
    codeBlocks.forEach(addCopyButtonToCodeBlock);
}

/**
 * Initialize code block copy functionality
 */
export function initCodeBlockCopy() {
    // Process existing code blocks
    processCodeBlocks();

    // Watch for new code blocks being added
    const editorContent = document.querySelector('.vditor-wysiwyg') || document.querySelector('.vditor-ir');
    if (!editorContent) return;

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;

                // Check if the added node is a code block preview
                if (node.matches?.('.vditor-wysiwyg__preview')) {
                    addCopyButtonToCodeBlock(node);
                }

                // Check for code blocks within the added node
                if (node.querySelectorAll) {
                    const codeBlocks = node.querySelectorAll('.vditor-wysiwyg__block .vditor-wysiwyg__preview');
                    codeBlocks.forEach(addCopyButtonToCodeBlock);
                }
            }
        }
    });

    observer.observe(editorContent, {
        childList: true,
        subtree: true
    });

    cleanupFunctions.push(() => {
        observer.disconnect();
    });
}