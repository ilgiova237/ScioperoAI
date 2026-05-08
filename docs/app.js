const API_BASE = 'https://sciopero-scan-ai.ilgiova237.deno.net/api';
let currentAnalysis = null;
let adminToken = null;

// ── INIT ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    renderMainPage();
    registerServiceWorker();
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
            e.preventDefault();
            openAdminLogin();
        }
    });
});

async function registerServiceWorker() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
            const reg = await navigator.serviceWorker.register('/sw.js');
            const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(localStorage.getItem('vapid_public') || '')
            });
            if (sub) {
                await fetch(API_BASE + '/push/subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(sub)
                });
            }
        } catch (e) { console.log('Service worker o push non disponibili'); }
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const uint8Array = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
        uint8Array[i] = rawData.charCodeAt(i);
    }
    return uint8Array;
}

// ── RENDER ────────────────────────────────
function renderMainPage() {
    const main = document.getElementById('mainContent');
    if (!main) return;
    main.innerHTML = `
        <div class="hero">
            <h1>Carica il documento,<br>ottieni l'<span>analisi tattica</span></h1>
            <p>Valuta probabilità di riuscita, punti di forza, criticità e ricevi consigli strategici.</p>
        </div>
        <div class="card" id="uploadCard">
            <div class="card-header"><span class="icon-circle icon-upload">📄</span> Carica il documento sindacale</div>
            <div class="upload-zone" id="dropZone">
                <span class="upload-icon">📤</span><h3>Trascina qui il file</h3><p>oppure clicca per selezionarlo</p>
                <div class="upload-formats"><span class="format-badge">PDF</span><span class="format-badge">DOCX</span><span class="format-badge">DOC</span><span class="format-badge">TXT</span></div>
                <input type="file" id="fileInput" accept=".pdf,.docx,.doc,.txt">
            </div>
            <div class="text-paste-toggle"><button onclick="togglePasteArea()">📝 Oppure incolla il testo direttamente</button></div>
            <div class="text-paste-area" id="pasteArea">
                <textarea id="pasteTextarea" placeholder="Incolla qui il testo completo del documento di sciopero..."></textarea>
                <div style="text-align:center;margin-top:12px;"><button class="btn btn-primary" onclick="analyzePastedText()">🔍 Analizza testo incollato</button></div>
            </div>
            <div style="text-align:center;margin-top:16px;">
                <button class="btn btn-primary" id="analyzeBtn" onclick="triggerFileUpload()">🔍 Analizza documento</button>
            </div>
        </div>
        <div class="card progress-container" id="progressCard">
            <div class="card-header"><span class="icon-circle icon-progress">⏳</span> Elaborazione in corso</div>
            <div class="progress-steps" id="progressSteps"></div>
            <div class="progress-bar-outer"><div class="progress-bar-inner" id="progressBar"></div></div>
            <p id="progressMessage" style="text-align:center;margin-top:10px;font-size:.85rem;color:var(--text-muted)">Preparazione...</p>
        </div>
        <div class="card results-container" id="resultsCard">
            <div class="card-header"><span class="icon-circle icon-result">✅</span> Analisi completata</div>
            <div id="alertBanner"></div>
            <div id="resultBadge"></div>
            <div class="analysis-content" id="analysisContent"></div>
            <div class="result-actions" id="resultActions"></div>
            <div id="volantinoBox"></div>
            <div id="adesioneBox" class="card" style="margin-top:1.5rem;"></div>
        </div>
        <button class="btn btn-outline" onclick="openHistory()" style="margin-top:1rem;">📚 Storico analisi</button>
    `;
    setupUploadListeners();
}

function setupUploadListeners() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    if (!dropZone || !fileInput) return;
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => { if (e.target.files.length>0) handleFile(e.target.files[0]); });
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault(); dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length>0) handleFile(e.dataTransfer.files[0]);
    });
}

// ── GLOBAL FUNCTIONS ──────────────────────
function triggerFileUpload() { document.getElementById('fileInput')?.click(); }
function togglePasteArea() {
    const area = document.getElementById('pasteArea');
    area?.classList.toggle('active');
}
function analyzePastedText() {
    const text = document.getElementById('pasteTextarea')?.value?.trim();
    if (!text || text.length<20) { showToast('⚠️ Testo troppo corto'); return; }
    document.getElementById('pasteArea')?.classList.remove('active');
    submitAnalysis(text);
}

