const fs = require("fs")
const os = require("os")
const path = require("path")
const URI = require("vscode").Uri
const { createOutline } = require("./outline")
const isDev = process.argv.indexOf('--type=extensionHost') >= 0;

export async function exportHtml(exportFilePath, data) {
    console.log("[pretty-md-pdf] Exported to file: " + exportFilePath)
    fs.writeFileSync(exportFilePath, data, "utf-8")
}

export async function exportDocx(exportFilePath, data) {
    console.log("[pretty-md-pdf] Exported to file: " + exportFilePath)
    const exportTask = await require("vscode-html-to-docx")(data, '', {}, '');
    const buffer = Buffer.from(await exportTask.arrayBuffer());
    fs.writeFileSync(exportFilePath, buffer)
}

/*
 * export a html to a pdf file
 */
export async function exportByType(filePath, data, type, config) {

    console.log("[pretty-md-pdf] Exporting (" + type + ") ...")
    const originPath = path.parse(filePath)
    let targetFilePath = originPath.dir + "/" + originPath.name + "." + type

    // export html
    if (type == "html") {
        exportHtml(targetFilePath, data)
        return
    } else if (type == "docx") {
        return exportDocx(targetFilePath, data)
    }

    let tmpfilename = path.join(isDev ? originPath.dir : os.tmpdir(), originPath.name + "_tmp.html")
    exportHtml(tmpfilename, data)
    let options = {
        executablePath: config["executablePath"] || undefined
    }

    // Errors propagate to MarkdownService.exportMarkdown, which reports them
    const puppeteer = require("puppeteer-core")
    const browser = await puppeteer.launch(options)
    try {
        const page = await browser.newPage()
        await page.goto(URI.file(tmpfilename).toString(), { waitUntil: "networkidle0" })
        await waitForMermaid(page)

        // generate pdf
        if (type == "pdf") {
            // https://pptr.dev/api/puppeteer.pdfoptions
            const options = {
                format: config["format"] || "A4",
                printBackground: config["printBackground"] ?? true,
                margin: {
                    top: config["margin"]["top"],
                    right: config["margin"]["right"],
                    bottom: config["margin"]["bottom"],
                    left: config["margin"]["left"]
                }
            }
            const pdf = await page.pdf(options)

            const pdfBytes = await createOutline(pdf, data)
            fs.writeFileSync(targetFilePath, pdfBytes)
        }
    } finally {
        await browser.close()

        // delete temporary file
        let debug = config["debug"] || false
        if (!debug) {
            if (isExistsPath(tmpfilename)) {
                fs.unlink(tmpfilename, () => { })
            }
        }
    }

    console.log("[pretty-md-pdf] Exported to file: " + targetFilePath)

}

/*
 * mermaid renders asynchronously after load, so networkidle0 alone can print
 * empty diagrams. Gives up after a timeout (e.g. offline, CDN unreachable).
 */
async function waitForMermaid(page) {
    await page.waitForFunction(
        () => !window.mermaid || Array.from(document.querySelectorAll(".mermaid")).every(el => el.querySelector("svg")),
        { timeout: 15000 }
    ).catch(() => {
        console.warn("[pretty-md-pdf] Timed out waiting for mermaid diagrams to render")
    })
}

function isExistsPath(path) {
    if (path.length === 0) {
        return false
    }
    try {
        fs.accessSync(path)
        return true
    } catch (error) {
        console.warn(error.message)
        return false
    }
}