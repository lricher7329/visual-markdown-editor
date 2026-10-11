import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

// The export plugins are CommonJS modules
const load = createRequire(__filename);
const MarkdownIt = load('markdown-it');
const markdownItMermaid = load('../service/markdown/ext/markdown-it-mermaid.js');

const render = (markdown: string) => new MarkdownIt().use(markdownItMermaid).render(markdown);

describe('markdown-it-mermaid', () => {
    it('should pass newer diagram types through for mermaid to render', () => {
        for (const diagram of ['flowchart LR\n  A --> B', 'pie title Pets\n  "Dogs" : 3', 'erDiagram\n  A ||--o{ B : has']) {
            expect(render('```mermaid\n' + diagram + '\n```\n')).toMatch(/^<div class="mermaid">/);
        }
    });

    it('should escape diagram source', () => {
        expect(render('```mermaid\ngraph LR\n  A["<b>x</b>"] --> B\n```\n'))
            .toBe('<div class="mermaid">graph LR\n  A[&quot;&lt;b&gt;x&lt;/b&gt;&quot;] --&gt; B</div>\n');
    });

    it('should detect untagged diagrams but leave other code blocks alone', () => {
        expect(render('```\nsequenceDiagram\n  A->>B: hi\n```\n')).toMatch(/^<div class="mermaid">/);
        expect(render('```js\nconst a = 1;\n```\n')).toMatch(/^<pre><code class="language-js">/);
    });
});