// ── FILE HANDLING ─────────────────────────
async function handleFile(file) {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const valid = ['.pdf', '.docx', '.doc', '.txt'];
    if (!valid.includes(ext)) { showToast('⚠️ Formato non supportato'); return; }
    if (file.size > 50*1024*1024) { showToast('⚠️ File troppo grande (max 50 MB)'); return; }
    
    setProgress(10, 'Caricamento file...');
    document.getElementById('progressCard')?.classList.add('active');
    document.getElementById('resultsCard')?.classList.remove('active');
    
    try {
        let text = '';
        if (ext === '.txt') {
            text = await file.text();
        } else if (ext === '.docx') {
            const buf = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer: buf });
            text = result.value;
        } else if (ext === '.pdf') {
            const buf = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                text += content.items.map(it => it.str).join(' ') + '\n';
            }
            if (text.trim().length < pdf.numPages * 30) {
                showToast('📷 PDF scansionato, avvio OCR...');
                text = await doOCR(buf, pdf.numPages);
            }
        } else if (ext === '.doc') {
            try {
                const buf = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer: buf });
                text = result.value;
            } catch {
                showToast('⚠️ File .doc non supportato, convertilo in PDF/DOCX');
                resetUI();
                return;
            }
        }
        if (text.length < 30) { showToast('⚠️ Impossibile estrarre testo'); resetUI(); return; }
        setProgress(30, 'Testo estratto');
        submitAnalysis(text);
    } catch(e) { showToast('❌ Errore: '+e.message); resetUI(); }
}

async function doOCR(buf, numPages) {
    const worker = await Tesseract.createWorker('ita');
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let text = '';
    for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        const { data: { text: t } } = await worker.recognize(canvas);
        text += t + '\n';
    }
    await worker.terminate();
    return text;
}

// ── SUBMIT ANALYSIS ──────────────────────
async function submitAnalysis(text) {
    document.getElementById('progressCard')?.classList.add('active');
    document.getElementById('resultsCard')?.classList.remove('active');
    setProgress(40, 'Invio all\'AI...');
    try {
        const res = await fetch(API_BASE + '/analyze', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ text })
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setProgress(100, 'Completato');
        currentAnalysis = data;
        displayResults(data);
    } catch(e) { showToast('❌ '+e.message); resetUI(); }
}

// ── DISPLAY ──────────────────────────────
function displayResults(data) {
    document.getElementById('progressCard')?.classList.remove('active');
    document.getElementById('resultsCard')?.classList.add('active');
    document.getElementById('alertBanner').innerHTML = data.alert ? `<div class="alert-banner">⚠️ ${data.alert.message}</div>` : '';
    const prob = data.probability || 'MEDIA';
    const clsMap = {'ALTA':'badge-alta','MEDIO-ALTA':'badge-medio-alta','MEDIA':'badge-media','MEDIO-BASSA':'badge-medio-bassa','BASSA':'badge-bassa'};
    document.getElementById('resultBadge').innerHTML = `<span class="result-badge ${clsMap[prob] || 'badge-media'}">📊 PROBABILITÀ: ${prob}</span>`;
    document.getElementById('analysisContent').innerHTML = (data.analysis||'').replace(/\n/g,'<br>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
    document.getElementById('resultActions').innerHTML = `
        <button class="btn btn-outline" onclick="copyResults()">📋 Copia</button>
        <button class="btn btn-outline" onclick="downloadResults()">💾 Scarica .txt</button>
        <button class="btn btn-outline" onclick="generateVolantino()">📢 Genera volantino</button>
        <button class="btn btn-outline" onclick="resetUI()">🔄 Nuova analisi</button>
    `;
    document.getElementById('adesioneBox').innerHTML = `
        <strong>📊 Calcola adesione stimata</strong><br><br>
        <input type="number" id="totaleLavoratori" placeholder="Totale lavoratori coinvolgibili" style="width:100%;padding:8px;margin-bottom:8px;border:1px solid var(--border);border-radius:8px;">
        <input type="number" id="adesioneStorica" placeholder="% adesione storica (es. 65)" style="width:100%;padding:8px;margin-bottom:8px;border:1px solid var(--border);border-radius:8px;">
        <button class="btn btn-primary btn-sm" onclick="calcolaAdesione()">Calcola</button>
        <span id="risultatoAdesione" style="margin-left:12px;font-weight:600;"></span>
    `;
    document.getElementById('resultsCard').scrollIntoView({ behavior:'smooth' });
}

function calcolaAdesione() {
    const totale = parseInt(document.getElementById('totaleLavoratori')?.value||'0');
    const perc = parseFloat(document.getElementById('adesioneStorica')?.value||'0');
    const stima = Math.round(totale * perc / 100);
    document.getElementById('risultatoAdesione').textContent = `Stima: ${stima} scioperanti`;
}

async function generateVolantino() {
    if (!currentAnalysis) return;
    showToast('📢 Generazione volantino...');
    const res = await fetch(API_BASE + '/volantino', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ analysis: currentAnalysis.analysis })
    });
    const data = await res.json();
    document.getElementById('volantinoBox').innerHTML = `
        <div class="volantino-box">
            <strong>📢 Volantino generato:</strong><br><br>
            ${(data.volantino||'').replace(/\n/g,'<br>')}
        </div>
    `;
}

