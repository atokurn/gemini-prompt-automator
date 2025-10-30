// background.js - Service worker untuk ekstensi Chrome

// State global untuk ekstensi
let state = {
  status: 'idle', // idle, sending, waiting, error, done
  prompts: [],
  currentPromptIndex: 0,
  currentRepeatCount: 0,
  maxRepeats: 1,
  enableGlobalRepeat: true,
  intervalType: 'fixed', // fixed atau random
  intervalFixed: 30, // dalam detik
  intervalMin: 10, // dalam detik
  intervalMax: 60, // dalam detik
  autoDownloadImages: true,
  downloadIntervalType: 'fixed',
  fixedBeforeDownload: 3,
  fixedAfterDownload: 2,
  minBeforeDownload: 2,
  maxBeforeDownload: 5,
  minAfterDownload: 1,
  maxAfterDownload: 3,
  timerId: null,
  timeRemaining: 0,
  lastError: null,
  logs: [],
  isRunning: false
};

// Inisialisasi state dari storage
chrome.storage.local.get(['automatorState'], (result) => {
  if (result.automatorState) {
    state = { ...state, ...result.automatorState };
    // Reset status ke idle saat startup
    state.status = 'idle';
    state.isRunning = false;
    state.timerId = null;
    saveState();
  }
});

// Fungsi untuk menyimpan state ke storage
function saveState() {
  // Simpan semua kecuali timerId yang tidak bisa diserialisasi
  const stateToSave = { ...state };
  delete stateToSave.timerId;
  
  chrome.storage.local.set({ automatorState: stateToSave });
}

// Fungsi untuk menambahkan log
function addLog(message) {
  const timestamp = new Date().toISOString();
  state.logs.unshift({ timestamp, message });
  
  // Batasi jumlah log yang disimpan
  if (state.logs.length > 100) {
    state.logs = state.logs.slice(0, 100);
  }
  
  saveState();
}

// Fungsi untuk mengubah status
function setStatus(newStatus, errorMessage = null) {
  const oldStatus = state.status;
  state.status = newStatus;
  
  if (newStatus === 'error' && errorMessage) {
    state.lastError = errorMessage;
    addLog(`Error: ${errorMessage}`);
  } else {
    addLog(`Status berubah: ${oldStatus} -> ${newStatus}`);
  }
  
  // Broadcast perubahan status ke semua listener
  chrome.runtime.sendMessage({ action: 'statusUpdate', status: newStatus });
  saveState();
}

// Fungsi untuk mendapatkan interval waktu dasar antar prompt
function getBasePromptInterval() {
  if (state.intervalType === 'fixed') {
    return state.intervalFixed * 1000; // Konversi ke milidetik
  } else {
    // Random interval antara min dan max
    return (Math.floor(Math.random() * (state.intervalMax - state.intervalMin + 1)) + state.intervalMin) * 1000;
  }
}

// Fungsi untuk mendapatkan interval waktu berikutnya (mungkin masih digunakan oleh popup atau bagian lain)
// Untuk penjadwalan prompt utama, gunakan getBasePromptInterval setelah download cycle selesai.
function getNextInterval() {
  // Jika auto download aktif, interval ini mencerminkan total durasi siklus download (untuk tampilan UI misalnya)
  if (state.autoDownloadImages) {
    if (state.downloadIntervalType === 'fixed') {
      const beforeTime = (state.fixedBeforeDownload || 3) * 1000;
      const afterTime = (state.fixedAfterDownload || 2) * 1000;
      return beforeTime + afterTime + getBasePromptInterval(); // Total siklus + interval dasar berikutnya
    } else {
      const minBefore = Math.max(1, state.minBeforeDownload || 2);
      const maxBefore = Math.max(minBefore, state.maxBeforeDownload || 5);
      const minAfter = Math.max(1, state.minAfterDownload || 1);
      const maxAfter = Math.max(minAfter, state.maxAfterDownload || 3);
      const randomBefore = Math.floor(Math.random() * (maxBefore - minBefore + 1) + minBefore) * 1000;
      const randomAfter = Math.floor(Math.random() * (maxAfter - minAfter + 1) + minAfter) * 1000;
      return randomBefore + randomAfter + getBasePromptInterval(); // Total siklus + interval dasar berikutnya
    }
  }
  // Jika auto download tidak aktif, sama dengan base interval
  return getBasePromptInterval();
}

