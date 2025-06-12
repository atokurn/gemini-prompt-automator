// popup.js - Script untuk popup ekstensi

// Elemen UI
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const statusBadge = document.getElementById('status-badge');
const timerDisplay = document.getElementById('timer-display');
const excelFileInput = document.getElementById('excel-file');
const fileNameDisplay = document.getElementById('file-name');
const promptList = document.getElementById('prompt-list');
const promptCount = document.getElementById('prompt-count');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');
const intervalTypeRadios = document.querySelectorAll('input[name="interval-type"]');
const fixedIntervalSetting = document.getElementById('fixed-interval-setting');
const randomIntervalSetting = document.getElementById('random-interval-setting');
const fixedIntervalInput = document.getElementById('fixed-interval');
const minIntervalInput = document.getElementById('min-interval');
const maxIntervalInput = document.getElementById('max-interval');
const maxRepeatsInput = document.getElementById('max-repeats');
const globalRepeatCheckbox = document.getElementById('global-repeat');
const autoDownloadCheckbox = document.getElementById('auto-download');
const downloadSettings = document.getElementById('download-settings');
const downloadIntervalTypeRadios = document.querySelectorAll('input[name="download-interval-type"]');
const fixedBeforeDownloadSetting = document.getElementById('fixed-before-download-setting');
const randomBeforeDownloadSetting = document.getElementById('random-before-download-setting');
const fixedAfterDownloadSetting = document.getElementById('fixed-after-download-setting');
const randomAfterDownloadSetting = document.getElementById('random-after-download-setting');
const fixedBeforeDownloadInput = document.getElementById('fixed-before-download');
const fixedAfterDownloadInput = document.getElementById('fixed-after-download');
const minBeforeDownloadInput = document.getElementById('min-before-download');
const maxBeforeDownloadInput = document.getElementById('max-before-download');
const minAfterDownloadInput = document.getElementById('min-after-download');
const maxAfterDownloadInput = document.getElementById('max-after-download');
const saveSettingsBtn = document.getElementById('save-settings');
const logList = document.getElementById('log-list');
const clearLogsBtn = document.getElementById('clear-logs');
const errorDisplay = document.getElementById('error-display');
const lastErrorText = document.getElementById('last-error');

// State lokal
let state = {
  status: 'idle',
  prompts: [],
  currentPromptIndex: 0,
  currentRepeatCount: 0,
  maxRepeats: 1,
  enableGlobalRepeat: true,
  intervalType: 'fixed',
  intervalFixed: 30,
  intervalMin: 10,
  intervalMax: 60,
  autoDownloadImages: true,
  downloadIntervalType: 'fixed',
  fixedBeforeDownload: 3,
  fixedAfterDownload: 2,
  minBeforeDownload: 2,
  maxBeforeDownload: 5,
  minAfterDownload: 1,
  maxAfterDownload: 3,
  timeRemaining: 0,
  lastError: null,
  logs: [],
  isRunning: false
};

// Fungsi untuk memformat waktu
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Fungsi untuk memperbarui UI berdasarkan state
function updateUI() {
  // Update status badge
  statusBadge.className = 'status-badge ' + state.status;
  statusBadge.textContent = state.status;
  
  // Update timer display
  timerDisplay.textContent = formatTime(state.timeRemaining);
  
  // Update button states
  startBtn.disabled = state.isRunning;
  stopBtn.disabled = !state.isRunning;
  
  // Update prompt list
  updatePromptList();
  
  // Update settings
  updateSettingsUI();
  
  // Update logs
  updateLogsUI();
  
  // Update error display
  if (state.lastError) {
    errorDisplay.classList.remove('hidden');
    lastErrorText.textContent = state.lastError;
  } else {
    errorDisplay.classList.add('hidden');
  }
}

