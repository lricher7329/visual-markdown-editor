import { openLink, hotKeys, imageParser, getToolbar, autoSymbol, onToolbarClick, createContextMenu, scrollEditor, cleanup, initComments, initZoomControls, initSearch, initCodeBlockCopy } from "./util.js";

let state;
function loadConfigs() {
  const elem = document.getElementById('configs');
  const defaultState = { platform: 'unknown' };

  if (!elem) {
    console.warn('Config element not found, using defaults');
    state = defaultState;
    return state;
  }

  try {
    state = JSON.parse(elem.getAttribute('data-config')) || defaultState;
    const { platform } = state;
    const vditorEl = document.getElementById('vditor');
    if (vditorEl && platform) {
      vditorEl.classList.add(platform);
    }
  } catch (error) {
    console.error('Failed to load config:', error);
    state = defaultState;
  }
  return state;
}
loadConfigs()

// Cleanup when editor is disposed
handler.on("dispose", () => {
  cleanup();
});

handler.on("open", async (md) => {
  const { config } = md;
  addAutoTheme(md.rootPath, config.editorTheme)
  handler.on('theme', theme => {
    loadTheme(md.rootPath, theme)
  })
  const editor = new Vditor('vditor', {
    value: md.content,
    _lutePath: md.rootPath + '/lute.min.js',
    cdn: 'https://unpkg.com/vscode-vditor@3.11.2',
    height: document.documentElement.clientHeight,
    outline: {
      enable: config.openOutline,
      position: 'left',
    },
    toolbarConfig: {
      hide: config.hideToolbar
    },
    cache: {
      enable: false,
    },
    mode: 'wysiwyg',
    lang: config.editorLanguage,
    icon: "material",
    tab: '\t',
    preview: {
      theme: {
        path: `${md.rootPath}/css/content-theme`
      },
      markdown: {
        toc: true,
        codeBlockPreview: config.previewCode,
      },
      hljs: {
        style: config.previewCodeHighlight.style,
        lineNumber: config.previewCodeHighlight.showLineNumber
      },
      extPath: md.rootPath,
      math: {
        engine: 'KaTeX',
        "inlineDigit": true
      }
    },
    toolbar: await getToolbar(md.rootPath),
    extPath: md.rootPath,
    input(content) {
      handler.emit("save", content)
    },
    upload: {
      url: '/image',
      accept: 'image/*',
      handler(files) {
        let reader = new FileReader();
        reader.readAsBinaryString(files[0]);
        reader.onloadend = () => {
          handler.emit("img", reader.result)
        };
      }
    },
    hint: {
      emoji: {},
      extend: hotKeys
    }, after() {
      handler.on("update", content => {
        editor.setValue(content);
      })
      handler.on("insertMarkdown", markdown => {
        // Insert markdown at cursor position
        editor.insertValue(markdown);
      })
      openLink()
      onToolbarClick(editor)
      initComments(handler)
      initCodeBlockCopy()
    }
  })
  autoSymbol(handler, editor, config);
  createContextMenu(editor)
  imageParser(config.viewAbsoluteLocal)
  scrollEditor(md.scrollTop)
  initZoomControls()
  initSearch()
}).emit("init")


function addAutoTheme(rootPath, theme) {
  loadCSS(rootPath, 'base.css')
  loadTheme(rootPath, theme)
}

function loadTheme(rootPath, theme) {
  loadCSS(rootPath, `theme/${theme}.css`)
  document.getElementById('vditor').setAttribute('data-editor-theme', theme)
}

function loadCSS(rootPath, path) {
  const style = document.createElement('link');
  style.rel = "stylesheet";
  style.type = "text/css";
  style.href = `${rootPath}/css/${path}`;
  document.documentElement.appendChild(style)
}