// Fungsi untuk ping content script dengan retry
async function pingContentScript(tabId, retryCount = 0, maxRetries = 3) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout: Content script tidak merespons dalam 5 detik'));
    }, 5000);
    
    try {
      console.log(`Mencoba ping content script di tab ${tabId} (percobaan ${retryCount + 1}/${maxRetries + 1})`);
      
      // Periksa apakah tab masih ada dan aktif
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          console.error(`Tab ${tabId} tidak ditemukan:`, chrome.runtime.lastError.message);
          reject(new Error(`Tab tidak ditemukan: ${chrome.runtime.lastError.message}`));
          return;
        }
        
        if (!tab || tab.status !== 'complete') {
          console.log(`Tab ${tabId} belum selesai loading, menunggu...`);
          if (retryCount < maxRetries) {
            setTimeout(() => {
              pingContentScript(tabId, retryCount + 1, maxRetries)
                .then(resolve)
                .catch(reject);
            }, 1000);
          } else {
            reject(new Error('Tab tidak selesai loading dalam waktu yang ditentukan'));
          }
          return;
        }
        
        // Kirim pesan ke content script
        chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
          clearTimeout(timeout);
          
          if (chrome.runtime.lastError) {
            const errorMessage = chrome.runtime.lastError.message || 'Unknown error';
            console.error(`Error saat ping content script di tab ${tabId}: ${errorMessage}`);
            
            // Jika error menunjukkan koneksi terputus dan masih dalam batas retry
            // atau jika errornya adalah 'Receiving end does not exist', kita coba inject ulang
            if (retryCount < maxRetries) {
              if (errorMessage.includes('Receiving end does not exist')) {
                // Langsung coba inject ulang jika receiving end tidak ada
                console.log(`Error 'Receiving end does not exist', mencoba inject ulang content script ke tab ${tabId}`);
                chrome.scripting.executeScript({
                  target: { tabId: tabId },
                  files: ['content.js']
                }, () => {
                  if (chrome.runtime.lastError) {
                    addLog(`Error: Tidak dapat inject content script: ${chrome.runtime.lastError.message}`);
                    reject(new Error(`Content script tidak dapat diinjeksi: ${chrome.runtime.lastError.message}`));
                  } else {
                    console.log(`Content script berhasil diinjeksi ulang ke tab ${tabId}`);
                    // Coba ping lagi setelah inject
                    setTimeout(() => {
                      chrome.tabs.sendMessage(tabId, { action: 'ping' }, (responseAfterReinject) => {
                        if (chrome.runtime.lastError || !responseAfterReinject || !responseAfterReinject.success) {
                          reject(new Error('Content script masih tidak merespons setelah inject ulang'));
                        } else {
                          resolve(true);
                        }
                      });
                    }, 500);
                  }
                });
                return; // Keluar dari blok if ini karena sudah ditangani
              }
              // Untuk error lain, coba ping kembali
              console.log(`Mencoba kembali ping dalam ${(retryCount + 1) * 1000}ms...`);
              setTimeout(() => {
                pingContentScript(tabId, retryCount + 1, maxRetries)
                  .then(resolve)
                  .catch(reject);
              }, (retryCount + 1) * 1000);
            } else { // Ini adalah else untuk if (retryCount < maxRetries)
              // Jika sudah mencapai batas retry atau error fatal (selain 'Receiving end does not exist' yang sudah ditangani)
              // atau jika errornya bukan 'Receiving end does not exist' dan sudah max retries
              console.log(`Batas retry tercapai atau error fatal lain untuk ping ke tab ${tabId}. Mencoba inject ulang sebagai upaya terakhir.`);
              // Jika sudah mencapai batas retry atau error fatal
              console.log(`Mencoba inject ulang content script ke tab ${tabId}`);
              chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
              }, () => {
                if (chrome.runtime.lastError) {
                  addLog(`Error: Tidak dapat inject content script: ${chrome.runtime.lastError.message}`);
                  reject(new Error(`Content script tidak dapat diinjeksi: ${chrome.runtime.lastError.message}`));
                } else {
                  console.log(`Content script berhasil diinjeksi ulang ke tab ${tabId}`);
                  // Coba ping lagi setelah inject
                  setTimeout(() => {
                    chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
                      if (chrome.runtime.lastError || !response || !response.success) {
                        reject(new Error('Content script masih tidak merespons setelah inject ulang'));
                      } else {
                        resolve(true);
                      }
                    });
                  }, 500);
                }
              });
            }
          } else if (response && response.success) {
            console.log(`Content script aktif di tab ${tabId}: ${response.message || 'OK'}`);
            resolve(true);
          } else {
            console.error(`Content script merespons dengan data tidak valid di tab ${tabId}:`, response);
            
            // Jika respons tidak valid dan masih dalam batas retry
            if (retryCount < maxRetries) {
              console.log(`Mencoba kembali ping dalam ${(retryCount + 1) * 1000}ms...`);
              setTimeout(() => {
                pingContentScript(tabId, retryCount + 1, maxRetries)
                  .then(resolve)
                  .catch(reject);
              }, (retryCount + 1) * 1000);
            } else {
              addLog(`Error: Respons tidak valid dari content script di tab ${tabId}`);
              reject(new Error('Content script tidak merespons dengan benar'));
            }
          }
        });
      });
    } catch (error) {
      clearTimeout(timeout);
      const errorMessage = error.message || 'Unknown error';
      console.error(`Exception saat ping content script di tab ${tabId}:`, errorMessage);
      
      // Jika terjadi exception dan masih dalam batas retry
      if (retryCount < maxRetries) {
        console.log(`Mencoba kembali ping dalam ${(retryCount + 1) * 1000}ms...`);
        setTimeout(() => {
          pingContentScript(tabId, retryCount + 1, maxRetries)
            .then(resolve)
            .catch(reject);
        }, (retryCount + 1) * 1000);
      } else {
        addLog(`Error: Exception saat menghubungi content script di tab ${tabId}: ${errorMessage}`);
        reject(new Error(`Exception saat ping content script: ${errorMessage}`));
      }
    }
  });
}

