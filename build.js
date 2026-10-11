const { build, context } = require("esbuild")
const { resolve } = require("path")
const { cpSync, existsSync, mkdirSync } = require("fs")
const isProd = process.argv.indexOf('--mode=production') >= 0;

const dependencies = ['vscode-html-to-docx', 'highlight.js', 'pdf-lib', 'cheerio', 'katex', 'mustache', 'puppeteer-core']

/**
 * Copy files the extension reads from out/ at runtime: PDF templates and
 * styles, the sql.js WASM file, and KaTeX's stylesheet and fonts for export
 */
function copyAssets() {
    cpSync('template', 'out', { recursive: true })
    cpSync('node_modules/sql.js/dist/sql-wasm.wasm', 'out/sql-wasm.wasm')
    mkdirSync('out/katex/fonts', { recursive: true })
    cpSync('node_modules/katex/dist/katex.min.css', 'out/katex/katex.min.css')
    // woff2 is enough for Chromium, which renders PDF exports
    cpSync('node_modules/katex/dist/fonts', 'out/katex/fonts', { recursive: true, filter: src => !/\.(ttf|woff)$/.test(src) })
}

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
            {
                name: 'build notice',
                setup(build) {
                    build.onStart(() => {
                        console.log('build start')
                    })
                    build.onEnd(result => {
                        if (result.errors.length === 0) copyAssets()
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
    return build({
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

// Exit non-zero on failure (esbuild has already printed the errors)
Promise.all([createLib(), main()]).catch(() => process.exit(1));
