import ReactDOM from 'react-dom/client';
import './util/vscode.js';
import './main.css'
import { ConfigProvider } from 'antd';
import { antThemeConfig } from './antThemeConfig.ts';

document.getElementById('_defaultStyles')?.parentNode?.removeChild(document.getElementById('_defaultStyles'))
ReactDOM.createRoot(document.getElementById('root')).render(
  <ConfigProvider
    componentSize='small'
    theme={antThemeConfig}
  >
    <>Markdown Editor</>
  </ConfigProvider>
)
