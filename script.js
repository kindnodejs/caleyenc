// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = "https://chddgiphidaevghtbxgo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoZGRnaXBoaWRhZXZnaHRieGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MTQ2MjMsImV4cCI6MjEwMTE5MDYyM30.3jD9Fmx-jXPd_uHZhXe7bifipJf2-mrw4Z72cKrheq0";

const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- DOM ELEMENTS ---
const passphraseInput = document.getElementById('passphrase');
const togglePassBtn = document.getElementById('togglePassBtn');
const gallery = document.getElementById('gallery');

// Lightbox Elements
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxCaption = document.getElementById('lightboxCaption');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');

let galleryItemsData = [];
let currentIndex = 0;

// --- PASSWORD VISIBILITY TOGGLE ---
togglePassBtn.addEventListener('click', () => {
  if (passphraseInput.type === 'password') {
    passphraseInput.type = 'text';
    togglePassBtn.textContent = '🙈';
  } else {
    passphraseInput.type = 'password';
    togglePassBtn.textContent = '👁️';
  }
});

// --- CRYPTOGRAPHIC HASH HELPER (Approach 1 Hint Generator) ---
async function generatePassHint(passphrase) {
  const enc = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(passphrase));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- WEBCRYPTO FUNCTIONS ---
async function getCryptoKey(passphrase, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptFile(file, passphrase) {
  const arrayBuffer = await file.arrayBuffer();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getCryptoKey(passphrase, salt);

  const encryptedContent = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    arrayBuffer
  );

  const combined = new Uint8Array(salt.length + iv.length + encryptedContent.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encryptedContent), salt.length + iv.length);

  return combined;
}

async function decryptFile(encryptedData, passphrase) {
  const salt = encryptedData.slice(0, 16);
  const iv = encryptedData.slice(16, 28);
  const content = encryptedData.slice(28);

  const key = await getCryptoKey(passphrase, salt);
  const decryptedContent = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    content
  );

  return decryptedContent;
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// --- UPLOAD HANDLER ---
document.getElementById('uploadBtn').addEventListener('click', async () => {
  const passphrase = passphraseInput.value.trim();
  const fileInput = document.getElementById('fileInput');
  const startSeqInput = document.getElementById('startSeq');
  const status = document.getElementById('uploadStatus');

  if (!passphrase) return alert("Please enter a master passphrase!");
  if (!fileInput.files.length) return alert("Please select files to upload!");

  let currentSeq = parseInt(startSeqInput.value, 10) || 1;
  const passHint = await generatePassHint(passphrase);

  const sortedFiles = Array.from(fileInput.files).sort((a, b) => 
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );

  status.style.color = "#38bdf8";
  
  for (let i = 0; i < sortedFiles.length; i++) {
    const file = sortedFiles[i];
    status.innerText = `Encrypting & uploading ${i + 1}/${sortedFiles.length}: ${file.name}`;

    try {
      const encryptedBuffer = await encryptFile(file, passphrase);

      const uniqueSuffix = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      const storagePath = `encrypted/${Date.now()}_${uniqueSuffix}_${file.name}.bin`;

      const { error: storageError } = await _supabase.storage
        .from('vault')
        .upload(storagePath, new Blob([encryptedBuffer]));

      if (storageError) throw storageError;

      const { error: dbError } = await _supabase
        .from('images')
        .insert([{
          title: file.name,
          storage_path: storagePath,
          sequence_order: currentSeq,
          pass_hint: passHint,
          caption: ""
        }]);

      if (dbError) throw dbError;

      currentSeq++;
    } catch (err) {
      console.error(err);
      status.style.color = "#ef4444";
      status.innerText = `Error uploading ${file.name}: ${err.message}`;
      return;
    }
  }

  status.style.color = "#22c55e";
  status.innerText = "All files successfully encrypted and uploaded in order!";
  fileInput.value = "";
});

// --- SAVE CAPTION HANDLER ---
async function saveCaption(id, newCaption) {
  try {
    const { error } = await _supabase
      .from('images')
      .update({ caption: newCaption })
      .eq('id', id);

    if (error) throw error;
  } catch (err) {
    console.error("Failed to update caption:", err);
  }
}

// --- DELETE HANDLER ---
async function deleteItem(id, storagePath, element) {
  if (!confirm("Are you sure you want to delete this file from the vault?")) return;

  try {
    const { error: storageErr } = await _supabase.storage
      .from('vault')
      .remove([storagePath]);

    if (storageErr) throw storageErr;

    const { error: dbErr } = await _supabase
      .from('images')
      .delete()
      .eq('id', id);

    if (dbErr) throw dbErr;

    element.remove();
  } catch (err) {
    console.error(err);
    alert(`Failed to delete: ${err.message}`);
  }
}

