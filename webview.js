function getWebviewContent(config, isEnabled) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Smart Auto Click-to-Accept Settings</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js"></script>
    <style>
        :root {
            --color-safe: #50fa7b;
            --color-medium: #f1fa8c;
            --color-high: #ff5555;
            --glow-safe: rgba(80, 250, 123, 0.15);
            --glow-medium: rgba(241, 250, 140, 0.15);
            --glow-high: rgba(255, 85, 85, 0.15);
            --bg-card: var(--vscode-editorWidget-background, #252526);
            --bg-body: var(--vscode-editor-background, #1e1e1e);
            --text-main: var(--vscode-editor-foreground, #cccccc);
        }

        body { 
            font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif; 
            padding: 16px; 
            background-color: var(--bg-body); 
            color: var(--text-main);
            margin: 0;
            line-height: 1.5;
        }

        /* Dashboard Header & Toggle */
        .dashboard-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%);
            background-color: var(--bg-card);
            padding: 16px;
            border-radius: 12px;
            margin-bottom: 20px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
            backdrop-filter: blur(10px);
        }

        .header-info h2 {
            margin: 0 0 6px 0;
            font-size: 22px;
            font-weight: 600;
            letter-spacing: -0.5px;
            background: linear-gradient(90deg, #50fa7b, #8be9fd);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .header-info p {
            margin: 0;
            font-size: 13px;
            opacity: 0.7;
        }

        .toggle-container {
            display: flex;
            align-items: center;
            gap: 16px;
            background: rgba(0,0,0,0.2);
            padding: 10px 20px;
            border-radius: 50px;
            border: 1px solid rgba(255,255,255,0.05);
        }

        .status-label {
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            transition: all 0.3s ease;
        }

        .status-label.active {
            color: var(--color-safe);
            text-shadow: 0 0 12px var(--color-safe);
        }

        .status-label.inactive {
            color: var(--color-high);
            text-shadow: 0 0 12px var(--color-high);
        }

        /* Toggle Switch */
        .switch {
            position: relative;
            display: inline-block;
            width: 52px;
            height: 28px;
        }

        .switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }

        .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #3e3e3e;
            transition: .3s cubic-bezier(0.4, 0, 0.2, 1);
            border-radius: 28px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .slider:before {
            position: absolute;
            content: "";
            height: 20px;
            width: 20px;
            left: 3px;
            bottom: 3px;
            background-color: #a0a0a0;
            transition: .3s cubic-bezier(0.4, 0, 0.2, 1);
            border-radius: 50%;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        input:checked + .slider {
            background-color: rgba(80, 250, 123, 0.2);
            border-color: var(--color-safe);
            box-shadow: 0 0 15px rgba(80, 250, 123, 0.3);
        }

        input:checked + .slider:before {
            transform: translateX(24px);
            background-color: var(--color-safe);
            box-shadow: 0 0 8px var(--color-safe);
        }

        input:not(:checked) + .slider {
            background-color: rgba(255, 85, 85, 0.1);
            border-color: var(--color-high);
        }

        input:not(:checked) + .slider:before {
            background-color: var(--color-high);
            box-shadow: 0 0 8px var(--color-high);
        }

        /* Grid layout */
        .grid { display: flex; gap: 16px; }
        
        .column { 
            flex: 1; 
            background: var(--bg-card); 
            padding: 12px; 
            border-radius: 14px; 
            border: 1px solid rgba(255, 255, 255, 0.05); 
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            transition: all 0.3s ease;
        }
        
        .column:hover {
            box-shadow: 0 8px 30px rgba(0,0,0,0.25);
            transform: translateY(-2px);
        }
        
        /* Cột có màu viền và bóng tương ứng */
        #col-safe { border-top: 4px solid var(--color-safe); }
        #col-medium { border-top: 4px solid var(--color-medium); }
        #col-high { border-top: 4px solid var(--color-high); }

        h3 { margin-top: 0; margin-bottom: 12px; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
        .list { 
            min-height: 160px; 
            padding: 8px; 
            background: rgba(0,0,0,0.2); 
            border-radius: 8px; 
            border: 1px dashed rgba(255, 255, 255, 0.1);
            margin-bottom: 12px;
        }

        .item { 
            padding: 6px 10px; 
            margin-bottom: 6px; 
            border-radius: 6px; 
            cursor: grab; 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            font-weight: 500; 
            font-size: 12px;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .item:active { cursor: grabbing; transform: scale(0.98); }
        
        .item .remove { 
            cursor: pointer; 
            color: inherit; 
            font-weight: bold; 
            font-family: monospace; 
            opacity: 0.6;
            transition: opacity 0.2s;
            padding: 2px 6px;
            border-radius: 4px;
        }
        .item .remove:hover { opacity: 1; background: rgba(255,255,255,0.1); }
        
        .header-safe { color: var(--color-safe); }
        .header-medium { color: var(--color-medium); }
        .header-high { color: var(--color-high); }
        
        /* Màu chữ của từng lệnh tương ứng với rủi ro */
        .item-safe { background: rgba(80, 250, 123, 0.1); color: var(--color-safe); border: 1px solid rgba(80, 250, 123, 0.3); }
        .item-medium { background: rgba(241, 250, 140, 0.08); color: var(--color-medium); border: 1px solid rgba(241, 250, 140, 0.25); }
        .item-high { background: rgba(255, 85, 85, 0.08); color: var(--color-high); border: 1px solid rgba(255, 85, 85, 0.25); }
        
        .timeout-container { margin-bottom: 18px; font-size: 13px; display: flex; align-items: center; gap: 8px; justify-content: space-between; }
        
        .timeout-input { 
            width: 70px; 
            padding: 6px 10px; 
            background: rgba(0,0,0,0.2); 
            color: var(--text-main); 
            border: 1px solid rgba(255, 255, 255, 0.1); 
            border-radius: 6px;
            text-align: center;
            font-weight: 600;
        }

        .timeout-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder, #007acc);
        }

        .timeout-container small {
            opacity: 0.6;
            font-size: 11px;
        }

        button { 
            background: var(--vscode-button-background, #007acc); 
            color: var(--vscode-button-foreground, #ffffff); 
            border: none; 
            padding: 8px 14px; 
            cursor: pointer; 
            border-radius: 6px; 
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s ease;
        }
        button:hover { 
            background: var(--vscode-button-hoverBackground, #0062a3); 
            filter: brightness(1.1);
        }

        .add-container { display: flex; gap: 8px; }
        .add-input { 
            flex: 1; 
            padding: 8px 12px; 
            background: rgba(0,0,0,0.2); 
            color: var(--text-main); 
            border: 1px solid rgba(255, 255, 255, 0.1); 
            border-radius: 6px;
            font-size: 12px;
        }

        .add-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder, #007acc);
        }
        
        /* Ẩn hoàn toàn mũi tên tăng giảm của ô nhập số */
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
            -webkit-appearance: none; 
            margin: 0; 
        }
        input[type=number] {
            -moz-appearance: textfield; /* Firefox */
        }

        .save-btn {
            width: 100%; 
            padding: 16px; 
            font-size: 15px; 
            background: linear-gradient(135deg, #007acc 0%, #005999 100%); 
            color: white; 
            font-weight: 600;
            border-radius: 10px;
            margin-top: 24px;
            box-shadow: 0 4px 15px rgba(0, 122, 204, 0.3);
            letter-spacing: 0.5px;
        }

        .save-btn:hover {
            box-shadow: 0 6px 20px rgba(0, 122, 204, 0.4);
            transform: translateY(-1px);
        }
    </style>
</head>
<body>
    <div class="dashboard-header">
        <div class="header-info">
            <h2>Smart Auto Click-to-Accept Dashboard</h2>
            <p>Tự động duyệt các lệnh an toàn từ AI agent. Kéo thả các lệnh dưới đây để phân loại rủi ro.</p>
        </div>
        <div class="toggle-container">
            <span id="status-label" class="status-label ${isEnabled ? 'active' : 'inactive'}">
                ${isEnabled ? 'ĐANG BẬT' : 'ĐANG TẮT'}
            </span>
            <label class="switch">
                <input type="checkbox" id="status-toggle" ${isEnabled ? 'checked' : ''} onchange="onToggleStatus(this.checked)">
                <span class="slider"></span>
            </label>
        </div>
    </div>
    
    <div class="grid">
        <!-- SAFE -->
        <div class="column" id="col-safe">
            <h3 class="header-safe">🟢 Nhóm An Toàn</h3>
            <div class="timeout-container">
                <label>Tự duyệt sau (ms):</label>
                <input type="number" id="timeout-safe" class="timeout-input" value="${config.safe.timeout}">
            </div>
            <div id="list-safe" class="list">
                ${config.safe.list.map(cmd => `<div class="item item-safe" data-cmd="${cmd}">${cmd} <span class="remove">X</span></div>`).join('')}
            </div>
            <div class="add-container">
                <input type="text" id="add-safe-input" class="add-input" placeholder="vd: ls">
                <button onclick="addItem('safe', 'item-safe')">Thêm</button>
            </div>
        </div>

        <!-- MEDIUM -->
        <div class="column" id="col-medium">
            <h3 class="header-medium">🟡 Nhóm Cảnh Giác</h3>
            <div class="timeout-container">
                <label>Tự duyệt sau (ms):</label>
                <input type="number" id="timeout-medium" class="timeout-input" value="${config.medium.timeout}">
            </div>
            <div id="list-medium" class="list">
                ${config.medium.list.map(cmd => `<div class="item item-medium" data-cmd="${cmd}">${cmd} <span class="remove">X</span></div>`).join('')}
            </div>
            <div class="add-container">
                <input type="text" id="add-medium-input" class="add-input" placeholder="vd: npm install">
                <button onclick="addItem('medium', 'item-medium')">Thêm</button>
            </div>
        </div>

        <!-- HIGH -->
        <div class="column" id="col-high">
            <h3 class="header-high">🔴 Nhóm Rủi Ro Cao</h3>
            <div class="timeout-container">
                <div>
                    <label>Tự duyệt sau (ms):</label><br>
                    <small>(-1 = Chặn hoàn toàn)</small>
                </div>
                <input type="number" id="timeout-high" class="timeout-input" value="${config.high.timeout}" title="-1 nghĩa là bắt buộc tự bấm">
            </div>
            <div id="list-high" class="list">
                ${config.high.list.map(cmd => `<div class="item item-high" data-cmd="${cmd}">${cmd} <span class="remove">X</span></div>`).join('')}
            </div>
            <div class="add-container">
                <input type="text" id="add-high-input" class="add-input" placeholder="vd: rm -rf">
                <button onclick="addItem('high', 'item-high')">Thêm</button>
            </div>
        </div>
    </div>

    <div style="display: flex; gap: 12px; margin-top: 20px;">
        <button onclick="saveConfig()" class="save-btn" style="flex: 2; margin-top: 0;">💾 Lưu Cấu Hình</button>
        <button onclick="exportConfig()" class="save-btn" style="flex: 1; margin-top: 0; background: linear-gradient(135deg, #444 0%, #222 100%);">📤 Export JSON</button>
        <button onclick="importConfig()" class="save-btn" style="flex: 1; margin-top: 0; background: linear-gradient(135deg, #444 0%, #222 100%);">📥 Import JSON</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        const opts = {
            group: 'shared',
            animation: 150,
            onAdd: function (evt) {
                // Keep the color styling intact when dragging items between lists
            }
        };

        new Sortable(document.getElementById('list-safe'), opts);
        new Sortable(document.getElementById('list-medium'), opts);
        new Sortable(document.getElementById('list-high'), opts);

        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('remove')) {
                e.target.parentElement.remove();
            }
        });

        function addItem(listId, colorClass) {
            const input = document.getElementById(\`add-\${listId}-input\`);
            const cmd = input.value.trim();
            if (cmd) {
                const list = document.getElementById(\`list-\${listId}\`);
                const div = document.createElement('div');
                div.className = 'item ' + colorClass;
                div.setAttribute('data-cmd', cmd);
                div.innerHTML = \`\${cmd} <span class="remove">X</span>\`;
                list.appendChild(div);
                input.value = '';
            }
        }

        function onToggleStatus(enabled) {
            const label = document.getElementById('status-label');
            if (enabled) {
                label.textContent = 'ĐANG BẬT';
                label.className = 'status-label active';
            } else {
                label.textContent = 'ĐANG TẮT';
                label.className = 'status-label inactive';
            }
            vscode.postMessage({ command: 'toggleStatus', enabled: enabled });
        }

        // Nhận thông báo từ Extension
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'statusChanged') {
                const toggle = document.getElementById('status-toggle');
                const label = document.getElementById('status-label');
                toggle.checked = message.enabled;
                if (message.enabled) {
                    label.textContent = 'ĐANG BẬT';
                    label.className = 'status-label active';
                } else {
                    label.textContent = 'ĐANG TẮT';
                    label.className = 'status-label inactive';
                }
            }
        });

        function getConfigObject() {
            const getList = (id) => Array.from(document.getElementById(id).children).map(el => el.getAttribute('data-cmd'));
            
            return {
                safe: {
                    timeout: parseInt(document.getElementById('timeout-safe').value) || 0,
                    list: getList('list-safe')
                },
                medium: {
                    timeout: parseInt(document.getElementById('timeout-medium').value) || 0,
                    list: getList('list-medium')
                },
                high: {
                    timeout: parseInt(document.getElementById('timeout-high').value) || -1,
                    list: getList('list-high')
                }
            };
        }

        function saveConfig() {
            vscode.postMessage({ command: 'saveConfig', config: getConfigObject() });
        }
        
        function exportConfig() {
            vscode.postMessage({ command: 'exportConfig', config: getConfigObject() });
        }
        
        function importConfig() {
            vscode.postMessage({ command: 'importConfig' });
        }
    </script>
</body>
</html>`;
}

module.exports = { getWebviewContent };
