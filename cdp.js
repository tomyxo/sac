const WebSocket = require('ws');
const vscode = require('vscode');
const http = require('http');

class CDPClient {
    constructor(config, port = 9000) {
        this.config = config;
        this.port = port;
        this.ws = null;
        this.messageId = 1;
        this.callbacks = new Map();
        this.isRunning = false;
        this.pollInterval = null;
        this.pendingClicks = new Set();
        this.hasShownWarning = false;
    }

    updateConfig(config) {
        this.config = config;
    }

    async start() {
        this.isRunning = true;
        this._attemptConnect();
    }

    _attemptConnect() {
        if (!this.isRunning) return;
        try {
            http.get(`http://127.0.0.1:${this.port}/json`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const targets = JSON.parse(data);
                        const page = targets.find(t => t.type === 'page' && t.url.includes('workbench.html'));
                        if (page && page.webSocketDebuggerUrl) {
                            this.hasShownWarning = false;
                            this.connect(page.webSocketDebuggerUrl);
                        } else {
                            if (!this.hasShownWarning) {
                                vscode.window.showErrorMessage(`SAC: Không tìm thấy trang UI của Antigravity qua CDP (port ${this.port}).`);
                                this.hasShownWarning = true;
                            }
                            if (this.isRunning) setTimeout(() => this._attemptConnect(), 3000);
                        }
                    } catch (e) {
                        console.error('Parse CDP error', e);
                        if (this.isRunning) setTimeout(() => this._attemptConnect(), 3000);
                    }
                });
            }).on('error', (e) => {
                console.error('CDP connect error', e);
                if (!this.hasShownWarning) {
                    vscode.window.showWarningMessage(
                        `⚠️ CAUTION: Hãy tự thêm tham số --remote-debugging-port=${this.port} vào đuôi mục Target của Shortcut Antigravity, tắt ứng dụng và mở lại bằng biểu tượng đó.`,
                        'Đã hiểu'
                    );
                    this.hasShownWarning = true;
                }
                if (this.isRunning) setTimeout(() => this._attemptConnect(), 3000);
            });
        } catch (e) {
            console.error(e);
            if (this.isRunning) setTimeout(() => this._attemptConnect(), 3000);
        }
    }

    connect(wsUrl) {
        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
            console.log('Connected to CDP');
            vscode.window.showInformationMessage('SAC: Đã kết nối CDP thành công!');
            this.startPolling();
        });

        this.ws.on('message', (data) => {
            const msg = JSON.parse(data);
            if (msg.id && this.callbacks.has(msg.id)) {
                this.callbacks.get(msg.id)(msg.result);
                this.callbacks.delete(msg.id);
            }
        });

        this.ws.on('close', () => {
            this.stopInternal();
            if (this.isRunning) {
                console.log('Kết nối CDP thất bại, đang thử kết nối lại...');
                setTimeout(() => this._attemptConnect(), 3000);
            }
        });
    }

    sendCommand(method, params = {}) {
        return new Promise((resolve) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return resolve(null);
            const id = this.messageId++;
            this.callbacks.set(id, resolve);
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }

    startPolling() {
        console.log("[SAC Node] Bắt đầu vòng lặp quét startPolling...");
        this.pollInterval = setInterval(async () => {
            if (!this.isRunning) return;

            // Lấy toàn bộ cây DOM
            const doc = await this.sendCommand('DOM.getDocument', { depth: -1 });
            if (!doc || !doc.root) {
                console.log("[SAC Node] Cảnh báo: DOM.getDocument trả về rỗng!");
                return;
            }

            // Đoạn mã Evaluate js trực tiếp trên trình duyệt để quét các nút và phân tích ngữ cảnh
            const expr = `
                (() => {
                    const selectors = ['.bg-ide-button-background', 'button.cursor-pointer', 'button'];
                    let buttons = [];
                    
                    const docs = [];
                    const scanFrames = (d) => {
                        try {
                            docs.push(d);
                            d.querySelectorAll('iframe').forEach(f => {
                                try {
                                    if (f.contentDocument) {
                                        scanFrames(f.contentDocument);
                                    }
                                } catch(e) {}
                            });
                        } catch(e) {}
                    };
                    scanFrames(document);

                    docs.forEach(doc => {
                        selectors.forEach(sel => {
                            buttons.push(...Array.from(doc.querySelectorAll(sel + ':not(.pending)')));
                        });
                    });

                    // Từ khóa chấp thuận và từ chối
                    const acceptPatterns = ['accept', 'run', 'retry', 'apply', 'execute', 'confirm', 'always allow', 'allow once', 'allow', 'approve', 'proceed', 'yes', 'agree'];
                    const rejectPatterns = ['skip', 'reject', 'cancel', 'close', 'refine'];
                    
                    // Từ khóa kỹ thuật chính xác của Tool Card (KHÔNG dùng từ chung chung)
                    const toolKeywords = ['run_command', 'write_to_file', 'replace_file_content', 'multi_replace_file_content', 'view_file', 'grep_search', 'list_dir', 'running command', 'editing file', 'writing file', 'propose a command', 'reading file', 'command execution', 'file edit', 'generate_image', 'browser_subagent', 'read_url_content', 'send_command_input'];
                    
                    const validButtons = [];
                    buttons.forEach(btn => {
                        const text = (btn.textContent || '').trim().toLowerCase();
                        if (!text || text.length > 50) return;
                        
                        // Log mọi nút bấm quét thấy
                        console.log("[SAC Scan] Found button candidates:", text);
                        
                        if (rejectPatterns.some(p => text.includes(p))) {
                            console.log("[SAC Scan] Rejected button (contains reject pattern):", text);
                            return;
                        }
                        if (!acceptPatterns.some(p => text.includes(p))) {
                            console.log("[SAC Scan] Rejected button (no accept pattern):", text);
                            return;
                        }
                        
                        // === LUỒNG 1: Nút "Accept all" ở thanh footer panel chat ===
                        // Nhận diện: text chính xác là "accept all" VÀ nút anh em (sibling) chứa "reject all"
                        if (text === 'accept all') {
                            const parent = btn.parentElement;
                            if (parent) {
                                const siblingText = (parent.innerText || '').toLowerCase();
                                if (siblingText.includes('reject all')) {
                                    console.log("[SAC Scan] Accept All button found! Processing card parent...");
                                    // Trích xuất thông tin file thực tế từ thẻ thay đổi (card parent)
                                    const fileExtPattern = /\\.(js|py|md|json|ts|html|css|bat|ps1|sh|txt|yaml|yml|toml|xml|php|conf)\\b/i;
                                    let card = btn;
                                    let foundCard = null;
                                    for (let i = 0; i < 15 && card; i++) {
                                        card = card.parentElement;
                                        if (!card) break;
                                        const textVal = card.innerText || '';
                                        if (fileExtPattern.test(textVal)) {
                                            foundCard = card;
                                            break;
                                        }
                                    }
                                    if (!foundCard) {
                                        card = btn;
                                        for (let i = 0; i < 15 && card; i++) {
                                            card = card.parentElement;
                                            if (!card) break;
                                            const textVal = (card.innerText || '').toLowerCase();
                                            if (textVal.includes('files modified') || textVal.includes('edited') || textVal.includes('created') || textVal.includes('changes')) {
                                                foundCard = card;
                                                break;
                                            }
                                        }
                                    }
                                    
                                    let fileInfo = '';
                                    if (foundCard) {
                                        const lines = (foundCard.innerText || '').split('\\n');
                                        const cleanLines = [];
                                        const ignorePatterns = [
                                            /accept all/i,
                                            /reject all/i,
                                            /review changes/i,
                                            /file(s)? with changes/i,
                                            /^←/,
                                            /^\\s*$/
                                        ];
                                        lines.forEach(line => {
                                            let l = line.trim();
                                            if (!l) return;
                                            if (ignorePatterns.some(p => p.test(l))) return;
                                            l = l.replace(/reject all|accept all|review changes|file(s)? with changes/gi, '').trim();
                                            if (l) cleanLines.push(l);
                                        });
                                        fileInfo = cleanLines.join(' | ');
                                    }
                                    
                                    if (!fileInfo) {
                                        fileInfo = (parent.parentElement ? (parent.parentElement.innerText || '') : '').replace(/\\s+/g, ' ');
                                    }
                                    
                                    fileInfo = fileInfo.substring(0, 80).trim();
                                    console.log("[SAC Scan] Found file edit: ", fileInfo);
                                    validButtons.push({ btn, toolCard: parent, isAcceptAll: true, fileInfo: fileInfo || 'file changes' });
                                    return;
                                }
                            }
                        }
                        
                        // === LUỒNG 2: Nút trong Tool Card cụ thể (run_command, write_to_file...) ===
                        let toolCard = null;
                        let curr = btn;
                        for (let i = 0; i < 8 && curr; i++) {
                            const txt = (curr.innerText || '').toLowerCase();
                            if (toolKeywords.some(kw => txt.includes(kw))) {
                                toolCard = curr;
                                break;
                            }
                            curr = curr.parentElement;
                        }
                        
                        // CHỈ CHẤP NHẬN nút nằm bên trong một Tool Card thực sự của Agent
                        if (toolCard) {
                            console.log("[SAC Scan] Tool Card button found! Action matched:", text);
                            validButtons.push({ btn, toolCard, isAcceptAll: false });
                        } else {
                            console.log("[SAC Scan] Ignore button (not inside active tool card):", text);
                        }
                    });

                    return validButtons.map(({ btn, toolCard, isAcceptAll, fileInfo }) => {
                        btn.classList.add('pending');
                        
                        // Nếu là nút Accept all ở footer, xếp thẳng vào nhóm file_edit (an toàn)
                        if (isAcceptAll) {
                            const rect = btn.getBoundingClientRect();
                            return { 
                                x: rect.x + (rect.width / 2), 
                                y: rect.y + (rect.height / 2), 
                                toolType: 'file_edit',
                                content: fileInfo
                            };
                        }
                        
                        const cardText = (toolCard.innerText || '').toLowerCase();
                        
                        // Phân biệt chính xác giữa các loại tác vụ
                        let toolType = 'unknown';
                        if (cardText.includes('run_command') || cardText.includes('running command') || cardText.includes('commandline') || cardText.includes('command execution') || cardText.includes('propose a command')) {
                            toolType = 'run_command';
                        } else if (cardText.includes('write_to_file') || cardText.includes('replace_file_content') || cardText.includes('multi_replace_file_content') || cardText.includes('file edit') || cardText.includes('editing file') || cardText.includes('writing file')) {
                            toolType = 'file_edit';
                        } else if (cardText.includes('view_file') || cardText.includes('grep_search') || cardText.includes('list_dir') || cardText.includes('reading file') || cardText.includes('searching')) {
                            toolType = 'file_read';
                        }
                        
                        // Chỉ trích xuất lệnh CMD thực tế nếu đây là tác vụ run_command
                        let extractedContent = '';
                        if (toolType === 'run_command') {
                            const codes = toolCard.querySelectorAll('pre, code, span.mtk1');
                            if (codes.length > 0) {
                                codes.forEach(c => extractedContent += c.textContent + ' ');
                            } else {
                                extractedContent = cardText;
                            }
                        } else {
                            extractedContent = cardText;
                        }
                        
                        extractedContent = extractedContent.replace(/\\s+/g, ' ').trim().toLowerCase();
                        
                        let xOffset = 0;
                        let yOffset = 0;
                        let currentWin = btn.ownerDocument.defaultView;
                        while (currentWin && currentWin !== window) {
                            try {
                                const frame = currentWin.frameElement;
                                if (frame) {
                                    const rect = frame.getBoundingClientRect();
                                    xOffset += rect.left;
                                    yOffset += rect.top;
                                }
                                currentWin = currentWin.parent;
                            } catch(e) {
                                break;
                            }
                        }
                        
                        const rect = btn.getBoundingClientRect();
                        return { 
                            x: rect.x + xOffset + (rect.width / 2), 
                            y: rect.y + yOffset + (rect.height / 2), 
                            toolType: toolType,
                            content: extractedContent
                        };
                    });
                })()
            `;

            const res = await this.sendCommand('Runtime.evaluate', {
                expression: expr,
                returnByValue: true
            });

            if (res && res.exceptionDetails) {
                console.error("[SAC Node] Runtime.evaluate Lỗi Exception:", res.exceptionDetails);
            }

            if (res && res.result && res.result.value) {
                const items = res.result.value;
                if (items.length > 0) {
                    console.log(`[SAC Node] Phát hiện ${items.length} nút bấm phù hợp:`, JSON.stringify(items));
                }
                items.forEach(item => this.processItem(item));
            } else {
                // Không có nút bấm nào được trả về
                // Để tránh log quá nhiều, ta có thể không in hoặc in rất ít
            }

        }, 1500); // Quét mỗi 1.5 giây
    }

    isMatch(content, cmd) {
        if (cmd.startsWith('/') && cmd.length > 2) {
            const lastSlash = cmd.lastIndexOf('/');
            if (lastSlash > 0) {
                try {
                    const pattern = cmd.slice(1, lastSlash);
                    const flags = cmd.slice(lastSlash + 1);
                    const regex = new RegExp(pattern, flags);
                    return regex.test(content);
                } catch (e) { 
                    // Fallback to basic match
                }
            }
        }
        return content.includes(cmd);
    }

    processItem(item) {
        let group = 'safe';
        const isCommand = item.toolType === 'run_command';

        // Nếu không phải là chạy lệnh cmd (vd: ghi file, đọc file, list dir...) thì mặc định AN TOÀN tuyệt đối
        if (isCommand) {
            // Phân loại rủi ro dựa trên nội dung câu lệnh đã trích xuất chính xác
            for (const cmd of this.config.high.list) {
                if (this.isMatch(item.content, cmd)) {
                    group = 'high';
                    break;
                }
            }

            if (group === 'safe') {
                for (const cmd of this.config.medium.list) {
                    if (this.isMatch(item.content, cmd)) {
                        group = 'medium';
                        break;
                    }
                }
            }
        } else {
            // Các tác vụ file_edit hoặc file_read luôn là an toàn tuyệt đối
            group = 'safe';
        }

        const timeout = group === 'safe' ? 0 : this.config[group].timeout;

        if (timeout === -1) {
            // Chặn hoàn toàn, bắt buộc tự bấm tay
            vscode.window.showWarningMessage(`🔴 SAC: Đã CHẶN: "${item.content.substring(0, 60)}...". Hãy duyệt thủ công.`);
            return;
        }

        if (timeout > 0) {
            let displayGroup = '🟡 CẢNH GIÁC';
            if (group === 'high') {
                displayGroup = '⚠️ RỦI RO CAO';
            } else if (group === 'safe') {
                displayGroup = '🟢 AN TOÀN';
            }
            const displayContent = item.content.length > 50 ? item.content.substring(0, 47) + '...' : item.content;

            let isCancelled = false;

            // Sử dụng Progress Notification để đếm ngược trực quan và tự động đóng sạch sẽ
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `SAC: ${displayGroup}`,
                cancellable: true
            }, async (progress, token) => {
                token.onCancellationRequested(() => {
                    isCancelled = true;
                    vscode.window.showInformationMessage('❌ Đã hủy tự động duyệt lệnh này. Hãy tự kiểm tra.');
                });

                const steps = 20;
                const interval = timeout / steps;
                for (let i = steps; i >= 0; i--) {
                    if (isCancelled) break;
                    const remainingSec = (i * interval / 1000).toFixed(1);
                    progress.report({
                        increment: i === steps ? 100 : -(100 / steps),
                        message: `[ ${displayContent} ] - Tự động duyệt sau ${remainingSec}s`
                    });
                    await new Promise(resolve => setTimeout(resolve, interval));
                }

                if (!isCancelled) {
                    this.simulateClick(item.x, item.y);
                }
            });
        } else {
            // Chạy ngay lập tức (safe hoặc timeout = 0)
            this.simulateClick(item.x, item.y);
            
            // Nhấp nháy Status Bar dưới cùng để báo hiệu click duyệt an toàn thành công
            vscode.commands.executeCommand('smartAutoAccept.flashStatus');
        }
    }

    async simulateClick(x, y) {
        await this.sendCommand('Input.dispatchMouseEvent', {
            type: 'mousePressed', x, y, button: 'left', clickCount: 1
        });
        await this.sendCommand('Input.dispatchMouseEvent', {
            type: 'mouseReleased', x, y, button: 'left', clickCount: 1
        });
    }

    stopInternal() {
        if (this.pollInterval) clearInterval(this.pollInterval);
        this.pollInterval = null;
        if (this.ws) {
            this.ws.removeAllListeners();
            this.ws.close();
        }
        this.ws = null;
    }

    stop() {
        this.isRunning = false;
        this.stopInternal();
    }
}

module.exports = { CDPClient };
