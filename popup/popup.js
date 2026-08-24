/**
 * Popup Script for Bilibili Touch Controller Settings
 */

const DEFAULT_CONFIG = {
  enableSeek: true,
  seekSensitivity: 90,
  enableVolume: true,
  enableBrightness: true,
  enableLongPress: true,
  longPressSpeed: 2.0,
  enableDoubleTap: true,
  doubleTapAction: 'smart',
  enableMouseSimulation: false,
  preventGhostClick: true
};

let toastTimeout = null;

function showSaveToast() {
  const toast = document.getElementById('saveToast');
  if (!toast) return;
  toast.classList.add('show');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 1200);
}

// Update conditional UI visibility
function updateUIState() {
  const enableSeek = document.getElementById('enableSeek').checked;
  const seekWrap = document.getElementById('seekSensitivityWrap');
  if (seekWrap) seekWrap.style.display = enableSeek ? 'flex' : 'none';

  const enableLongPress = document.getElementById('enableLongPress').checked;
  const longPressWrap = document.getElementById('longPressSpeedWrap');
  if (longPressWrap) longPressWrap.style.display = enableLongPress ? 'block' : 'none';

  const enableDoubleTap = document.getElementById('enableDoubleTap').checked;
  const doubleTapWrap = document.getElementById('doubleTapActionWrap');
  if (doubleTapWrap) doubleTapWrap.style.display = enableDoubleTap ? 'block' : 'none';
}

// Load and populate settings
function loadSettings() {
  chrome.storage.sync.get(DEFAULT_CONFIG, (items) => {
    const config = items || DEFAULT_CONFIG;

    // Checkboxes
    document.getElementById('enableSeek').checked = !!config.enableSeek;
    document.getElementById('enableVolume').checked = !!config.enableVolume;
    document.getElementById('enableBrightness').checked = !!config.enableBrightness;
    document.getElementById('enableLongPress').checked = !!config.enableLongPress;
    document.getElementById('enableDoubleTap').checked = !!config.enableDoubleTap;
    document.getElementById('enableMouseSimulation').checked = !!config.enableMouseSimulation;

    // Slider
    const sensitivity = config.seekSensitivity || 90;
    document.getElementById('seekSensitivity').value = sensitivity;
    document.getElementById('seekSensitivityVal').textContent = `${sensitivity} 秒`;

    // Radios for long press speed
    const currentSpeed = String(config.longPressSpeed || 2.0);
    const speedRadio = document.querySelector(`input[name="longPressSpeed"][value="${currentSpeed}"]`);
    if (speedRadio) speedRadio.checked = true;

    // Dropdown
    document.getElementById('doubleTapAction').value = config.doubleTapAction || 'smart';

    updateUIState();
  });
}

// Save current settings to chrome.storage
function saveSettings() {
  const speedRadio = document.querySelector('input[name="longPressSpeed"]:checked');
  const longPressSpeed = speedRadio ? parseFloat(speedRadio.value) : 2.0;

  const newConfig = {
    enableSeek: document.getElementById('enableSeek').checked,
    seekSensitivity: parseInt(document.getElementById('seekSensitivity').value, 10),
    enableVolume: document.getElementById('enableVolume').checked,
    enableBrightness: document.getElementById('enableBrightness').checked,
    enableLongPress: document.getElementById('enableLongPress').checked,
    longPressSpeed: longPressSpeed,
    enableDoubleTap: document.getElementById('enableDoubleTap').checked,
    doubleTapAction: document.getElementById('doubleTapAction').value,
    enableMouseSimulation: document.getElementById('enableMouseSimulation').checked,
    preventGhostClick: true
  };

  chrome.storage.sync.set(newConfig, () => {
    showSaveToast();
    updateUIState();
  });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();

  // Switch change listeners
  const checkboxes = ['enableSeek', 'enableVolume', 'enableBrightness', 'enableLongPress', 'enableDoubleTap', 'enableMouseSimulation'];
  checkboxes.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', saveSettings);
  });

  // Slider change listener
  const slider = document.getElementById('seekSensitivity');
  if (slider) {
    slider.addEventListener('input', (e) => {
      document.getElementById('seekSensitivityVal').textContent = `${e.target.value} 秒`;
    });
    slider.addEventListener('change', saveSettings);
  }

  // Radio button listeners
  const radios = document.querySelectorAll('input[name="longPressSpeed"]');
  radios.forEach((radio) => {
    radio.addEventListener('change', saveSettings);
  });

  // Dropdown listener
  const select = document.getElementById('doubleTapAction');
  if (select) {
    select.addEventListener('change', saveSettings);
  }

  // Reset button
  const resetBtn = document.getElementById('btnReset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      chrome.storage.sync.set(DEFAULT_CONFIG, () => {
        loadSettings();
        showSaveToast();
      });
    });
  }
});
