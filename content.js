// Content script untuk Gemini Prompt Automator

// Fungsi untuk memasukkan prompt ke textarea Gemini
function insertPromptToGemini(prompt) {
  return new Promise((resolve, reject) => {
    try {
      console.log('Mencoba memasukkan prompt ke Gemini...');
      
      // Kita akan menyuntikkan script ke halaman yang akan menangani input prompt
      const scriptToInject = document.createElement('script');
      scriptToInject.textContent = `
        (function() {
          try {
            console.log("Script injeksi berjalan untuk memasukkan prompt");
            const prompt = ${JSON.stringify(prompt)};
            
            // Cari textarea input Gemini dengan selector yang lebih lengkap
            const textareaSelectors = [
              // Selector spesifik dari element.md
              "#app-root > main > side-navigation-v2 > bard-sidenav-container > bard-sidenav-content > div.content-wrapper > div > div.content-container > chat-window > div > input-container > div > input-area-v2 > div > div > div.text-input-field_textarea-wrapper.ng-tns-c2433840608-3 > div > div > rich-textarea > div.ql-editor.ql-blank.textarea.new-input-ui",
              // Selector generik sebagai fallback
              "textarea[aria-label=\"Pesan Anda\"]", 
              "textarea[aria-label=\"Your message\"]",
              "rich-textarea div.ql-editor",
              "div.ql-editor",
              "textarea.ql-editor",
              "div[contenteditable=\"true\"]",
              "div.ql-editor[contenteditable=\"true\"]",
              "textarea.message-input",
              "div.message-input[contenteditable=\"true\"]",
              "div.textarea.new-input-ui"
              ];
            
            // Coba semua selector sampai menemukan yang cocok
            let textarea = null;
            for (const selector of textareaSelectors) {
              const element = document.querySelector(selector);
              if (element) {
                textarea = element;
                console.log('Textarea ditemukan dengan selector: ' + selector);
                break;
              }
            }
            
            if (!textarea) {
              console.error('Textarea input Gemini tidak ditemukan dengan semua selector yang dicoba');
              document.dispatchEvent(new CustomEvent('gemini-automator-error', { 
                detail: { message: 'Textarea input Gemini tidak ditemukan' } 
              }));
              return;
            }
            
            // Masukkan prompt ke textarea
            if (textarea.tagName.toLowerCase() === 'textarea') {
              // Untuk textarea biasa
              textarea.value = prompt;
              textarea.dispatchEvent(new Event('input', { bubbles: true }));
              textarea.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              // Untuk div contenteditable
              textarea.textContent = prompt;
              textarea.dispatchEvent(new Event('input', { bubbles: true }));
              textarea.dispatchEvent(new Event('change', { bubbles: true }));
            }
            
            console.log('Prompt berhasil dimasukkan ke textarea:', prompt);
            
            // Tunggu sebentar sebelum mencari tombol kirim
            setTimeout(() => {
              // Cari tombol kirim
              const sendButtonSelectors = [
                'button[aria-label="Kirim pesan"]',
                'button[aria-label="Send message"]', 
                'button[data-testid="send-button"]',
                'button.send-button',
                'button[type="submit"]',
                'button:has(svg)',
                'div[role="button"][aria-label*="send"]',
                'div[role="button"][aria-label*="kirim"]',
                'button:contains("Send")',
                'button:contains("Kirim")',
                '[data-mat-icon-name="send"]',
                'button svg[data-testid="send-icon"]',
                'button:has([data-testid="send-icon"])'
              ];
              
              let sendButton = null;
              for (const selector of sendButtonSelectors) {
                const element = document.querySelector(selector);
                if (element && !element.disabled) {
                  sendButton = element;
                  console.log('Tombol kirim ditemukan dengan selector:', selector);
                  break;
                }
              }
              
              if (!sendButton) {
                console.error('Tombol kirim tidak ditemukan');
                document.dispatchEvent(new CustomEvent('gemini-automator-error', { 
                  detail: { message: 'Tombol kirim tidak ditemukan' } 
                }));
                return;
              }
              
              // Klik tombol kirim
              sendButton.click();
              console.log('Tombol kirim berhasil diklik');
              
              // Dispatch event sukses
              document.dispatchEvent(new CustomEvent('gemini-automator-success', { 
                detail: { message: 'Prompt berhasil dikirim' } 
              }));
            }, 500);
          } catch (error) {
            console.error('Error dalam script injeksi:', error);
            document.dispatchEvent(new CustomEvent('gemini-automator-error', { 
              detail: { message: error.message } 
            }));
          }
        })();
      `;
      
      let isResolved = false;
      
      const handleSuccess = () => {
        if (isResolved) return;
        isResolved = true;
        console.log('Prompt berhasil dimasukkan dan dikirim');
        document.removeEventListener('gemini-automator-success', handleSuccess);
        document.removeEventListener('gemini-automator-error', handleError);
        
        // Tunggu sebentar untuk memastikan prompt terkirim
        setTimeout(() => {
          resolve();
          
          // Mulai pemantauan gambar setelah mengirim prompt
          // Modifikasi: Panggil fungsi baru untuk menunggu tombol stop hilang
          waitForStopButtonAndDownload(); 
        }, 1000);
      };
      
      const handleError = (event) => {
        if (isResolved) return;
        isResolved = true;
        const errorMessage = event.detail?.message || 'Unknown error';
        console.error('Error saat memasukkan prompt:', errorMessage);
        document.removeEventListener('gemini-automator-success', handleSuccess);
        document.removeEventListener('gemini-automator-error', handleError);
        reject(new Error(errorMessage));
      };
      
      document.addEventListener('gemini-automator-success', handleSuccess);
      document.addEventListener('gemini-automator-error', handleError);
      
      // Injeksi script ke halaman
      document.head.appendChild(scriptToInject);
      
      // Hapus script setelah dijalankan
      setTimeout(() => {
        if (scriptToInject.parentNode) {
          scriptToInject.parentNode.removeChild(scriptToInject);
        }
      }, 100);
      
      // Set timeout untuk menangani kasus di mana script tidak merespons
      setTimeout(() => {
        if (isResolved) return;
        isResolved = true;
        document.removeEventListener('gemini-automator-success', handleSuccess);
        document.removeEventListener('gemini-automator-error', handleError);
        reject(new Error('Timeout saat memasukkan prompt'));
      }, 10000); // 10 detik timeout
    } catch (error) {
      console.error('Error saat mencoba memasukkan prompt:', error);
      reject(error);
    }
  });
}

