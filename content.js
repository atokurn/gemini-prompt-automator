// content.js - Script yang diinjeksi ke halaman Gemini

// Fungsi untuk memasukkan prompt ke textarea Gemini
function insertPromptToGemini(prompt) {
  return new Promise((resolve, reject) => {
    try {
      console.log('Mencoba memasukkan prompt ke Gemini...');
      
      // Karena kita berada di ISOLATED world, kita perlu menjalankan kode di konteks halaman
      // Kita akan menggunakan chrome.scripting.executeScript untuk ini
      // Tapi karena kita tidak bisa menggunakan itu dari content script, kita akan menggunakan pendekatan lain
      
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
                console.error('Tombol kirim tidak ditemukan dengan semua selector yang dicoba');
                // Coba cari tombol dengan pendekatan yang berbeda
                const allButtons = document.querySelectorAll('button');
                for (const button of allButtons) {
                  const buttonText = button.textContent.toLowerCase();
                  const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
                  if (buttonText.includes('send') || buttonText.includes('kirim') || 
                      ariaLabel.includes('send') || ariaLabel.includes('kirim')) {
                    sendButton = button;
                    console.log('Tombol kirim ditemukan dengan pencarian teks:', button);
                    break;
                  }
                }
              }
              
              if (sendButton) {
                sendButton.click();
                console.log('Tombol kirim berhasil diklik');
                document.dispatchEvent(new CustomEvent('gemini-automator-success', {
                  detail: { message: 'Prompt berhasil dikirim' }
                }));
              } else {
                console.error('Tombol kirim tidak ditemukan');
                document.dispatchEvent(new CustomEvent('gemini-automator-error', {
                  detail: { message: 'Tombol kirim tidak ditemukan' }
                }));
              }
            }, 1000); // Tunggu 1 detik sebelum mencari tombol kirim
          } catch (error) {
            console.error('Error dalam script injeksi:', error);
            document.dispatchEvent(new CustomEvent('gemini-automator-error', { 
              detail: { message: error.message || 'Unknown error' } 
            }));
          }
        })();
      `;
      
      // Tambahkan event listener untuk menangkap hasil dari script yang diinjeksi
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
          startImageMonitoring();
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

// Fungsi untuk memantau gambar yang muncul dalam respons Gemini
function startImageMonitoring() {
  console.log('Memulai pemantauan gambar...');
  // Reset daftar gambar yang sudah diproses untuk respons baru
  processedImages.clear();
  
  // Karena kita berada di ISOLATED world, kita perlu menggunakan pendekatan yang berbeda
  // Kita akan menyuntikkan script ke halaman yang akan memantau gambar
  const scriptToInject = document.createElement('script');
  scriptToInject.textContent = '
    (function() {
      try {
        console.log("Script pemantauan gambar berjalan");
        
        // Buat observer untuk memantau perubahan DOM
        const observer = new MutationObserver((mutations) => {
          // Cari semua gambar dalam respons Gemini
          const responseSelectors = [
            ".response-container img", 
            ".gemini-response img",
            ".model-response img",
            ".chat-response img",
            ".ai-response img",
            ".response img",
            ".message-container:not(.user-message) img",
            "generated-image img",
            "single-image img",
            "response-element img"
          ];
          
          // Selector untuk tombol download dari element.md
          const downloadButtonSelectors = [
            // Selector yang lebih generik untuk tombol download
            "download-generated-image-button > button",
            "button.download-button",
            "button[aria-label=\"Download\"]",
            "button[aria-label=\"Unduh\"]",
            "button.mdc-icon-button[aria-label=\"Download\"]",
            "button.mdc-icon-button[aria-label=\"Unduh\"]",
            "single-image button",
            "generated-image button",
            // Selector untuk tombol download dengan span
            "download-generated-image-button > button > span.mdc-button__label",
            "download-generated-image-button > button > span.mat-mdc-button-persistent-ripple.mdc-button__ripple"
          ];
          
          let responseImages = [];
          for (const selector of responseSelectors) {
            const images = document.querySelectorAll(selector);
            if (images.length > 0) {
              responseImages = Array.from(images);
              console.log("Gambar ditemukan dengan selector: " + selector + ", jumlah: " + images.length);
              break;
            }
          }
          
          if (responseImages.length === 0) {
            // Coba cari semua gambar dalam respons dengan pendekatan alternatif
            const allImages = document.querySelectorAll('img');
            responseImages = Array.from(allImages).filter(img => {
              // Filter gambar yang kemungkinan besar adalah bagian dari respons
              return img.width > 100 && img.height > 100 && !img.src.includes('icon') && !img.src.includes('logo');
            });
          }
          
          // Coba cari tombol download terlebih dahulu
          let downloadButton = null;
          let downloadClicked = false;
          
          // Coba semua selector untuk tombol download
          for (const selector of downloadButtonSelectors) {
            const button = document.querySelector(selector);
            if (button) {
              downloadButton = button;
              console.log("Tombol download ditemukan dengan selector: " + selector);
              break;
            }
          }
          
          if (downloadButton) {
            console.log("Tombol download ditemukan, mencoba mengklik...");
            try {
              // Klik tombol download
              downloadButton.click();
              downloadClicked = true;
              console.log("Tombol download berhasil diklik");
            } catch (e) {
              console.error("Gagal mengklik tombol download:", e);
              // Lanjutkan dengan metode alternatif
            }
          } else {
            console.log("Tombol download tidak ditemukan, menggunakan metode alternatif");
          }
          
          // Jika tombol download tidak ditemukan atau gagal diklik, gunakan metode alternatif
          if (!downloadClicked) {
            responseImages.forEach(img => {
              // Periksa apakah gambar sudah diproses
              if (img.complete && img.naturalWidth > 0 && !img.hasAttribute('data-gemini-processed')) {
                // Tandai gambar sebagai sudah diproses
                img.setAttribute('data-gemini-processed', 'true');
                
                // Dapatkan teks prompt terakhir untuk nama file
                const promptSelectors = [
                  ".user-message:last-child .message-content",
                  ".user-input:last-child",
                  ".user-message:last-child",
                  ".message-container.user-message:last-child"
                ];
                
                let lastPromptElement = null;
                for (const selector of promptSelectors) {
                  const element = document.querySelector(selector);
                  if (element) {
                    lastPromptElement = element;
                    break;
                  }
                }
                
                let promptText = 'gemini_image';
                
                if (lastPromptElement) {
                  promptText = lastPromptElement.textContent.trim();
                  // Batasi panjang nama file
                  if (promptText.length > 30) {
                    promptText = promptText.substring(0, 30);
                  }
                  // Hapus karakter yang tidak valid untuk nama file
                  promptText = promptText.replace(/[\\/:*?"<>|]/g, '_');
                }
                
                // Buat nama file dengan timestamp
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = promptText + '_' + timestamp + '.png';
                
                // Beri tahu content script untuk mengunduh gambar
                document.dispatchEvent(new CustomEvent("gemini-automator-image", { 
                  detail: { 
                    imageUrl: img.src,
                    filename: filename
                  } 
                }));
                
                console.log("Gambar terdeteksi dan dikirim untuk diunduh:" + filename);
              }
            });
          }
        });
        
        // Mulai pemantauan
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["src"]
        });
        
        // Hentikan pemantauan setelah 2 menit
        setTimeout(function() {
          observer.disconnect();
          console.log("Pemantauan gambar dihentikan setelah 2 menit");
        }, 2 * 60 * 1000);
        
        // Beri tahu bahwa pemantauan gambar dimulai
        document.dispatchEvent(new CustomEvent("gemini-automator-monitoring-started"));
      } catch (error) {
        console.error("Error dalam script pemantauan gambar:", error);
      }
    })();
  ';
  
  // Tambahkan event listener untuk menangkap gambar dari script yang diinjeksi
  const handleImage = (event) => {
    const imageData = event.detail;
    if (imageData && imageData.imageUrl && !processedImages.has(imageData.imageUrl)) {
      // Tandai gambar sebagai sudah diproses
      processedImages.add(imageData.imageUrl);
      
      console.log('Gambar terdeteksi:', imageData.filename);
      
      // Kirim pesan ke background script untuk mengunduh gambar
      chrome.runtime.sendMessage({
        action: 'downloadImage',
        imageUrl: imageData.imageUrl,
        filename: imageData.filename
      });
    }
  };
  
  // Tambahkan event listener untuk menangkap hasil dari script yang diinjeksi
  document.addEventListener('gemini-automator-image', handleImage);
  
  // Injeksi script ke halaman
  document.head.appendChild(scriptToInject);
  
  // Hapus script setelah dijalankan
  setTimeout(() => {
    if (scriptToInject.parentNode) {
      scriptToInject.parentNode.removeChild(scriptToInject);
    }
  }, 100);
  
  // Hapus event listener setelah 2 menit
  setTimeout(() => {
    document.removeEventListener('gemini-automator-image', handleImage);
    console.log('Pemantauan gambar dihentikan');
  }, 2 * 60 * 1000);
}

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