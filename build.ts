const { build, context } = require("esbuild")
const { resolve } = require("path")
const { existsSync, readFileSync, writeFileSync } = require("fs")
const { copy } = require("esbuild-plugin-copy")
const isProd = process.argv.indexOf('--mode=production') >= 0;

const dependencies = ['vscode-html-to-docx', 'highlight.js', 'pdf-lib', 'cheerio', 'katex', 'mustache', 'puppeteer-core']

async function main() {
    const options = {
        entryPoints: ['./src/extension.ts'],
        bundle: true,
        outfile: "out/extension.js",
        external: ['vscode', ...dependencies],
        format: 'cjs',
        platform: 'node',
        metafile: true,
        minify: isProd,
        sourcemap: !isProd,
        logOverride: {
            'duplicate-object-key': "silent",
            'suspicious-boolean-not': "silent",
        },
        plugins: [
            // Copy template files for PDF generation
            copy({
                resolveFrom: 'out',
                assets: {
                    from: ['./template/**/*'],
                    to: ['./'],
                    keepStructure: true
                },
            }),
            // Copy sql.js WASM file for Zotero integration
            copy({
                resolveFrom: 'out',
                assets: {
                    from: ['./node_modules/sql.js/dist/sql-wasm.wasm'],
                    to: ['./'],
                },
            }),
            {
                name: 'build notice',
                setup(build: any) {
                    build.onStart(() => {
                        console.log('build start')
                    })
                    build.onEnd(() => {
                        // Strip "use strict" from output to avoid breaking legacy
                        // dependencies (d3 v3 via mermaid) that use `this.document`
                        // in IIFEs — strict mode makes `this` undefined in such contexts
                        const outPath = resolve("out/extension.js")
                        if (existsSync(outPath)) {
                            const content = readFileSync(outPath, 'utf8')
                            if (content.startsWith('"use strict";')) {
                                writeFileSync(outPath, content.replace(/^"use strict";/, ''))
                            }
                        }
                        console.log('build success')
                    })
                }
            },
        ],
    }

    if (isProd) {
        await build(options)
    } else {
        const ctx = await context(options)
        await ctx.watch()
    }
}

function createLib() {
    const points = dependencies.reduce((point, dependency) => {
        const main = require(`./node_modules/${dependency}/package.json`).main ?? "index.js";
        const mainAbsPath = resolve(`./node_modules/${dependency}`, main);
        if (existsSync(mainAbsPath)) {
            point[dependency] = mainAbsPath;
        }
        return point;
    }, {} as Record<string, string>)
    build({
        entryPoints: points,
        bundle: true,
        outdir: "out/node_modules",
        format: 'cjs',
        platform: 'node',
        minify: true,
        treeShaking: true,
        metafile: true
    })
}

createLib();
main();