// Fungsi untuk mencari tab Gemini yang terbuka
async function findGeminiTabs() {
  try {
    console.log('Mencari tab Gemini...');
    // Dapatkan semua tab yang terbuka
    const allTabs = await chrome.tabs.query({});
    console.log(`Total tab terbuka: ${allTabs.length}`);
    
    // Filter tab Gemini
    const geminiTabs = allTabs.filter(tab => {
      const isGeminiTab = tab.url && tab.url.includes('gemini.google.com');
      console.log(`Tab ${tab.id}: ${tab.url} - ${isGeminiTab ? 'Gemini' : 'Bukan Gemini'}`);
      return isGeminiTab;
    });
    
    console.log(`Tab Gemini ditemukan: ${geminiTabs.length}`);
    return geminiTabs;
  } catch (error) {
    console.error('Error saat mencari tab Gemini:', error);
    return [];
  }
}

// Fungsi untuk memproses prompt berikutnya
async function processNextPrompt() {
  if (!state.isRunning || state.prompts.length === 0) {
    setStatus('idle');
    return;
  }
  
  // Ambil prompt saat ini
  const currentPrompt = state.prompts[state.currentPromptIndex];
  
  // Ubah status ke sending
  setStatus('sending');
  
  try {
    console.log('Memproses prompt:', currentPrompt);
    
    // Cari tab Gemini yang aktif
    const tabs = await findGeminiTabs();
    console.log(`Ditemukan ${tabs.length} tab Gemini`);
    
    if (tabs.length === 0) {
      throw new Error('Tidak ada tab Gemini yang terbuka. Buka tab Gemini terlebih dahulu.');
    }
    
    // Coba kirim pesan ke semua tab Gemini yang terbuka sampai berhasil
    let messageSuccess = false;
    let lastError = null;
    
    for (const tab of tabs) {
      try {
        // Pastikan tab masih ada dan dapat diakses
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => true
        });
        
        // Cek apakah content script aktif dengan ping
        let contentScriptReady = false;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (!contentScriptReady && retryCount < maxRetries) {
          try {
            await pingContentScript(tab.id);
            console.log(`Content script aktif di tab ${tab.id}`);
            contentScriptReady = true;
          } catch (pingError) {
            retryCount++;
            console.warn(`Content script tidak aktif di tab ${tab.id} (percobaan ${retryCount}/${maxRetries}), mencoba injeksi ulang...`);
            
            if (retryCount >= maxRetries) {
              throw new Error(`Content script tidak dapat diaktifkan di tab ${tab.id} setelah ${maxRetries} percobaan: ${pingError.message}`);
            }
            
            try {
              // Coba injeksi content script dengan pendekatan function injection
              console.log(`Menginjeksi content script ke tab ${tab.id}...`);
              
              // Injeksi listener pesan terlebih dahulu
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                  // Hapus listener lama jika ada
                  if (window._geminiAutomatorCleanup) {
                    window._geminiAutomatorCleanup();
                  }
                  
                  // Setup listener baru
                  const messageListener = (message, sender, sendResponse) => {
                    console.log('Content script menerima pesan:', message);
                    
                    if (message.action === 'ping') {
                      console.log('Menerima ping dari background script');
                      sendResponse({ success: true, message: 'Content script aktif' });
                      return true;
                    }
                    
                    if (message.action === 'insertPrompt') {
                      // Handle insert prompt
                      const prompt = message.prompt;
                      console.log('Mencoba memasukkan prompt:', prompt);
                      
                      try {
                        // Cari textarea dengan berbagai selector
                        const selectors = [
                          'rich-textarea div.ql-editor',
                          'div.ql-editor[contenteditable="true"]',
                          'textarea[aria-label*="message" i]',
                          'textarea[aria-label*="pesan" i]',
                          'div[contenteditable="true"]',
                          'textarea.message-input'
                        ];
                        
                        let textarea = null;
                        for (const selector of selectors) {
                          const element = document.querySelector(selector);
                          if (element) {
                            textarea = element;
                            console.log('Textarea ditemukan dengan selector:', selector);
                            break;
                          }
                        }
                        
                        if (!textarea) {
                          throw new Error('Textarea tidak ditemukan');
                        }
                        
                        // Masukkan prompt
                        if (textarea.tagName.toLowerCase() === 'textarea') {
                          textarea.value = prompt;
                          textarea.dispatchEvent(new Event('input', { bubbles: true }));
                        } else {
                          textarea.textContent = prompt;
                          textarea.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                        
                        // Cari dan klik tombol kirim
                        setTimeout(() => {
                          const sendSelectors = [
                            'button[aria-label*="send" i]',
                            'button[aria-label*="kirim" i]',
                            'button[data-testid="send-button"]',
                            'button:has(svg)'
                          ];
                          
                          let sendButton = null;
                          for (const selector of sendSelectors) {
                            const element = document.querySelector(selector);
                            if (element && !element.disabled) {
                              sendButton = element;
                              break;
                            }
                          }
                          
                          if (sendButton) {
                            sendButton.click();
                            console.log('Tombol kirim berhasil diklik');
                            sendResponse({ success: true });
                          } else {
                            sendResponse({ success: false, error: 'Tombol kirim tidak ditemukan' });
                          }
                        }, 1000);
                        
                        return true; // Untuk async response
                        
                      } catch (error) {
                        console.error('Error saat memasukkan prompt:', error);
                        sendResponse({ success: false, error: error.message });
                      }
                    }
                  };
                  
                  // Add listener
                  chrome.runtime.onMessage.addListener(messageListener);
                  
                  // Setup cleanup function
                  window._geminiAutomatorCleanup = () => {
                    chrome.runtime.onMessage.removeListener(messageListener);
                  };
                  
                  console.log('Gemini Prompt Automator content script loaded');
                },
                world: 'ISOLATED'
              });
              
              console.log(`Content script berhasil diinjeksi ke tab ${tab.id}, menunggu inisialisasi...`);
              
              // Tunggu untuk memastikan script dimuat
              await new Promise(resolve => setTimeout(resolve, 1000));
              
            } catch (injectionError) {
              console.error(`Gagal menginjeksi content script ke tab ${tab.id}:`, injectionError);
              if (retryCount >= maxRetries) {
                throw new Error(`Content script tidak dapat diaktifkan di tab ${tab.id}: ${injectionError.message || 'Unknown error'}`);
              }
            }
          }
        }
        
        // Kirim pesan ke content script untuk memasukkan prompt
        const response = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout: Content script tidak merespons dalam 10 detik'));
          }, 10000);
          
          chrome.tabs.sendMessage(tab.id, {
            action: 'insertPrompt',
            prompt: currentPrompt
          }, (result) => {
            clearTimeout(timeout);
            
            if (chrome.runtime.lastError) {
              reject(new Error(`Chrome runtime error: ${chrome.runtime.lastError.message}`));
            } else {
              resolve(result);
            }
          });
        });
        
        if (!response || !response.success) {
          throw new Error(response?.error || 'Respons tidak valid dari content script');
        }
        
        console.log(`Prompt berhasil dikirim ke tab ${tab.id}`);
        messageSuccess = true;
        break; // Keluar dari loop jika berhasil
      } catch (err) {
        lastError = err;
        console.error(`Error saat mengirim pesan ke tab ${tab.id}:`, err);
        // Lanjutkan ke tab berikutnya
      }
    }
    
    if (!messageSuccess) {
      throw new Error(lastError ? `Gagal mengirim pesan ke tab Gemini: ${lastError.message}` : 'Gagal mengirim pesan ke tab Gemini');
    }
    
    // Update status ke waiting
    setStatus('waiting');
    
    // Increment repeat counter
    state.currentRepeatCount++;
    
    // Cek apakah sudah mencapai jumlah pengulangan maksimum untuk prompt ini
    if (state.currentRepeatCount >= state.maxRepeats) {
      state.currentRepeatCount = 0;
      state.currentPromptIndex++;
      
      // Cek apakah sudah mencapai akhir daftar prompt
      if (state.currentPromptIndex >= state.prompts.length) {
        // Jika global repeat diaktifkan, mulai lagi dari awal
        if (state.enableGlobalRepeat) {
          state.currentPromptIndex = 0;
          addLog('Semua prompt telah dijalankan. Memulai ulang dari awal.');
        } else {
          // Jika tidak, hentikan proses
          stopAutomation();
          setStatus('done');
          addLog('Semua prompt telah dijalankan. Otomatisasi selesai.');
          return;
        }
      }
    }
    
    // Jika autoDownloadImages tidak aktif, jadwalkan prompt berikutnya seperti biasa.
    // Jika aktif, kita akan menunggu pesan 'downloadStatus' dari content.js
    if (!state.autoDownloadImages) {
      const baseInterval = getBasePromptInterval();
      state.timeRemaining = Math.floor(baseInterval / 1000);
      broadcastTimeRemaining();
      state.timerId = setTimeout(() => {
        processNextPrompt();
      }, baseInterval);

      // Update countdown timer setiap detik
      const countdownTimer = setInterval(() => {
        if (state.timeRemaining > 0) {
          state.timeRemaining--;
          broadcastTimeRemaining();
        } else {
          clearInterval(countdownTimer);
        }
      }, 1000);
    } else {
      // Status tetap 'waiting' untuk download, tidak ada timer yang diatur di sini.
      // content.js akan mengirim 'downloadStatus' setelah selesai.
      addLog('Menunggu status unduhan dari content script...');
    }
    saveState();
  } catch (error) {
    setStatus('error', error.message);
    
    // Coba lagi setelah interval
    // Tetap jadwalkan prompt berikutnya meskipun error, gunakan interval dasar standar.
    const baseRetryInterval = getBasePromptInterval();
    state.timeRemaining = Math.floor(baseRetryInterval / 1000);
    
    // Broadcast waktu tersisa
    broadcastTimeRemaining();
    
    state.timerId = setTimeout(() => {
      processNextPrompt();
    }, baseRetryInterval);
    
    saveState();
  }
}

