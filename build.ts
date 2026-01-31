const { build, context } = require("esbuild")
const { resolve } = require("path")
const { existsSync } = require("fs")
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
                setup(build) {
                    build.onStart(() => {
                        console.log('build start')
                    })
                    build.onEnd(() => {
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
    }, {})
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