// Fungsi untuk memperbarui daftar prompt
function updatePromptList() {
  promptCount.textContent = `(${state.prompts.length})`;
  
  if (state.prompts.length === 0) {
    promptList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-file-import fa-2x"></i>
        <p>Pilih file Excel untuk memuat daftar prompt</p>
      </div>
    `;
    return;
  }
  
  promptList.innerHTML = '';
  
  state.prompts.forEach((prompt, index) => {
    const promptItem = document.createElement('div');
    promptItem.className = 'prompt-item';
    
    const isCurrentPrompt = index === state.currentPromptIndex;
    if (isCurrentPrompt) {
      promptItem.style.backgroundColor = 'rgba(142, 68, 173, 0.1)';
    }
    
    promptItem.innerHTML = `
      <div class="prompt-index">${index + 1}</div>
      <div class="prompt-text" title="${prompt}">${prompt}</div>
    `;
    
    promptList.appendChild(promptItem);
  });
  
  // Scroll to current prompt
  if (state.prompts.length > 0) {
    const currentItem = promptList.children[state.currentPromptIndex];
    if (currentItem) {
      currentItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

// Fungsi untuk memperbarui UI pengaturan
function updateSettingsUI() {
  // Add/remove class to hide old interval settings when auto download is active
  const settingsContainer = document.querySelector('#settings-tab');
  if (settingsContainer) {
    if (state.autoDownloadImages) {
      settingsContainer.classList.add('auto-download-active');
    } else {
      settingsContainer.classList.remove('auto-download-active');
    }
  }
  
  // Interval type
  const intervalTypeRadio = document.querySelector(`input[name="interval-type"][value="${state.intervalType}"]`);
  if (intervalTypeRadio) {
    intervalTypeRadio.checked = true;
  }
  
  // Show/hide interval settings
  if (state.intervalType === 'fixed') {
    fixedIntervalSetting.classList.remove('hidden');
    randomIntervalSetting.classList.add('hidden');
  } else {
    fixedIntervalSetting.classList.add('hidden');
    randomIntervalSetting.classList.remove('hidden');
  }
  
  // Set interval values
  fixedIntervalInput.value = state.intervalFixed;
  minIntervalInput.value = state.intervalMin;
  maxIntervalInput.value = state.intervalMax;
  
  // Set repeat values
  maxRepeatsInput.value = state.maxRepeats;
  globalRepeatCheckbox.checked = state.enableGlobalRepeat;
  
  // Set auto download
  autoDownloadCheckbox.checked = state.autoDownloadImages;
  
  // Show/hide download settings based on auto download toggle
  if (state.autoDownloadImages) {
    downloadSettings.classList.remove('hidden');
  } else {
    downloadSettings.classList.add('hidden');
  }
  
  // Download interval type
  const downloadIntervalTypeRadio = document.querySelector(`input[name="download-interval-type"][value="${state.downloadIntervalType}"]`);
  if (downloadIntervalTypeRadio) {
    downloadIntervalTypeRadio.checked = true;
  }
  
  // Show/hide download interval settings
  if (state.downloadIntervalType === 'fixed') {
    if (fixedBeforeDownloadSetting) fixedBeforeDownloadSetting.classList.remove('hidden');
    if (randomBeforeDownloadSetting) randomBeforeDownloadSetting.classList.add('hidden');
    if (fixedAfterDownloadSetting) fixedAfterDownloadSetting.classList.remove('hidden');
    if (randomAfterDownloadSetting) randomAfterDownloadSetting.classList.add('hidden');
  } else {
    if (fixedBeforeDownloadSetting) fixedBeforeDownloadSetting.classList.add('hidden');
    if (randomBeforeDownloadSetting) randomBeforeDownloadSetting.classList.remove('hidden');
    if (fixedAfterDownloadSetting) fixedAfterDownloadSetting.classList.add('hidden');
    if (randomAfterDownloadSetting) randomAfterDownloadSetting.classList.remove('hidden');
  }
  
  // Set download interval values
  if (fixedBeforeDownloadInput) fixedBeforeDownloadInput.value = state.fixedBeforeDownload;
  if (fixedAfterDownloadInput) fixedAfterDownloadInput.value = state.fixedAfterDownload;
  if (minBeforeDownloadInput) minBeforeDownloadInput.value = state.minBeforeDownload;
  if (maxBeforeDownloadInput) maxBeforeDownloadInput.value = state.maxBeforeDownload;
  if (minAfterDownloadInput) minAfterDownloadInput.value = state.minAfterDownload;
  if (maxAfterDownloadInput) maxAfterDownloadInput.value = state.maxAfterDownload;
}

// Fungsi untuk memperbarui UI log
function updateLogsUI() {
  if (state.logs.length === 0) {
    logList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-clipboard-list fa-2x"></i>
        <p>Belum ada aktivitas tercatat</p>
      </div>
    `;
    return;
  }
  
  logList.innerHTML = '';
  
  state.logs.slice(0, 50).forEach(log => {
    const logItem = document.createElement('div');
    logItem.className = 'log-item';
    
    // Format timestamp
    const date = new Date(log.timestamp);
    const formattedTime = date.toLocaleTimeString();
    
    logItem.innerHTML = `
      <div class="log-timestamp">${formattedTime}</div>
      <div class="log-message">${log.message}</div>
    `;
    
    logList.appendChild(logItem);
  });
}