// --- LIGHTBOX CONTROLS ---
function openLightbox(index) {
  currentIndex = index;
  updateLightboxContent();
  lightbox.classList.add('active');
  lightbox.focus();
}

function closeLightbox() {
  lightbox.classList.remove('active');
}

function showNextImage() {
  if (galleryItemsData.length === 0) return;
  currentIndex = (currentIndex + 1) % galleryItemsData.length;
  updateLightboxContent();
}

function showPrevImage() {
  if (galleryItemsData.length === 0) return;
  currentIndex = (currentIndex - 1 + galleryItemsData.length) % galleryItemsData.length;
  updateLightboxContent();
}

function updateLightboxContent() {
  const item = galleryItemsData[currentIndex];
  lightboxImg.src = item.dataUrl;
  lightboxCaption.textContent = item.caption ? `#${item.sequence}\n${item.caption}` : `#${item.sequence}`;
}

lightboxClose.addEventListener('click', closeLightbox);
lightboxNext.addEventListener('click', showNextImage);
lightboxPrev.addEventListener('click', showPrevImage);

lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});

document.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('active')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowRight') showNextImage();
  if (e.key === 'ArrowLeft') showPrevImage();
});

// --- FETCH & DECRYPT HANDLER (With Approach 1 Hint Filtering & Auto-Migration) ---
document.getElementById('fetchBtn').addEventListener('click', async () => {
  const passphrase = passphraseInput.value.trim();
  const status = document.getElementById('galleryStatus');

  if (!passphrase) return alert("Please enter your master passphrase!");

  gallery.innerHTML = "";
  galleryItemsData = [];
  status.style.color = "#38bdf8";
  status.innerText = "Fetching entries...";

  try {
    const passHint = await generatePassHint(passphrase);

    // Fetch hinted records matching passHint OR legacy records where pass_hint is null/empty
    const { data: records, error: dbError } = await _supabase
      .from('images')
      .select('*')
      .or(`pass_hint.eq.${passHint},pass_hint.is.null`)
      .order('sequence_order', { ascending: true });

    if (dbError) throw dbError;
    if (!records || !records.length) {
      status.innerText = "No matching files found in vault.";
      return;
    }

    status.innerText = `Processing ${records.length} files...`;

    for (const record of records) {
      const { data: blob, error: downloadError } = await _supabase.storage
        .from('vault')
        .download(record.storage_path);

      if (downloadError) {
        console.error(`Download error for ${record.title}:`, downloadError);
        continue;
      }

      const arrayBuffer = await blob.arrayBuffer();
      const uint8ArrayData = new Uint8Array(arrayBuffer);

      if (uint8ArrayData.length < 29) continue;

      let decryptedBuffer = null;
      try {
        decryptedBuffer = await decryptFile(uint8ArrayData, passphrase);
      } catch (e) {
        // Passphrase didn't match this record
      }

      if (!decryptedBuffer) {
        // Skip records that failed decryption (e.g. old records belonging to a different key)
        continue;
      }

      // Auto-Migration: If this legacy record didn't have a pass_hint, stamp it now!
      if (!record.pass_hint) {
        _supabase.from('images').update({ pass_hint: passHint }).eq('id', record.id).then();
      }

      const decryptedBlob = new Blob([decryptedBuffer], { type: 'image/png' });
      const dataUrl = await blobToDataURL(decryptedBlob);

      const itemIndex = galleryItemsData.length;
      
      const itemDataRef = {
        dataUrl: dataUrl,
        sequence: record.sequence_order,
        caption: record.caption || ""
      };
      galleryItemsData.push(itemDataRef);

      const item = document.createElement('div');
      item.className = 'grid-item';
      item.innerHTML = `
        <div class="image-container" title="Click for fullscreen view">
          <img src="${dataUrl}" alt="Thumbnail #${record.sequence_order}" />
        </div>
        <p><strong>#${record.sequence_order}</strong></p>
        <textarea class="caption-input" placeholder="Add caption...">${record.caption || ''}</textarea>
        <button class="delete-btn">Delete File</button>
      `;

      // Update local and remote caption on input
      const captionInput = item.querySelector('.caption-input');
      captionInput.addEventListener('input', (e) => {
        itemDataRef.caption = e.target.value;
        saveCaption(record.id, e.target.value);
      });

      item.querySelector('.image-container').addEventListener('click', () => {
        openLightbox(itemIndex);
      });

      item.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteItem(record.id, record.storage_path, item);
      });

      gallery.appendChild(item);
    }

    status.innerText = "";
  } catch (err) {
    console.error("Gallery fetch error:", err);
    status.style.color = "#ef4444";
    status.innerText = `Error loading vault files. Check console for details.`;
  }
});