// Fungsi untuk broadcast waktu tersisa
function broadcastTimeRemaining() {
  chrome.runtime.sendMessage({
    action: 'timeUpdate',
    timeRemaining: state.timeRemaining
  });
}

// Fungsi untuk memulai otomatisasi
async function startAutomation() {
  // Hanya mulai jika tidak sedang berjalan
  if (state.isRunning) {
    console.log('Otomatisasi sudah berjalan, tidak perlu memulai lagi');
    return;
  }
  
  state.isRunning = true;
  setStatus('waiting');
  addLog('Otomatisasi dimulai');
  
  try {
    // Cek apakah ada tab Gemini yang terbuka
    const geminiTabs = await findGeminiTabs();
    if (geminiTabs.length === 0) {
      throw new Error('Tidak ada tab Gemini yang terbuka. Buka tab Gemini terlebih dahulu.');
    }
    
    console.log(`Memulai otomatisasi dengan ${state.prompts.length} prompts`);
    
    // Mulai proses prompt
    processNextPrompt();
  } catch (error) {
    console.error('Error saat memulai otomatisasi:', error);
    addLog(`Error: ${error.message}`);
    state.isRunning = false;
    setStatus('idle');
  }
}

// Fungsi untuk menghentikan otomatisasi
function stopAutomation() {
  if (!state.isRunning) return;
  
  state.isRunning = false;
  
  if (state.timerId) {
    clearTimeout(state.timerId);
    state.timerId = null;
  }
  
  setStatus('idle');
  addLog('Otomatisasi dihentikan');
  saveState();
}