// Fungsi untuk membaca file Excel
function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Ambil sheet pertama
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Konversi ke array of objects
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Filter baris kosong dan ambil kolom pertama sebagai prompt
        const prompts = rows
          .map(row => row[0])
          .filter(prompt => prompt && typeof prompt === 'string' && prompt.trim() !== '');
        
        resolve(prompts);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = function() {
      reject(new Error('Gagal membaca file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

// Fungsi untuk memulai otomatisasi
function startAutomation() {
  if (state.prompts.length === 0) {
    alert('Tidak ada prompt yang dimuat. Silakan pilih file Excel terlebih dahulu.');
    return;
  }
  
  // Kirim prompts terlebih dahulu
  chrome.runtime.sendMessage({ 
    action: 'setPrompts', 
    prompts: state.prompts 
  }, promptResponse => {
    if (promptResponse && promptResponse.success) {
      console.log('Prompts berhasil dikirim ke background script');
      
      // Kirim config
      const config = {
        intervalType: state.intervalType,
        intervalFixed: parseInt(fixedIntervalInput.value, 10) || 30,
        intervalMin: parseInt(minIntervalInput.value, 10) || 10,
        intervalMax: parseInt(maxIntervalInput.value, 10) || 60,
        maxRepeats: parseInt(maxRepeatsInput.value, 10) || 1,
        enableGlobalRepeat: globalRepeatCheckbox.checked,
        autoDownloadImages: autoDownloadCheckbox.checked,
        downloadIntervalType: state.downloadIntervalType,
        fixedBeforeDownload: parseInt(fixedBeforeDownloadInput.value, 10) || 3,
        fixedAfterDownload: parseInt(fixedAfterDownloadInput.value, 10) || 2,
        minBeforeDownload: parseInt(minBeforeDownloadInput.value, 10) || 2,
        maxBeforeDownload: parseInt(maxBeforeDownloadInput.value, 10) || 5,
        minAfterDownload: parseInt(minAfterDownloadInput.value, 10) || 1,
        maxAfterDownload: parseInt(maxAfterDownloadInput.value, 10) || 3
      };
      
      chrome.runtime.sendMessage({ 
        action: 'setConfig', 
        config 
      }, configResponse => {
        if (configResponse && configResponse.success) {
          console.log('Config berhasil dikirim ke background script');
          
          // Mulai otomatisasi
          chrome.runtime.sendMessage({ action: 'startAutomation' }, response => {
            if (response && response.success) {
              console.log('Otomatisasi dimulai');
              state.isRunning = true;
              updateUI();
            } else {
              console.error('Gagal memulai otomatisasi:', response);
              alert('Gagal memulai otomatisasi. Silakan coba lagi.');
            }
          });
        } else {
          console.error('Gagal mengirim config:', configResponse);
          alert('Gagal mengirim konfigurasi. Silakan coba lagi.');
        }
      });
    } else {
      console.error('Gagal mengirim prompts:', promptResponse);
      alert('Gagal mengirim daftar prompt. Silakan coba lagi.');
    }
  });
}

// Fungsi untuk menghentikan otomatisasi
function stopAutomation() {
  chrome.runtime.sendMessage({ action: 'stopAutomation' }, response => {
    if (response && response.success) {
      state.isRunning = false;
      updateUI();
    }
  });
}

// Fungsi untuk menyimpan pengaturan
function saveSettings() {
  const config = {
    intervalType: state.intervalType,
    intervalFixed: parseInt(fixedIntervalInput.value, 10) || 30,
    intervalMin: parseInt(minIntervalInput.value, 10) || 10,
    intervalMax: parseInt(maxIntervalInput.value, 10) || 60,
    maxRepeats: parseInt(maxRepeatsInput.value, 10) || 1,
    enableGlobalRepeat: globalRepeatCheckbox.checked,
    autoDownloadImages: autoDownloadCheckbox.checked,
    downloadIntervalType: state.downloadIntervalType,
    fixedBeforeDownload: parseInt(fixedBeforeDownloadInput.value, 10) || 3,
    fixedAfterDownload: parseInt(fixedAfterDownloadInput.value, 10) || 2,
    minBeforeDownload: parseInt(minBeforeDownloadInput.value, 10) || 2,
    maxBeforeDownload: parseInt(maxBeforeDownloadInput.value, 10) || 5,
    minAfterDownload: parseInt(minAfterDownloadInput.value, 10) || 1,
    maxAfterDownload: parseInt(maxAfterDownloadInput.value, 10) || 3
  };
  
  // Validasi
  if (config.intervalFixed < 5) config.intervalFixed = 5;
  if (config.intervalMin < 5) config.intervalMin = 5;
  if (config.intervalMax < config.intervalMin) config.intervalMax = config.intervalMin;
  if (config.maxRepeats < 1) config.maxRepeats = 1;
  
  chrome.runtime.sendMessage({ action: 'setConfig', config }, response => {
    if (response && response.success) {
      // Update local state
      Object.assign(state, config);
      updateUI();
      
      // Show success message
      alert('Pengaturan berhasil disimpan');
    }
  });
}

// Fungsi untuk membersihkan log
function clearLogs() {
  chrome.runtime.sendMessage({ action: 'clearLogs' }, response => {
    if (response && response.success) {
      state.logs = [];
      updateUI();
    }
  });
}

// Fungsi untuk mengubah tab aktif
function switchTab(tabId) {
  // Nonaktifkan semua tab
  tabButtons.forEach(btn => btn.classList.remove('active'));
  tabPanes.forEach(pane => pane.classList.remove('active'));
  
  // Aktifkan tab yang dipilih
  document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
  document.getElementById(`${tabId}-tab`).classList.add('active');
}

// Event Listeners

// Tab switching
tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    switchTab(btn.dataset.tab);
  });
});