function copyResults() {
    const text = document.getElementById('analysisContent')?.innerText;
    if (text) navigator.clipboard.writeText(text).then(()=>showToast('📋 Copiato!'));
}
function downloadResults() {
    const text = document.getElementById('analysisContent')?.innerText;
    if (!text) return;
    const blob = new Blob([text], {type:'text/plain'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'analisi-sciopero.txt';
    a.click();
}

// ── PROGRESS ─────────────────────────────
function setProgress(pct, msg) {
    const bar = document.getElementById('progressBar');
    const msgEl = document.getElementById('progressMessage');
    if (bar) bar.style.width = pct+'%';
    if (msgEl) msgEl.textContent = msg;
}

function resetUI() {
    document.getElementById('progressCard')?.classList.remove('active');
    document.getElementById('resultsCard')?.classList.remove('active');
    currentAnalysis = null;
    setProgress(0,'');
}

// ── ADMIN ────────────────────────────────
function openAdminLogin() {
    const pwd = prompt('🔐 Inserisci password amministratore:');
    if (!pwd) return;
    fetch(API_BASE + '/admin/verify', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ password: pwd })
    }).then(r => r.json()).then(d => {
        if (d.token) { adminToken = d.token; openAdminPanel(); }
        else showToast('❌ Password errata');
    });
}

function openAdminPanel() {
    fetch(API_BASE + '/admin/settings', { headers: { Authorization: `Bearer ${adminToken}` }})
    .then(r => r.json()).then(settings => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal">
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
                <h2>⚙️ Impostazioni Admin</h2>
                <label>API Key Gemini</label>
                <input type="password" id="adminApiKey" value="${settings.apiKey||''}">
                <label>Prompt di analisi</label>
                <textarea id="adminPrompt">${settings.prompt||''}</textarea>
                <label>Nuova password</label>
                <input type="password" id="adminNewPassword" placeholder="Lascia vuoto per non cambiare">
                <button class="btn btn-primary" onclick="saveAdminSettings()" style="margin-top:1rem;">💾 Salva</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => { if (e.target===modal) modal.remove(); });
    });
}

function saveAdminSettings() {
    const apiKey = document.getElementById('adminApiKey')?.value;
    const prompt = document.getElementById('adminPrompt')?.value;
    const password = document.getElementById('adminNewPassword')?.value;
    const body = { apiKey, prompt };
    if (password) body.password = password;
    fetch(API_BASE + '/admin/settings', {
        method:'PUT', headers: {'Content-Type':'application/json', Authorization: `Bearer ${adminToken}`},
        body: JSON.stringify(body)
    }).then(r => r.json()).then(d => {
        if (d.success) { showToast('✅ Impostazioni salvate'); document.querySelector('.modal-overlay')?.remove(); }
    });
}

// ── HISTORY ──────────────────────────────
function openHistory() {
    fetch(API_BASE + '/history').then(r => r.json()).then(records => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        let items = records.map(r => `
            <div class="history-item" onclick="loadHistoryItem('${r.id}')">
                <span class="date">${r.date?.split('T')[0]}</span>
                <span class="prob">Prob: ${r.probability}</span>
                <p style="font-size:.8rem;color:var(--text-muted)">${r.originalDocumentSnippet?.substring(0,100)}...</p>
            </div>
        `).join('');
        modal.innerHTML = `
            <div class="modal">
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
                <h2>📚 Storico analisi</h2>
                <div class="history-list">${items||'<p>Nessuna analisi ancora.</p>'}</div>
                <button class="btn btn-outline btn-sm" onclick="exportHistory()">📤 Esporta JSON</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => { if (e.target===modal) modal.remove(); });
    });
}

function loadHistoryItem(id) {
    fetch(API_BASE + '/history/' + id).then(r => r.json()).then(data => {
        currentAnalysis = { analysis: data.text, probability: data.probability, alert: null };
        displayResults(currentAnalysis);
        document.querySelector('.modal-overlay')?.remove();
    });
}

async function exportHistory() {
    const res = await fetch(API_BASE + '/history/export/all');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'storico_scioperoscan.json';
    a.click();
    showToast('📤 Storico esportato');
}

// ── TOAST ────────────────────────────────
function showToast(msg) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.id = 'toastContainer';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}