// Fungsi untuk mengatur prompts dari file Excel
function setPrompts(prompts) {
  if (!prompts || !Array.isArray(prompts)) {
    console.error('Prompts tidak valid:', prompts);
    addLog('Error: Prompts tidak valid');
    return false;
  }
  
  if (prompts.length === 0) {
    console.error('Daftar prompt kosong');
    addLog('Error: Daftar prompt kosong');
    return false;
  }
  
  console.log(`Mengatur ${prompts.length} prompt:`, prompts);
  state.prompts = prompts;
  state.currentPromptIndex = 0;
  state.currentRepeatCount = 0;
  saveState();
  addLog(`${prompts.length} prompt dimuat dari file Excel`);
  return true;
}

// Fungsi untuk mengatur konfigurasi
function setConfig(config) {
  if (!config || typeof config !== 'object') {
    console.error('Konfigurasi tidak valid:', config);
    addLog('Error: Konfigurasi tidak valid');
    return false;
  }
  
  console.log('Mengatur konfigurasi:', config);
  
  // Validasi nilai konfigurasi
  if (config.intervalFixed && config.intervalFixed < 5) config.intervalFixed = 5;
  if (config.intervalMin && config.intervalMin < 5) config.intervalMin = 5;
  if (config.intervalMax && config.intervalMax < config.intervalMin) config.intervalMax = config.intervalMin;
  if (config.maxRepeats && config.maxRepeats < 1) config.maxRepeats = 1;
  
  Object.assign(state, config);
  saveState();
  addLog('Konfigurasi diperbarui');
  return true;
}

