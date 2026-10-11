/* Render mermaid fences as <div class="mermaid"> */
/*
Replaces the markdown-it-mermaid package, which validated diagrams with a
bundled mermaid 7 and turned newer diagram types (flowchart, pie, erDiagram,
stateDiagram, ...) into parse errors. Validation and rendering are left to the
mermaid runtime that markdown-pdf.js injects into the exported page.
*/

/*jslint node: true */
'use strict';

// Untagged fences whose first line starts a diagram (markdown-it-mermaid compat)
var DIAGRAM_START = /^(gantt|sequenceDiagram|graph (TB|BT|RL|LR|TD);?)$/;

module.exports = function mermaid_plugin(md) {
    var defaultFence = md.renderer.rules.fence;

    md.renderer.rules.fence = function (tokens, idx, options, env, self) {
        var token = tokens[idx];
        var lang = token.info.trim().split(/\s+/)[0];
        var content = token.content.trim();

        if (lang === 'mermaid' || (!lang && DIAGRAM_START.test(content.split('\n')[0].trim()))) {
            return '<div class="mermaid">' + md.utils.escapeHtml(content) + '</div>\n';
        }
        return defaultFence(tokens, idx, options, env, self);
    };
};
