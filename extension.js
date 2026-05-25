const vscode = require('vscode');
const { CDPClient } = require('./cdp');
const { getWebviewContent } = require('./webview');

let cdpClient = null;
let isEnabled = false;

const DEFAULT_CONFIG = {
    safe: { timeout: 0, list: ["ls", "git status", "dir", "echo", "pwd", "npm run build"] },
    medium: { timeout: 3000, list: ["npm install", "yarn add", "git push", "git commit", "pip install"] },
    high: { timeout: -1, list: ["/rm\\s+.*-.*r/", "drop", "del", "format", "rmdir", "dd if=", "mkfs.", "chmod -R 777", ":(){:|:&};:", "> /dev/sda"] } // -1 means ignore completely
};

let activePanels = new Set();
let statusBarItem = null;

function updateStatusBar() {
    if (!statusBarItem) return;
    if (isEnabled) {
        statusBarItem.text = `$(check-all) SAC: ON`;
        statusBarItem.tooltip = "Smart Auto Accept is ON. Click to toggle.";
    } else {
        statusBarItem.text = `$(circle-slash) SAC: OFF`;
        statusBarItem.tooltip = "Smart Auto Accept is OFF. Click to toggle.";
    }
}

function activate(context) {
    let config = context.globalState.get('smartAutoAcceptConfig', DEFAULT_CONFIG);
    isEnabled = context.globalState.get('smartAutoAcceptEnabled', true);

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'smartAutoAccept.toggle';
    updateStatusBar();
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    let toggleCmd = vscode.commands.registerCommand('smartAutoAccept.toggle', () => {
        isEnabled = !isEnabled;
        context.globalState.update('smartAutoAcceptEnabled', isEnabled);
        vscode.window.showInformationMessage(`Smart Auto Accept is now ${isEnabled ? 'ON' : 'OFF'}`);
        if (isEnabled && !cdpClient) {
            startCDP(config);
        } else if (!isEnabled && cdpClient) {
            cdpClient.stop();
            cdpClient = null;
        }

        updateStatusBar();

        // Notify active settings panels of status change
        activePanels.forEach(panel => {
            panel.webview.postMessage({ command: 'statusChanged', enabled: isEnabled });
        });
    });

    let settingsCmd = vscode.commands.registerCommand('smartAutoAccept.openSettings', () => {
        const panel = vscode.window.createWebviewPanel(
            'smartAutoAcceptSettings',
            'Smart Auto Accept Settings',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        activePanels.add(panel);
        panel.onDidDispose(() => {
            activePanels.delete(panel);
        });

        panel.webview.html = getWebviewContent(config, isEnabled);

        panel.webview.onDidReceiveMessage(message => {
            if (message.command === 'saveConfig') {
                config = message.config;
                context.globalState.update('smartAutoAcceptConfig', config);
                vscode.window.showInformationMessage('✅ Cấu hình Smart Auto Accept đã được lưu!');
                if (cdpClient) cdpClient.updateConfig(config);
            } else if (message.command === 'toggleStatus') {
                isEnabled = message.enabled;
                context.globalState.update('smartAutoAcceptEnabled', isEnabled);
                vscode.window.showInformationMessage(`Smart Auto Accept is now ${isEnabled ? 'ON' : 'OFF'}`);
                if (isEnabled && !cdpClient) {
                    startCDP(config);
                } else if (!isEnabled && cdpClient) {
                    cdpClient.stop();
                    cdpClient = null;
                }

                updateStatusBar();

                // Notify other active settings panels (if any)
                activePanels.forEach(p => {
                    if (p !== panel) {
                        p.webview.postMessage({ command: 'statusChanged', enabled: isEnabled });
                    }
                });
            } else if (message.command === 'exportConfig') {
                vscode.env.clipboard.writeText(JSON.stringify(message.config, null, 2)).then(() => {
                    vscode.window.showInformationMessage('📤 Đã copy cấu hình (JSON) vào Clipboard!');
                });
            } else if (message.command === 'importConfig') {
                vscode.env.clipboard.readText().then(text => {
                    try {
                        const newConfig = JSON.parse(text);
                        if (newConfig.safe && newConfig.medium && newConfig.high) {
                            config = newConfig;
                            context.globalState.update('smartAutoAcceptConfig', config);
                            if (cdpClient) cdpClient.updateConfig(config);
                            vscode.window.showInformationMessage('📥 Đã nạp cấu hình từ Clipboard thành công!');
                            // Refresh all panels
                            activePanels.forEach(p => p.webview.html = getWebviewContent(config, isEnabled));
                        } else {
                            vscode.window.showErrorMessage('❌ JSON cấu hình không đúng định dạng của Smart Auto Accept!');
                        }
                    } catch(e) {
                        vscode.window.showErrorMessage('❌ Nội dung trong Clipboard không phải là chuỗi JSON hợp lệ!');
                    }
                });
            }
        });
    });

    context.subscriptions.push(toggleCmd, settingsCmd);

    // Khởi động CDP nếu đang được kích hoạt
    if (isEnabled) {
        startCDP(config);
    }

    vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('smartAutoAccept.cdpPort') && isEnabled) {
            startCDP(config);
        }
    });
}

function startCDP(config) {
    if (cdpClient) cdpClient.stop();
    const port = vscode.workspace.getConfiguration('smartAutoAccept').get('cdpPort', 9000);
    cdpClient = new CDPClient(config, port);
    cdpClient.start();
}

function deactivate() {
    if (cdpClient) {
        cdpClient.stop();
    }
}

module.exports = { activate, deactivate };

