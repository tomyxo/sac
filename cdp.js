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
                                vscode.window.showErrorMessage(`Smart Auto Accept: Không tìm thấy trang UI của Antigravity qua CDP (port ${this.port}).`);
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
                        `⚠️ CAUTION: Vui lòng tự thêm tham số --remote-debugging-port=${this.port} vào đuôi mục Target của Shortcut Antigravity, tắt ứng dụng và mở lại bằng biểu tượng đó.`,
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
            vscode.window.showInformationMessage('Smart Auto Accept: Đã kết nối CDP thành công!');
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
                console.log('CDP connection lost, attempting to reconnect...');
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
        this.pollInterval = setInterval(async () => {
            if (!this.isRunning) return;
            
            // Lấy toàn bộ cây DOM
            const doc = await this.sendCommand('DOM.getDocument', { depth: -1 });
            if (!doc || !doc.root) return;

            // Đoạn mã Evaluate js trực tiếp trên trình duyệt để quét các nút và phân tích ngữ cảnh
            const expr = `
                (() => {
                    const selectors = ['.bg-ide-button-background', 'button.cursor-pointer', 'button'];
                    let buttons = [];
                    
                    const docs = [document];
                    document.querySelectorAll('iframe').forEach(f => {
                        try { if(f.contentDocument) docs.push(f.contentDocument); } catch(e){}
                    });

                    docs.forEach(doc => {
                        selectors.forEach(sel => {
                            buttons.push(...Array.from(doc.querySelectorAll(sel + ':not(.pending)')));
                        });
                    });

                    // Bổ sung các từ khóa chấp thuận phổ biến của IDE (như approve, proceed, yes, agree)
                    const acceptPatterns = ['accept', 'run', 'retry', 'apply', 'execute', 'confirm', 'always allow', 'allow once', 'allow', 'approve', 'proceed', 'yes', 'agree'];
                    const rejectPatterns = ['skip', 'reject', 'cancel', 'close', 'refine'];
                    
                    const validButtons = buttons.filter(btn => {
                        const text = (btn.textContent || '').trim().toLowerCase();
                        if (!text || text.length > 50) return false;
                        if (rejectPatterns.some(p => text.includes(p))) return false;
                        return acceptPatterns.some(p => text.includes(p));
                    });

                    return validButtons.map(btn => {
                        btn.classList.add('pending');
                        
                        // Tìm container thẻ công cụ (tool card container) gần nhất để phân loại chính xác công cụ nào đang chạy
                        let toolCard = null;
                        let curr = btn;
                        for (let i = 0; i < 8 && curr; i++) {
                            const text = (curr.innerText || '').toLowerCase();
                            if (text.includes('run_command') || 
                                text.includes('write_to_file') || 
                                text.includes('replace_file_content') || 
                                text.includes('multi_replace_file_content') ||
                                text.includes('view_file') ||
                                text.includes('grep_search') ||
                                text.includes('list_dir') ||
                                text.includes('running command') ||
                                text.includes('editing file') ||
                                text.includes('writing file')) {
                                toolCard = curr;
                                break;
                            }
                            curr = curr.parentElement;
                        }
                        
                        if (!toolCard) {
                            let p = btn;
                            for (let i = 0; i < 3 && p.parentElement; i++) p = p.parentElement;
                            toolCard = p;
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
                        
                        // Chỉ trích xuất lệnh CMD thực tế nếu đây là tác vụ run_command (giúp loại bỏ nhiễu từ diff file hoặc lịch sử chat)
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
                        let win = btn.ownerDocument.defaultView;
                        if (win !== window) {
                            try {
                                const frame = window.document.querySelector('iframe');
                                if (frame) {
                                    const rect = frame.getBoundingClientRect();
                                    xOffset = rect.left;
                                    yOffset = rect.top;
                                }
                            } catch(e){}
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
            
            if (res && res.result && res.result.value) {
                const items = res.result.value;
                items.forEach(item => this.processItem(item));
            }

        }, 1500); // Quét mỗi 1.5 giây
    }

    isMatch(content, cmd) {
        if (cmd.startsWith('/') && cmd.endsWith('/') && cmd.length > 2) {
            try {
                const regex = new RegExp(cmd.slice(1, -1));
                return regex.test(content);
            } catch (e) { return content.includes(cmd); }
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
        
        const timeout = this.config[group].timeout;
        
        if (timeout === -1) {
            // Chặn hoàn toàn, bắt buộc tự bấm tay
            vscode.window.showWarningMessage(`🔴 Smart Auto Accept: Đã CHẶN lệnh rủi ro cao: "${item.content.substring(0, 60)}...". Bạn phải tự duyệt thủ công.`);
            return;
        }
        
        if (timeout > 0) {
            // Hiển thị thông báo đếm ngược và cho phép hủy tự động duyệt
            const displayGroup = group === 'high' ? '⚠️ RỦI RO CAO' : '🟡 CẢNH GIÁC';
            const displayContent = item.content.length > 50 ? item.content.substring(0, 47) + '...' : item.content;
            const message = `Smart Auto Accept: Phát hiện lệnh ${displayGroup} ("${displayContent}"). Sẽ tự động chạy sau ${timeout / 1000} giây.`;
            
            let isCancelled = false;
            
            vscode.window.showWarningMessage(message, 'Hủy tự động duyệt').then(selection => {
                if (selection === 'Hủy tự động duyệt') {
                    isCancelled = true;
                    vscode.window.showInformationMessage('❌ Đã hủy tự động duyệt lệnh này. Bạn hãy tự kiểm tra.');
                }
            });
            
            setTimeout(() => {
                if (!isCancelled) {
                    this.simulateClick(item.x, item.y);
                }
            }, timeout);
        } else {
            // Chạy ngay lập tức (safe hoặc timeout = 0)
            this.simulateClick(item.x, item.y);
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