// Variabel untuk melacak gambar yang sudah diunduh
let processedImages = new Set();

// Fungsi untuk menunggu tombol stop hilang lalu mengunduh gambar
async function waitForStopButtonAndDownload(retryCount = 0) {
  console.log('Memulai proses menunggu tombol stop hilang dan unduh gambar...');

  const maxRetries = 5; // Jumlah maksimal percobaan untuk menemukan tombol stop/download
  const retryDelay = 2000; // Jeda antar percobaan dalam milidetik

  // Fungsi untuk memeriksa apakah tombol stop masih ada (menandakan Gemini masih generating)
  function isStopButtonPresent() {
    const stopButtonSelectors = [
      // Selector spesifik dari element.md untuk tombol stop Gemini
      '#app-root > main > side-navigation-v2 > bard-sidenav-container > bard-sidenav-content > div.content-wrapper > div > div.content-container > chat-window > div > input-container > div > input-area-v2 > div > div > div.trailing-actions-wrapper.ng-tns-c2433840608-3 > div > div.mat-mdc-tooltip-trigger.send-button-container.ng-tns-c2433840608-3.inner.ng-star-inserted.visible > button > div > mat-icon',
      '#app-root > main > side-navigation-v2 > mat-sidenav-container > mat-sidenav-content > div > div.content-container > chat-window > div > input-container > div > input-area-v2 > div > div > div.trailing-actions-wrapper.ng-tns-c2433840608-3 > div > div.mat-mdc-tooltip-trigger.send-button-container.ng-tns-c2433840608-3.inner.ng-star-inserted.is-mobile-device.visible > button > span.mat-mdc-button-persistent-ripple.mdc-icon-button__ripple',
      '#app-root > main > side-navigation-v2 > mat-sidenav-container > mat-sidenav-content > div > div.content-container > chat-window > div > input-container > div > input-area-v2 > div > div > div.trailing-actions-wrapper.ng-tns-c2433840608-3 > div > div.mat-mdc-tooltip-trigger.send-button-container.ng-tns-c2433840608-3.inner.ng-star-inserted.is-mobile-device.visible.disabled > button',
      
      // Selector umum untuk tombol stop (bisa ditambahkan jika perlu)
      'button[aria-label*="Stop"]',
      'button[aria-label*="Hentikan"]',
      'button[data-testid="stop-button"]',
      // Indikator loading juga bisa dianggap sebagai "stop button" aktif
      '.loading',
      '.generating',
      '.spinner',
      '[aria-label*="generating"]',
      '[aria-label*="loading"]',
      '.mat-progress-spinner',
    ];
    
    for (const selector of stopButtonSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          for (const element of elements) {
            const style = window.getComputedStyle(element);
            if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
              console.log('Tombol stop/loading terdeteksi dengan selector:', selector);
              return true;
            }
          }
        }
      } catch (e) { /* Abaikan error selector tidak valid */ }
    }
    console.log('Tidak ada tombol stop/loading yang terdeteksi.');
    return false;
  }

  if (isStopButtonPresent()) {
    console.log('Tombol stop/loading masih ada. Menunggu...');
    if (retryCount < 15) { // Tambahkan batas retry untuk menunggu tombol stop hilang (misal 30 detik)
        setTimeout(() => waitForStopButtonAndDownload(retryCount + 1), retryDelay);
    } else {
        console.error('Batas waktu menunggu tombol stop hilang tercapai. Proses unduh dibatalkan.');
        // Kirim pesan ke background jika gagal
        chrome.runtime.sendMessage({ action: "downloadImageStatus", status: "error", message: "Gagal menunggu tombol stop hilang." });
    }
    return;
  }

  console.log('Tombol stop/loading tidak terdeteksi. Memberi jeda 2 detik sebelum mencari tombol download.');
  await new Promise(resolve => setTimeout(resolve, 2000)); // Jeda 2 detik

  // Panggil fungsi untuk mencari dan mengklik tombol download dengan logika retry
  await findAndClickDownloadButtonWithRetry();
}