// Interval type switching
intervalTypeRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    state.intervalType = radio.value;
    updateUI();
  });
});

// Download interval type switching
downloadIntervalTypeRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    state.downloadIntervalType = radio.value;
    updateUI();
  });
});

// Auto download toggle
autoDownloadCheckbox.addEventListener('change', () => {
  state.autoDownloadImages = autoDownloadCheckbox.checked;
  updateUI();
});

// Start button
startBtn.addEventListener('click', startAutomation);

// Stop button
stopBtn.addEventListener('click', stopAutomation);

// Excel file input
excelFileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  fileNameDisplay.textContent = file.name;
  
  try {
    const prompts = await readExcelFile(file);
    
    if (prompts.length === 0) {
      alert('Tidak ada prompt yang ditemukan dalam file Excel.');
      return;
    }
    
    // Simpan prompts ke storage
    chrome.runtime.sendMessage({ action: 'setPrompts', prompts }, response => {
      if (response && response.success) {
        state.prompts = prompts;
        state.currentPromptIndex = 0;
        state.currentRepeatCount = 0;
        updateUI();
      }
    });
    
    // Simpan file ke storage untuk dimuat ulang nanti
    const reader = new FileReader();
    reader.onload = function(e) {
      const fileData = e.target.result;
      chrome.storage.local.set({ lastExcelFile: { name: file.name, data: fileData } });
    };
    reader.readAsDataURL(file);
    
  } catch (error) {
    alert(`Error: ${error.message}`);
    console.error(error);
  }
});

// Save settings button
saveSettingsBtn.addEventListener('click', saveSettings);

// Clear logs button
clearLogsBtn.addEventListener('click', clearLogs);

// Listener untuk pesan dari background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'statusUpdate') {
    state.status = message.status;
    updateUI();
  } else if (message.action === 'timeUpdate') {
    state.timeRemaining = message.timeRemaining;
    timerDisplay.textContent = formatTime(state.timeRemaining);
  }
});

// Inisialisasi: Muat state dari background script
chrome.runtime.sendMessage({ action: 'getState' }, response => {
  if (response && response.state) {
    state = response.state;
    updateUI();
  }
});

// Muat file Excel terakhir jika ada
chrome.storage.local.get(['lastExcelFile'], result => {
  if (result.lastExcelFile) {
    fileNameDisplay.textContent = result.lastExcelFile.name;
  }
});