// Listener untuk pesan dari popup atau content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'getState':
      sendResponse({ state });
      break;
      
    case 'startAutomation':
      startAutomation();
      sendResponse({ success: true });
      break;
      
    case 'stopAutomation':
      stopAutomation();
      sendResponse({ success: true });
      break;
      
    case 'setPrompts':
      try {
        const success = setPrompts(message.prompts);
        sendResponse({ success });
        if (!success) {
          console.error('Gagal mengatur prompts');
        }
      } catch (error) {
        console.error('Error saat mengatur prompts:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;
      
    case 'setConfig':
      try {
        const success = setConfig(message.config);
        sendResponse({ success });
        if (!success) {
          console.error('Gagal mengatur konfigurasi');
        }
      } catch (error) {
        console.error('Error saat mengatur konfigurasi:', error);
        sendResponse({ success: false, error: error.message });
      }
      break;
      
    case 'clearLogs':
      state.logs = [];
      saveState();
      sendResponse({ success: true });
      break;
    case 'downloadStatus':
      addLog(`Menerima downloadStatus: ${message.status}, detail: ${message.detail || ''}`);
      // Jika autoDownloadImages aktif dan statusnya completed, skipped, atau error, jadwalkan prompt berikutnya.
      if (state.autoDownloadImages && ['completed', 'skipped', 'error_download', 'no_button', 'stop_button_timeout'].includes(message.status)) {
        const baseInterval = getBasePromptInterval();
        state.timeRemaining = Math.floor(baseInterval / 1000);
        broadcastTimeRemaining();
        state.timerId = setTimeout(() => {
          processNextPrompt();
        }, baseInterval);

        // Update countdown timer setiap detik
        const countdownTimer = setInterval(() => {
          if (state.timeRemaining > 0) {
            state.timeRemaining--;
            broadcastTimeRemaining();
          } else {
            clearInterval(countdownTimer);
          }
        }, 1000);
        saveState();
      }
      sendResponse({ success: true });
      break;

    case 'downloadImage':
      console.log('Menerima permintaan unduh gambar:', message);
      
      // Tambahkan penanganan error koneksi
      if (chrome.runtime.lastError) {
        console.error('Error koneksi saat menerima pesan:', chrome.runtime.lastError);
        addLog(`Error: Koneksi dengan content script: ${chrome.runtime.lastError.message}`);
        try {
          sendResponse({ success: false, error: 'connection_error', message: chrome.runtime.lastError.message });
        } catch (e) {
          console.error('Tidak dapat mengirim respons karena error koneksi:', e);
        }
        break;
      }
      
      if (!message.imageUrl) {
        console.error('URL gambar tidak valid');
        addLog('Error: URL gambar tidak valid');
        try {
          sendResponse({ success: false, error: 'invalid_url', message: 'URL gambar tidak valid' });
        } catch (e) {
          console.error('Tidak dapat mengirim respons:', e);
        }
        break;
      }
      
      if (state.autoDownloadImages) {
        console.log('Auto download gambar aktif, memulai unduhan...');
        try {
          const filename = message.filename || `gemini_image_${Date.now()}.png`;
          
          chrome.downloads.download({
            url: message.imageUrl,
            filename: filename,
            saveAs: false
          }, downloadId => {
            if (chrome.runtime.lastError) {
              console.error('Error saat mengunduh gambar:', chrome.runtime.lastError);
              addLog(`Error: Gagal mengunduh gambar: ${chrome.runtime.lastError.message}`);
              try {
                sendResponse({ success: false, error: 'download_error', message: chrome.runtime.lastError.message });
              } catch (e) {
                console.error('Tidak dapat mengirim respons setelah error download:', e);
              }
            } else {
              console.log('Gambar berhasil diunduh dengan ID:', downloadId);
              addLog(`Gambar diunduh: ${filename}`);
              try {
                sendResponse({ success: true, downloadId, filename });
              } catch (e) {
                console.error('Tidak dapat mengirim respons setelah download berhasil:', e);
              }
            }
          });
        } catch (error) {
          console.error('Exception saat mengunduh gambar:', error);
          addLog(`Error: Exception saat mengunduh gambar: ${error.message}`);
          try {
            sendResponse({ success: false, error: 'exception', message: error.message });
          } catch (e) {
            console.error('Tidak dapat mengirim respons setelah exception:', e);
          }
        }
      } else {
        console.log('Auto download gambar tidak aktif, melewati unduhan');
        try {
          sendResponse({ success: true, skipped: true, message: 'Auto download disabled' });
        } catch (e) {
          console.error('Tidak dapat mengirim respons untuk skip download:', e);
        }
      }
      
      return true; // Untuk mendukung respons asinkron
      break;
  }
  
  return true; // Untuk mendukung respons asinkron
});