// Fungsi untuk mencari dan mengklik tombol download dengan logika retry
async function findAndClickDownloadButtonWithRetry(attempt = 0) {
  const maxAttempts = 5;
  const delayBetweenAttempts = 2000; // Jeda 2 detik antar percobaan

  console.log(`Mencoba mencari tombol download (percobaan ${attempt + 1}/${maxAttempts})`);

  // Fungsi untuk mengunduh gambar menggunakan tombol download native
  async function downloadGeneratedImagesInternal() {
    try {
      console.log('Memulai proses download gambar internal...');
      
      // Reset daftar gambar yang sudah diproses untuk setiap upaya baru
      processedImages.clear(); 

      // Cari semua gambar yang dihasilkan (gunakan selector yang lebih umum jika perlu)
      const images = document.querySelectorAll('img[src*="googleusercontent.com"], img[src*="gemini"], img[alt*="Generated"], img[alt*="Image"]');
      
      if (images.length === 0) {
        console.log('Tidak ada gambar yang dihasilkan ditemukan pada percobaan ini.');
        return false; // Kembalikan false jika tidak ada gambar
      }
      
      console.log(`Ditemukan ${images.length} gambar potensial yang dihasilkan`);
      let downloadedAtLeastOne = false;
      
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        
        if (processedImages.has(img.src)) {
          console.log(`Melewati gambar ${i + 1} - sudah diproses: ${img.src}`);
          continue;
        }
        
        // Lewati jika gambar terlalu kecil (kemungkinan elemen UI)
        // Periksa naturalWidth dan naturalHeight setelah gambar dimuat
        await new Promise(resolve => {
            if (img.complete) resolve();
            else img.onload = img.onerror = resolve;
        });
        if (img.naturalWidth < 50 || img.naturalHeight < 50) {
          console.log(`Melewati gambar kecil ${i + 1} (${img.naturalWidth}x${img.naturalHeight})`);
          continue;
        }
        
        try {
          img.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(r => setTimeout(r, 500));
          
          let downloadButton = null;
          console.log(`Mencari tombol download untuk gambar ${i + 1}`);
          
          let parent = img.closest('div[jsmodel]'); // Cari parent yang lebih relevan
          if (!parent) parent = img.parentElement;

          for (let level = 0; level < 7 && parent; level++) { // Tingkatkan level pencarian
            // Gunakan pendekatan pencarian tombol download yang lebih komprehensif
            
            // Gunakan selector spesifik yang diberikan user
            const specificSelector = '#model-response-message-contentr_65d95208b040de17 > p:nth-child(2) > div > response-element > generated-image > single-image > div > div > div > download-generated-image-button > button > span.mdc-button__label > div > mat-icon';
            
            // 1. Coba selector spesifik terlebih dahulu
            try {
              const specificElement = parent.querySelector(specificSelector);
              if (specificElement) {
                downloadButton = specificElement.closest('button');
                if (downloadButton && !downloadButton.disabled) {
                  console.log(`Ditemukan tombol download via selector spesifik di level ${level}`);
                }
              }
            } catch (e) {
              console.log('Error dengan selector spesifik:', e.message);
            }
            
            // 2. Fallback ke pencarian berdasarkan mat-icon dengan fonticon download
            if (!downloadButton) {
              const downloadIcons = parent.querySelectorAll(
                'mat-icon[fonticon="download"], ' +
                '.mat-icon[data-mat-icon-name="download"]'
              );
              
              if (downloadIcons.length > 0) {
                console.log(`Ditemukan ${downloadIcons.length} ikon download di level ${level}`);
                
                for (const icon of downloadIcons) {
                  // Cari button parent dari ikon
                  const buttonParent = icon.closest('button');
                  if (buttonParent && !buttonParent.disabled) {
                    downloadButton = buttonParent;
                    console.log(`Ditemukan tombol download via pencarian ikon di level ${level}`);
                    break;
                  }
                }
              }
            }
            
            // 3. Cari komponen download-generated-image-button
            if (!downloadButton) {
              const downloadComponent = parent.querySelector('download-generated-image-button');
              if (downloadComponent) {
                const btn = downloadComponent.querySelector('button');
                if (btn && !btn.disabled) {
                  downloadButton = btn;
                  console.log(`Ditemukan tombol download via komponen di level ${level}`);
                }
              }
            }
            
            // 4. Cari berdasarkan atribut aria-label atau mattooltip
            if (!downloadButton) {
              downloadButton = parent.querySelector(
                'button[aria-label*="Download"], ' +
                'button[mattooltip*="Download"], ' +
                'button[data-test-id="download-generated-image-button"]'
              );
              
              if (downloadButton && !downloadButton.disabled) {
                console.log(`Ditemukan tombol download via atribut di level ${level}`);
              }
            }
            if (downloadButton && !downloadButton.disabled) {
              console.log(`Ditemukan tombol download di level ${level} untuk gambar ${i + 1}`);
              break;
            }
            parent = parent.parentElement;
          }
          
          if (downloadButton && !downloadButton.disabled) {
            console.log('Tombol download ditemukan, mencoba mengklik:', downloadButton);
            downloadButton.click();
            processedImages.add(img.src);
            downloadedAtLeastOne = true;
            console.log(\`Gambar \${i + 1} berhasil diklik untuk diunduh: \${img.src}\`);
            await new Promise(r => setTimeout(r, 1000)); // Jeda antar unduhan
          } else {
            console.log(\`Tombol download tidak ditemukan untuk gambar \${i + 1} - melewati tanpa fallback\`);
          }
        } catch (e) {
          console.error(\`Error saat memproses gambar \${i + 1}: \${e.message}\`, e);
        }
      }
      
      if (downloadedAtLeastOne) {
        console.log('Setidaknya satu gambar berhasil diunduh pada percobaan ini.');
        chrome.runtime.sendMessage({ action: "downloadImageStatus", status: "success", message: "Gambar berhasil diunduh." });
        return true; // Kembalikan true jika berhasil mengunduh
      } else {
        console.log('Tidak ada tombol download yang bisa diklik pada percobaan ini.');
        return false; // Kembalikan false jika tidak ada yang diunduh
      }

    } catch (error) {
      console.error('Error dalam downloadGeneratedImagesInternal:', error);
      return false; // Kembalikan false jika terjadi error
    }
  }

  const success = await downloadGeneratedImagesInternal();

  if (success) {
    console.log('Proses unduh berhasil.');
  } else if (attempt < maxAttempts - 1) {
    console.log(`Tombol download tidak ditemukan atau gagal, mencoba lagi dalam ${delayBetweenAttempts / 1000} detik...`);
    setTimeout(() => findAndClickDownloadButtonWithRetry(attempt + 1), delayBetweenAttempts);
  } else {
    console.error('Gagal menemukan atau mengklik tombol download setelah beberapa percobaan.');
    // Kirim pesan ke background jika gagal
    chrome.runtime.sendMessage({ action: "downloadImageStatus", status: "error", message: "Gagal menemukan tombol download setelah beberapa percobaan." });
  }
}


// Fungsi untuk memantau gambar yang muncul dalam respons Gemini (FUNGSI LAMA, BISA DIHAPUS ATAU DIREFACTOR)
function startImageMonitoring() {
  console.log('Memulai pemantauan gambar...');
  // Reset daftar gambar yang sudah diproses untuk respons baru
  processedImages.clear();

  // Periksa status auto download sebelum memulai pemantauan dengan retry
  const checkStateWithRetry = (retryCount = 0, maxRetries = 3) => {
    console.log(`Mengecek state auto download (percobaan ${retryCount + 1}/${maxRetries + 1})`);
    
    chrome.runtime.sendMessage({action: 'getState'}, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error saat mengecek state:', chrome.runtime.lastError);
        
        if (retryCount < maxRetries) {
          console.log(`Mencoba kembali dalam ${(retryCount + 1) * 500}ms...`);
          setTimeout(() => checkStateWithRetry(retryCount + 1, maxRetries), (retryCount + 1) * 500);
        } else {
          console.log('Gagal mengecek state setelah beberapa percobaan, memulai pemantauan dengan asumsi auto download aktif');
          startActualMonitoring();
        }
      } else if (response && response.state) {
        if (response.state.autoDownloadImages) {
          console.log('Auto download aktif, memulai pemantauan gambar');
          startActualMonitoring();
        } else {
          console.log('Auto download tidak aktif, tetap memulai pemantauan untuk fallback');
          startActualMonitoring();
        }
      } else {
        console.log('Respons state tidak valid, memulai pemantauan dengan asumsi auto download aktif');
        startActualMonitoring();
      }
    });
  };
  
  checkStateWithRetry();
  
  function startActualMonitoring() {
    // Implementasi auto download yang lebih mirip dengan referensi
    const scriptToInject = document.createElement('script');
    scriptToInject.textContent = `
      (function() {
        try {
          console.log("Script pemantauan gambar berjalan dengan implementasi baru");
          
          // Set untuk melacak gambar yang sudah diunduh
          const downloadedImages = new Set();
          
          // Fungsi untuk menunggu gambar selesai dimuat
          function waitForImageLoad(img) {
            return new Promise((resolve, reject) => {
              if (img.complete && img.naturalWidth > 0) {
                resolve();
                return;
              }
              
              const timeout = setTimeout(() => {
                reject(new Error('Image load timeout'));
              }, 5000);
              
              img.onload = () => {
                clearTimeout(timeout);
                resolve();
              };
              
              img.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('Image failed to load'));
              };
            });
          }
          
          // Fungsi untuk memeriksa apakah tombol stop masih ada (menandakan Gemini masih generating)
          function isStopButtonPresent() {
            const stopButtonSelectors = [
              // Selector spesifik dari element.md untuk tombol stop Gemini
              '#app-root > main > side-navigation-v2 > bard-sidenav-container > bard-sidenav-content > div.content-wrapper > div > div.content-container > chat-window > div > input-container > div > input-area-v2 > div > div > div.trailing-actions-wrapper.ng-tns-c2433840608-3 > div > div.mat-mdc-tooltip-trigger.send-button-container.ng-tns-c2433840608-3.inner.ng-star-inserted.visible > button > div > mat-icon',
              '#app-root > main > side-navigation-v2 > mat-sidenav-container > mat-sidenav-content > div > div.content-container > chat-window > div > input-container > div > input-area-v2 > div > div > div.trailing-actions-wrapper.ng-tns-c2433840608-3 > div > div.mat-mdc-tooltip-trigger.send-button-container.ng-tns-c2433840608-3.inner.ng-star-inserted.is-mobile-device.visible > button > span.mat-mdc-button-persistent-ripple.mdc-icon-button__ripple',
              '#app-root > main > side-navigation-v2 > mat-sidenav-container > mat-sidenav-content > div > div.content-container > chat-window > div > input-container > div > input-area-v2 > div > div > div.trailing-actions-wrapper.ng-tns-c2433840608-3 > div > div.mat-mdc-tooltip-trigger.send-button-container.ng-tns-c2433840608-3.inner.ng-star-inserted.is-mobile-device.visible.disabled > button',
              
              // Selector umum untuk tombol stop
              'button[aria-label*="Stop"]',
              'button[aria-label*="Hentikan"]',
              'button[data-testid="stop-button"]',
              'button.stop-button',
              'button:has(mat-icon[fonticon="stop"])',
              'button:has(.mat-icon[data-mat-icon-name="stop"])',
              'button:has(svg[data-testid="stop-icon"])',
              
              // Cari berdasarkan teks atau ikon yang mengindikasikan stop
              'button:has(mat-icon):not([aria-label*="Send"]):not([aria-label*="Kirim"])',
              'div.send-button-container button:not([disabled])',
              'button[type="button"]:has(mat-icon):not([aria-label*="Send"])',
              
              // Selector untuk tombol send yang sedang aktif (menandakan sedang mengirim)
              '.send-button-container.visible:not(.disabled)',
              'button[aria-label*="send" i]:not([disabled])',
              'div.trailing-actions-wrapper button:not([disabled])'
            ];
            
            for (const selector of stopButtonSelectors) {
              try {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                  // Periksa apakah elemen benar-benar terlihat dan aktif
                  for (const element of elements) {
                    const style = window.getComputedStyle(element);
                    if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                      console.log('Tombol stop terdeteksi dengan selector:', selector);
                      return true;
                    }
                  }
                }
              } catch (e) {
                // Abaikan error selector yang tidak valid
              }
            }
            
            // Juga periksa apakah ada indikator loading atau generating
            const loadingIndicators = [
              '.loading',
              '.generating',
              '.spinner',
              '[aria-label*="generating"]',
              '[aria-label*="loading"]',
              '.mat-progress-spinner',
              '.progress-indicator',
              '[class*="loading"]',
              '[class*="generating"]'
            ];
            
            for (const selector of loadingIndicators) {
              try {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                  for (const element of elements) {
                    const style = window.getComputedStyle(element);
                    if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                      console.log('Indikator loading terdeteksi dengan selector:', selector);
                      return true;
                    }
                  }
                }
              } catch (e) {
                // Abaikan error selector yang tidak valid
              }
            }
            
            console.log('Tidak ada tombol stop/loading yang ditemukan - aman untuk download');
            return false;
          }
          
          // Fungsi untuk mengunduh gambar menggunakan tombol download native
          async function downloadGeneratedImages() {
            try {
              // Periksa apakah tombol stop masih ada (menandakan Gemini masih generating)
              if (isStopButtonPresent()) {
                console.log('Tombol stop terdeteksi, menunggu Gemini selesai generating...');
                return;
              }
              
              console.log('Tombol stop tidak terdeteksi, memulai proses download gambar...');
              
              // Tunggu sebentar untuk memastikan gambar sudah dimuat
              await new Promise(r => setTimeout(r, 2000));
              
              // Cari semua gambar yang dihasilkan
              const images = document.querySelectorAll('img[src*="googleusercontent.com"], img[src*="gemini"], img[alt*="Generated"], img[alt*="Image"]');
              
              if (images.length === 0) {
                console.log('Tidak ada gambar yang dihasilkan ditemukan');
                return;
              }
              
              console.log(\`Ditemukan \${images.length} gambar potensial yang dihasilkan\`);
              let downloadedCount = 0;
              let skippedCount = 0;
              
              // Proses setiap gambar secara individual
              for (let i = 0; i < images.length; i++) {
                const img = images[i];
                
                // Periksa apakah gambar ini sudah diunduh
                if (downloadedImages.has(img.src)) {
                  console.log(\`Melewati gambar \${i + 1} - sudah diunduh: \${img.src}\`);
                  skippedCount++;
                  continue;
                }
                
                // Lewati jika gambar terlalu kecil (kemungkinan elemen UI)
                if (img.naturalWidth < 100 || img.naturalHeight < 100) {
                  console.log(\`Melewati gambar kecil \${i + 1} (\${img.naturalWidth}x\${img.naturalHeight})\`);
                  continue;
                }
                
                try {
                  // Scroll gambar ke tampilan untuk memicu efek hover
                  img.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  await new Promise(r => setTimeout(r, 500));
                  
                  // Coba cari tombol download di dekat gambar ini
                  let downloadButton = null;
                  console.log(\`Mencari tombol download untuk gambar \${i + 1}\`);
                  
                  // Cari tombol download di container parent gambar
                  let parent = img.parentElement;
                  for (let level = 0; level < 5 && parent; level++) {
                    console.log(\`Memeriksa parent level \${level} untuk gambar \${i + 1}\`);
                    
                    // Gunakan selector spesifik yang diberikan user
                     const specificSelector = '#model-response-message-contentr_65d95208b040de17 > p:nth-child(2) > div > response-element > generated-image > single-image > div > div > div > download-generated-image-button > button > span.mdc-button__label > div > mat-icon';
                     
                     // 1. Coba selector spesifik terlebih dahulu
                     try {
                       const specificElement = parent.querySelector(specificSelector);
                       if (specificElement) {
                         downloadButton = specificElement.closest('button');
                         if (downloadButton && !downloadButton.disabled) {
                           console.log(\`Ditemukan tombol download via selector spesifik di level \${level}\`);
                         }
                       }
                     } catch (e) {
                       console.log('Error dengan selector spesifik:', e.message);
                     }
                     
                     // 2. Fallback ke pencarian berdasarkan mat-icon dengan fonticon download
                     if (!downloadButton) {
                       const downloadIcons = parent.querySelectorAll(
                         'mat-icon[fonticon="download"], ' +
                         '.mat-icon[data-mat-icon-name="download"]'
                       );
                       
                       if (downloadIcons.length > 0) {
                         console.log(\`Ditemukan \${downloadIcons.length} ikon download di level \${level}\`);
                         
                         for (const icon of downloadIcons) {
                           // Cari button parent dari ikon
                           const buttonParent = icon.closest('button');
                           if (buttonParent && !buttonParent.disabled) {
                             downloadButton = buttonParent;
                             console.log(\`Ditemukan tombol download via pencarian ikon di level \${level}\`);
                             break;
                           }
                         }
                       }
                     }
                     
                     // 3. Cari komponen download-generated-image-button
                     if (!downloadButton) {
                       const downloadComponent = parent.querySelector('download-generated-image-button');
                       if (downloadComponent) {
                         const btn = downloadComponent.querySelector('button');
                         if (btn && !btn.disabled) {
                           downloadButton = btn;
                           console.log(\`Ditemukan tombol download via komponen di level \${level}\`);
                         }
                       }
                     }
                     
                     // 4. Cari berdasarkan atribut aria-label atau mattooltip
                     if (!downloadButton) {
                       downloadButton = parent.querySelector(
                         'button[aria-label*="Download"], ' +
                         'button[mattooltip*="Download"], ' +
                         'button[data-test-id="download-generated-image-button"]'
                       );
                       
                       if (downloadButton && !downloadButton.disabled) {
                         console.log(\`Ditemukan tombol download via atribut di level \${level}\`);
                       }
                     }
                    
                    // Jika sudah menemukan tombol download yang valid, keluar dari loop
                    if (downloadButton && !downloadButton.disabled) {
                      console.log(\`Ditemukan tombol download yang valid di level \${level} untuk gambar \${i + 1}\`);
                      break;
                    }
                    
                    parent = parent.parentElement;
                  }
                  
                  // Jika masih belum menemukan tombol download setelah pencarian komprehensif
                  if (!downloadButton) {
                    console.log(\`Tidak ditemukan tombol download untuk gambar \${i + 1} setelah pencarian komprehensif\`);
                  }
                  
                  if (downloadButton && downloadButton.offsetParent !== null && !downloadButton.disabled) {
                    console.log(\`Ditemukan tombol download yang valid untuk gambar \${i + 1}, mencoba mengunduh\`);
                    
                    // Hover di atas gambar untuk memastikan tombol download terlihat
                    img.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                    await new Promise(r => setTimeout(r, 300));
                    
                    // Juga hover di atas container tombol untuk memastikan aktif
                    const buttonContainer = downloadButton.closest('download-generated-image-button') || downloadButton.parentElement;
                    if (buttonContainer) {
                      buttonContainer.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                      await new Promise(r => setTimeout(r, 200));
                    }
                    
                    // Klik tombol download
                    downloadButton.click();
                    console.log(\`Mengunduh gambar \${i + 1} menggunakan tombol native\`);
                    downloadedCount++;
                    
                    // Tambahkan ke set gambar yang sudah diunduh untuk mencegah duplikasi
                    downloadedImages.add(img.src);
                    
                    // Tunggu antar unduhan
                    await new Promise(r => setTimeout(r, 1500));
                  } else {
                    if (downloadButton) {
                      console.log(\`Tombol download ditemukan tapi tidak valid untuk gambar \${i + 1}: offsetParent=\${downloadButton.offsetParent}, disabled=\${downloadButton.disabled}\`);
                    } else {
                      console.log(\`Tidak ada tombol download ditemukan untuk gambar \${i + 1} - melewati tanpa fallback\`);
                    }
                    // Tidak menggunakan fallback, hanya lewati gambar ini
                  }
                  
                } catch (error) {
                  console.error(\`Error memproses gambar \${i + 1}:\`, error);
                  // Tidak menggunakan fallback, hanya lewati gambar ini
                }
              }
              
              console.log(\`Berhasil memproses \${downloadedCount} gambar, melewati \${skippedCount} gambar yang sudah diunduh\`);
              console.log(\`Total gambar unik yang diunduh sejauh ini: \${downloadedImages.size}\`);
              
            } catch (error) {
              console.error('Error dalam downloadGeneratedImages:', error);
              // Tidak menggunakan fallback, hanya log error
            }
          }
          
          // Fungsi untuk mengunduh satu gambar menggunakan metode fallback
          async function downloadSingleImageFallback(img, index) {
            try {
              // Tunggu gambar selesai dimuat
              await waitForImageLoad(img);
              
              // Periksa apakah dimensi gambar valid
              if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                throw new Error('Dimensi gambar tidak valid');
              }
              
              // Coba unduh menggunakan fetch terlebih dahulu (penanganan CORS yang lebih baik)
              try {
                console.log(\`Mencoba unduh fetch untuk gambar \${index}\`);
                const response = await fetch(img.src, {
                  mode: 'cors',
                  credentials: 'omit'
                });
                
                if (response.ok) {
                  const blob = await response.blob();
                  
                  if (blob && blob.size > 0) {
                    // Buat link download
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = \`gemini-generated-image-\${Date.now()}-\${index}.png\`;
                    a.style.display = 'none';
                    
                    // Trigger download
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    
                    // Bersihkan
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    
                    console.log(\`Mengunduh gambar \${index} menggunakan metode fetch\`);
                    return;
                  } else {
                    throw new Error('Blob kosong diterima');
                  }
                } else {
                  throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                }
              } catch (fetchError) {
                console.log(\`Fetch gagal untuk gambar \${index}, mencoba metode canvas:\`, fetchError.message);
              }
              
              // Fallback ke metode canvas
              try {
                console.log(\`Mencoba unduh canvas untuk gambar \${index}\`);
                
                // Coba beberapa konfigurasi CORS
                const corsConfigs = ['anonymous', 'use-credentials', null];
                let corsImg = null;
                
                for (const corsConfig of corsConfigs) {
                  try {
                    corsImg = new Image();
                    if (corsConfig) {
                      corsImg.crossOrigin = corsConfig;
                    }
                    
                    await new Promise((resolve, reject) => {
                      const timeout = setTimeout(() => {
                        reject(new Error(\`Timeout load gambar CORS dengan \${corsConfig || 'no CORS'}\`));
                      }, 5000);
                      
                      corsImg.onload = () => {
                        clearTimeout(timeout);
                        resolve();
                      };
                      
                      corsImg.onerror = () => {
                        clearTimeout(timeout);
                        reject(new Error(\`Gambar CORS gagal dimuat dengan \${corsConfig || 'no CORS'}\`));
                      };
                      
                      corsImg.src = img.src;
                    });
                    
                    // Jika sampai di sini, gambar berhasil dimuat
                    console.log(\`Gambar \${index} dimuat dengan konfigurasi CORS: \${corsConfig || 'no CORS'}\`);
                    break;
                  } catch (corsError) {
                    console.log(\`Konfigurasi CORS \${corsConfig || 'no CORS'} gagal untuk gambar \${index}:\`, corsError.message);
                    corsImg = null;
                  }
                }
                
                if (!corsImg) {
                  throw new Error('Semua konfigurasi CORS gagal');
                }
                
                // Buat canvas dan gambar gambar
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = corsImg.naturalWidth || corsImg.width;
                canvas.height = corsImg.naturalHeight || corsImg.height;
                
                if (canvas.width === 0 || canvas.height === 0) {
                  throw new Error('Dimensi canvas tidak valid');
                }
                
                // Gambar gambar di canvas
                ctx.drawImage(corsImg, 0, 0);
                
                // Konversi ke blob
                return new Promise((resolve) => {
                  canvas.toBlob((blob) => {
                    if (blob && blob.size > 0) {
                      // Buat link download
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = \`gemini-generated-image-\${Date.now()}-\${index}.png\`;
                      a.style.display = 'none';
                      
                      // Trigger download
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      
                      // Bersihkan
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                      
                      console.log(\`Mengunduh gambar \${index} menggunakan fallback canvas\`);
                    } else {
                      console.error(\`Gagal membuat blob untuk gambar \${index}\`);
                      // Coba unduh langsung sebagai upaya terakhir
                      const a = document.createElement('a');
                      a.href = img.src;
                      a.download = \`gemini-image-\${Date.now()}-\${index}.png\`;
                      a.style.display = 'none';
                      
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      
                      console.log(\`Mengunduh gambar \${index} menggunakan fallback langsung setelah kegagalan blob canvas\`);
                    }
                    resolve();
                  }, 'image/png', 0.95);
                });
                
              } catch (canvasError) {
                console.log(\`Metode canvas gagal untuk gambar \${index}, mencoba unduh langsung:\`, canvasError.message);
                
                // Fallback terakhir: coba unduh langsung tanpa membuka tab baru
                try {
                  const a = document.createElement('a');
                  a.href = img.src;
                  a.download = \`gemini-image-\${Date.now()}-\${index}.png\`;
                  a.style.display = 'none';
                  a.rel = 'noopener noreferrer';
                  
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  
                  console.log(\`Mengunduh gambar \${index} menggunakan fallback langsung\`);
                  return;
                } catch (directError) {
                  console.log(\`Unduh langsung gagal untuk gambar \${index}:\`, directError.message);
                }
              }
              
            } catch (error) {
              console.error(\`Semua metode unduh gagal untuk gambar \${index}:\`, error);
              
              // Upaya terakhir: buka gambar di tab baru
              try {
                window.open(img.src, '_blank', 'noopener,noreferrer');
                console.log(\`Membuka gambar \${index} di tab baru sebagai upaya terakhir\`);
              } catch (openError) {
                console.error(\`Bahkan membuka di tab baru gagal untuk gambar \${index}:\`, openError);
                throw error;
              }
            }
          }
          
          // Metode fallback untuk mengunduh gambar ketika tombol download tidak tersedia
          async function downloadImagesFallback() {
            try {
              console.log('Menggunakan metode unduh fallback');
              
              // Cari semua gambar dalam percakapan yang mungkin dihasilkan
              const images = document.querySelectorAll('img[src*="googleusercontent.com"], img[src*="gemini"], img[alt*="Generated"], img[alt*="Image"]');
              
              if (images.length === 0) {
                console.log('Tidak ada gambar yang dihasilkan ditemukan untuk diunduh');
                return;
              }
              
              console.log(\`Ditemukan \${images.length} gambar potensial yang dihasilkan\`);
              
              for (let i = 0; i < images.length; i++) {
                const img = images[i];
                
                // Lewati jika gambar terlalu kecil (kemungkinan elemen UI)
                if (img.naturalWidth < 100 || img.naturalHeight < 100) {
                  continue;
                }
                
                try {
                  await downloadSingleImageFallback(img, i + 1);
                } catch (error) {
                  console.error(\`Error mengunduh gambar \${i + 1}:\`, error);
                }
              }
              
            } catch (error) {
              console.error('Error dalam downloadImagesFallback:', error);
            }
          }
          
          // Fungsi untuk memproses konten baru
          async function processNewContent() {
            try {
              // Periksa apakah auto download aktif
              const response = await chrome.runtime.sendMessage({ action: 'getState' });
              
              if (response && response.state && response.state.autoDownloadImages) {
                console.log('Auto download aktif, memulai proses dengan interval before dan after download');
                
                // Tunggu interval before download
                const beforeDownloadTime = getBeforeDownloadInterval(response.state);
                console.log(`Menunggu ${beforeDownloadTime}ms sebelum download...`);
                await new Promise(resolve => setTimeout(resolve, beforeDownloadTime));
                
                // Jalankan fungsi download gambar
                await downloadGeneratedImages();
                
                // Tunggu interval after download
                const afterDownloadTime = getAfterDownloadInterval(response.state);
                console.log(`Menunggu ${afterDownloadTime}ms setelah download...`);
                await new Promise(resolve => setTimeout(resolve, afterDownloadTime));
                
                console.log('Proses download dengan interval selesai');
              } else {
                console.log('Auto download tidak aktif, melewati proses download');
              }
            } catch (error) {
              console.error('Error dalam processNewContent:', error);
            }
          }
          
          // Fungsi untuk mendapatkan interval before download
          function getBeforeDownloadInterval(state) {
            if (state.downloadIntervalType === 'fixed') {
              return (state.fixedBeforeDownload || 3) * 1000; // Konversi ke milidetik
            } else {
              // Random interval antara min dan max
              const min = Math.max(1, state.minBeforeDownload || 2);
              const max = Math.max(min, state.maxBeforeDownload || 5);
              const randomValue = Math.random() * (max - min) + min;
              return Math.floor(randomValue) * 1000;
            }
          }
          
          // Fungsi untuk mendapatkan interval after download
          function getAfterDownloadInterval(state) {
            if (state.downloadIntervalType === 'fixed') {
              return (state.fixedAfterDownload || 2) * 1000; // Konversi ke milidetik
            } else {
              // Random interval antara min dan max
              const min = Math.max(1, state.minAfterDownload || 1);
              const max = Math.max(min, state.maxAfterDownload || 3);
              const randomValue = Math.random() * (max - min) + min;
              return Math.floor(randomValue) * 1000;
            }
          }
          
          // Buat observer untuk memantau perubahan DOM
          const observer = new MutationObserver((mutations) => {
            let shouldProcess = false;
            let reasonForProcessing = [];
            
            mutations.forEach((mutation) => {
              if (mutation.type === 'childList') {
                // Periksa apakah ada node baru yang ditambahkan
                mutation.addedNodes.forEach((node) => {
                  if (node.nodeType === Node.ELEMENT_NODE) {
                    // Periksa apakah node mengandung gambar yang dihasilkan atau tombol stop hilang
                    if (node.querySelector && (
                      node.querySelector('img[src*="googleusercontent.com"]') || 
                      node.querySelector('img[src*="gemini"]') ||
                      node.querySelector('img[alt*="Generated"]') ||
                      node.querySelector('img[alt*="Image"]') ||
                      node.querySelector('download-generated-image-button') ||
                      node.querySelector('generated-image') ||
                      node.querySelector('single-image')
                    )) {
                      console.log('Elemen gambar atau download baru terdeteksi:', node.tagName || node.className);
                      reasonForProcessing.push('Gambar baru terdeteksi');
                      shouldProcess = true;
                    }
                  }
                });
                
                // Juga periksa apakah ada perubahan pada area tombol (tombol stop mungkin hilang)
                mutation.removedNodes.forEach((node) => {
                  if (node.nodeType === Node.ELEMENT_NODE) {
                    // Periksa berbagai kemungkinan tombol stop yang dihapus
                    const stopSelectors = [
                      'button[aria-label*="Stop"]',
                      'button[aria-label*="Hentikan"]',
                      '.stop-button',
                      'mat-icon[fonticon="stop"]',
                      '.send-button-container.visible:not(.disabled)',
                      'div.trailing-actions-wrapper button:not([disabled])'
                    ];
                    
                    let stopButtonRemoved = false;
                    for (const selector of stopSelectors) {
                      try {
                        if (node.querySelector && node.querySelector(selector)) {
                          stopButtonRemoved = true;
                          break;
                        }
                      } catch (e) {
                        // Abaikan error selector
                      }
                    }
                    
                    if (stopButtonRemoved) {
                      console.log('Tombol stop dihapus dari DOM:', node.tagName || node.className);
                      reasonForProcessing.push('Tombol stop dihapus');
                      shouldProcess = true;
                    }
                  }
                });
              }
              
              // Periksa perubahan atribut yang mungkin menandakan perubahan status tombol
              if (mutation.type === 'attributes') {
                const target = mutation.target;
                if (target.tagName === 'BUTTON' || target.closest('button')) {
                  const button = target.tagName === 'BUTTON' ? target : target.closest('button');
                  if (mutation.attributeName === 'disabled' || 
                      mutation.attributeName === 'aria-label' ||
                      mutation.attributeName === 'class') {
                    console.log('Atribut tombol berubah:', mutation.attributeName, button.className);
                    reasonForProcessing.push('Status tombol berubah');
                    shouldProcess = true;
                  }
                }
              }
            });
            
            if (shouldProcess) {
              console.log('Alasan pemrosesan:', reasonForProcessing.join(', '));
              console.log("Perubahan DOM terdeteksi, memproses konten baru dalam 3 detik");
              // Tunggu lebih lama untuk memastikan DOM sudah stabil dan tombol stop benar-benar hilang
              setTimeout(processNewContent, 3000);
            }
          });
          
          // Jalankan pemeriksaan pertama setelah delay untuk memastikan halaman siap
          setTimeout(() => {
            console.log('Pemeriksaan awal: memeriksa status tombol stop dan gambar...');
            processNewContent();
          }, 3000);
          
          // Mulai observasi
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['disabled', 'aria-label', 'class', 'style'],
            attributeOldValue: true
          });
          
          console.log("Observer DOM dimulai untuk memantau gambar yang dihasilkan baru");
          
          // Juga jalankan pemeriksaan manual setiap 5 detik sebagai backup
          // Ini akan memeriksa apakah tombol stop hilang dan ada gambar untuk diunduh
          const manualCheckInterval = setInterval(() => {
            console.log('Pemeriksaan manual: memeriksa status tombol stop dan gambar...');
            processNewContent();
          }, 5000);
          
          // Hentikan interval setelah 3 menit
          setTimeout(() => {
            clearInterval(manualCheckInterval);
            observer.disconnect();
            console.log('Pemantauan gambar otomatis dihentikan');
          }, 3 * 60 * 1000);
          
        } catch (error) {
          console.error("Error dalam script pemantauan gambar:", error);
        }
      })();
    `;
    
    // Implementasi baru tidak memerlukan event listener eksternal karena semua proses download
    // dilakukan langsung di dalam script yang diinjeksi
    
    // Injeksi script ke halaman
    if (document.head) {
      document.head.appendChild(scriptToInject);
      console.log('Script pemantauan gambar berhasil diinjeksi ke head');
    } else if (document.documentElement) {
      document.documentElement.appendChild(scriptToInject);
      console.log('Script pemantauan gambar berhasil diinjeksi ke documentElement');
    } else {
      console.error('Tidak dapat menginjeksi script pemantauan gambar: document.head dan document.documentElement tidak tersedia');
    }
    
    // Hapus script setelah dijalankan
    setTimeout(() => {
      if (scriptToInject.parentNode) {
        scriptToInject.parentNode.removeChild(scriptToInject);
      }
    }, 100);
    
    // Script monitoring akan berjalan secara otomatis tanpa perlu event listener eksternal
  } // Penutup untuk startActualMonitoring
}

// Fungsi untuk memastikan koneksi dengan background script tetap aktif
function ensureBackgroundConnection() {
  try {
    // Ping background script untuk memastikan koneksi aktif
    chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
      if (chrome.runtime.lastError) {
        // Log error tapi jangan spam console
        if (chrome.runtime.lastError.message && !chrome.runtime.lastError.message.includes('Could not establish connection')) {
          console.warn('Background script connection issue:', chrome.runtime.lastError.message);
        }
      } else {
        console.log('Background script connection OK');
      }
    });
  } catch (error) {
    console.warn('Error during background ping:', error.message);
  }
}

// Ping background script setiap 2 menit untuk menjaga koneksi (dikurangi frekuensinya)
setInterval(ensureBackgroundConnection, 120000);

// Ping sekali setelah 10 detik untuk memastikan koneksi awal
setTimeout(ensureBackgroundConnection, 10000);

// Listener untuk pesan dari background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script menerima pesan:', message);
  
  if (message.action === 'insertPrompt') {
    insertPromptToGemini(message.prompt)
      .then(() => {
        console.log('Prompt berhasil dimasukkan');
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('Error saat memasukkan prompt:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Untuk mendukung respons asinkron
  }
  
  // Pesan ping untuk mengecek apakah content script aktif
  if (message.action === 'ping') {
    console.log('Menerima ping dari background script');
    sendResponse({ success: true, message: 'Content script aktif' });
    return true;
  }
});

// Notifikasi bahwa content script telah dimuat
console.log('Gemini Prompt Automator content script loaded');