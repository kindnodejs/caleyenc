// --- INJECT RESPONSIVE STYLES FOR LIGHTBOX & TITLE GROUP ---
const lightboxStyleTag = document.createElement('style');
lightboxStyleTag.innerHTML = `
  #lightboxTitleGroup {
    position: absolute;
    top: 20px;
    right: 20px;
    display: none;
    align-items: flex-start;
    gap: 12px;
    z-index: 1000;
  }
  #lightboxTitleContainer {
    width: 300px;
    height: 300px;
    border: 2px solid #ffffff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    background: #000;
    touch-action: none;
  }
  #titleControls {
    display: flex;
    flex-direction: row;
    gap: 4px;
    background: rgba(0,0,0,0.8);
    padding: 6px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    z-index: 1002;
  }
  #lightboxImg {
    max-width: 90vw;
    max-height: 85vh;
    width: auto;
    height: auto;
    object-fit: contain;
  }
  @media (max-width: 768px), (orientation: portrait) {
    #lightboxTitleGroup {
      top: 20px !important;
      right: 20px !important;
      left: auto !important;
      transform: none !important;
      align-items: flex-start !important;
    }
    #lightboxTitleContainer {
      width: 245px !important;
      height: 245px !important;
    }
    #lightboxImg {
      position: absolute !important;
      top: 265px !important;
      right: 20px !important;
      left: auto !important;
      margin: 0 !important;
      max-height: calc(100vh - 295px) !important;
      max-width: calc(100vw - 40px) !important;
      width: auto !important;
      height: auto !important;
      object-fit: contain !important;
    }
  }
`;
document.head.appendChild(lightboxStyleTag);

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

// Reposition Close Button to Top-Left
if (lightboxClose) {
  lightboxClose.style.position = 'absolute';
  lightboxClose.style.top = '20px';
  lightboxClose.style.left = '20px';
  lightboxClose.style.right = 'auto';
  lightboxClose.style.zIndex = '1001';
}

// Create Lightbox Title Group (Controls + Title Container)
let lightboxTitleGroup = document.getElementById('lightboxTitleGroup');
let lightboxTitleContainer = document.getElementById('lightboxTitleContainer');
let lightboxTitleImg = document.getElementById('lightboxTitleImg');
let titleControls = document.getElementById('titleControls');

if (!lightboxTitleGroup && lightbox) {
  lightboxTitleGroup = document.createElement('div');
  lightboxTitleGroup.id = 'lightboxTitleGroup';

  // Zoom Controls Toolbar (Placed on the left side of the title container)
  titleControls = document.createElement('div');
  titleControls.id = 'titleControls';
  
  const zoomOutBtn = createZoomButton('−', () => adjustZoom(-0.05));
  const resetZoomBtn = createZoomButton('⟲', () => resetTitleTransform());
  const zoomInBtn = createZoomButton('+', () => adjustZoom(0.05));

  titleControls.appendChild(zoomOutBtn);
  titleControls.appendChild(resetZoomBtn);
  titleControls.appendChild(zoomInBtn);

  lightboxTitleContainer = document.createElement('div');
  lightboxTitleContainer.id = 'lightboxTitleContainer';
  
  lightboxTitleImg = document.createElement('img');
  lightboxTitleImg.id = 'lightboxTitleImg';
  lightboxTitleImg.style.cssText = 'width: 100%; height: 100%; object-fit: contain; transform-origin: center; transition: transform 0.05s ease-out; user-select: none; pointer-events: none;';
  
  lightboxTitleContainer.appendChild(lightboxTitleImg);

  // Append controls first so they sit cleanly on the left side
  lightboxTitleGroup.appendChild(titleControls);
  lightboxTitleGroup.appendChild(lightboxTitleContainer);
  lightbox.appendChild(lightboxTitleGroup);
}

function createZoomButton(text, onClick) {
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.style.cssText = 'background: #334155; color: #fff; border: none; width: 32px; height: 32px; border-radius: 4px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 15px;';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return btn;
}

let galleryItemsData = [];
let currentIndex = 0;
let currentTitleItem = null;

// Title Image Zoom & Pan State Variables
let titleZoom = 1;
let titlePanX = 0;
let titlePanY = 0;
let isDraggingTitle = false;
let startDragX = 0;
let startDragY = 0;

function updateTitleTransform() {
  if (lightboxTitleImg) {
    lightboxTitleImg.style.transform = `translate(${titlePanX}px, ${titlePanY}px) scale(${titleZoom})`;
  }
}

function resetTitleTransform() {
  titleZoom = 1;
  titlePanX = 0;
  titlePanY = 0;
  updateTitleTransform();
  if (lightboxTitleContainer) lightboxTitleContainer.style.cursor = 'default';
}

function adjustZoom(amount) {
  titleZoom = Math.min(Math.max(titleZoom + amount, 1), 5); // Range: 1x to 5x
  if (titleZoom === 1) {
    titlePanX = 0;
    titlePanY = 0;
  }
  if (lightboxTitleContainer) {
    lightboxTitleContainer.style.cursor = titleZoom > 1 ? 'grab' : 'default';
  }
  updateTitleTransform();
}

// Zoom via Mouse Wheel
if (lightboxTitleContainer) {
  lightboxTitleContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    adjustZoom(e.deltaY < 0 ? 0.05 : -0.05);
  }, { passive: false });

  // Pan via Pointer Events (Supports Mouse & Touch Drag)
  lightboxTitleContainer.addEventListener('pointerdown', (e) => {
    if (titleZoom > 1) {
      isDraggingTitle = true;
      lightboxTitleContainer.style.cursor = 'grabbing';
      startDragX = e.clientX - titlePanX;
      startDragY = e.clientY - titlePanY;
      lightboxTitleContainer.setPointerCapture(e.pointerId);
    }
  });

  lightboxTitleContainer.addEventListener('pointermove', (e) => {
    if (!isDraggingTitle) return;
    titlePanX = e.clientX - startDragX;
    titlePanY = e.clientY - startDragY;
    updateTitleTransform();
  });

  lightboxTitleContainer.addEventListener('pointerup', (e) => {
    if (isDraggingTitle) {
      isDraggingTitle = false;
      lightboxTitleContainer.style.cursor = titleZoom > 1 ? 'grab' : 'default';
      try { lightboxTitleContainer.releasePointerCapture(e.pointerId); } catch(err) {}
    }
  });
}

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

// --- SET TITLE HANDLER (Session-Only) ---
function setAsTitle(targetItemData, recordId) {
  galleryItemsData.forEach(item => item.isTitle = false);
  targetItemData.isTitle = true;
  currentTitleItem = targetItemData;
  resetTitleTransform();

  // Update button visual states across all grid items
  document.querySelectorAll('.grid-item').forEach(el => {
    const titleBtn = el.querySelector('.title-btn');
    if (titleBtn) {
      if (el.getAttribute('data-id') === String(recordId)) {
        titleBtn.textContent = '★ Title Picture';
        titleBtn.style.backgroundColor = '#22c55e';
      } else {
        titleBtn.textContent = 'Set as Title';
        titleBtn.style.backgroundColor = '';
      }
    }
  });
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

    if (currentTitleItem && currentTitleItem.id === id) {
      currentTitleItem = null;
      if (lightboxTitleGroup) lightboxTitleGroup.style.display = 'none';
      resetTitleTransform();
    }

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
  resetTitleTransform();
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

  // Title picture display & group visibility
  if (currentTitleItem && currentTitleItem.dataUrl) {
    lightboxTitleImg.src = currentTitleItem.dataUrl;
    lightboxTitleGroup.style.display = 'flex';
  } else {
    lightboxTitleGroup.style.display = 'none';
  }
}

lightboxClose.addEventListener('click', closeLightbox);
lightboxNext.addEventListener('click', (e) => {
  e.stopPropagation();
  showNextImage();
});
lightboxPrev.addEventListener('click', (e) => {
  e.stopPropagation();
  showPrevImage();
});

document.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('active')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowRight') showNextImage();
  if (e.key === 'ArrowLeft') showPrevImage();
});

// --- FETCH & DECRYPT HANDLER ---
document.getElementById('fetchBtn').addEventListener('click', async () => {
  const passphrase = passphraseInput.value.trim();
  const status = document.getElementById('galleryStatus');

  if (!passphrase) return alert("Please enter your master passphrase!");

  gallery.innerHTML = "";
  galleryItemsData = [];
  currentTitleItem = null;
  if (lightboxTitleGroup) lightboxTitleGroup.style.display = 'none';
  resetTitleTransform();
  status.style.color = "#38bdf8";
  status.innerText = "Fetching entries...";

  try {
    const passHint = await generatePassHint(passphrase);

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

      if (!decryptedBuffer) continue;

      if (!record.pass_hint) {
        _supabase.from('images').update({ pass_hint: passHint }).eq('id', record.id).then();
      }

      const decryptedBlob = new Blob([decryptedBuffer], { type: 'image/png' });
      const dataUrl = await blobToDataURL(decryptedBlob);

      const itemDataRef = {
        id: record.id,
        dataUrl: dataUrl,
        sequence: record.sequence_order,
        caption: record.caption || "",
        isTitle: false
      };

      galleryItemsData.push(itemDataRef);

      const item = document.createElement('div');
      item.className = 'grid-item';
      item.setAttribute('data-id', record.id);
      item.innerHTML = `
        <div class="image-container" title="Click for fullscreen view">
          <img src="${dataUrl}" alt="Thumbnail #${record.sequence_order}" />
        </div>
        <p><strong>#${record.sequence_order}</strong></p>
        <textarea class="caption-input" placeholder="Add caption...">${record.caption || ''}</textarea>
        <button class="title-btn">Set as Title</button>
        <button class="delete-btn">Delete File</button>
      `;

      // Update local and remote caption on input
      const captionInput = item.querySelector('.caption-input');
      captionInput.addEventListener('input', (e) => {
        itemDataRef.caption = e.target.value;
        saveCaption(record.id, e.target.value);
      });

      // Title Button Handler
      const titleBtn = item.querySelector('.title-btn');
      titleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setAsTitle(itemDataRef, record.id);
      });

      item.querySelector('.image-container').addEventListener('click', () => {
        const index = galleryItemsData.findIndex(i => i.id === record.id);
        if (index !== -1) openLightbox(index);
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