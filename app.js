// State management
let state = {
  weight: 50.0,
  tasks: Array(15).fill(false), // 15 tasks (1-indexed mapping to 0-14 array indices)
  lastUpdated: Date.now()
};

// Configuration
const BUCKET_ID = 'mn4q9QfG4q25p2jPswkX9o';
const urlParams = new URLSearchParams(window.location.search);
const sessionName = urlParams.get('session') || 'default-run';

// DOM Elements
const weightSlider = document.getElementById('weight-slider');
const weightVal = document.getElementById('weight-val');
const sessionDisplay = document.getElementById('session-display');
const syncBadge = document.getElementById('sync-badge');
const syncText = document.getElementById('sync-text');

// Ingredients elements
const ingLeanMeat = document.getElementById('ing-lean-meat');
const ingTrimmings = document.getElementById('ing-trimmings');
const ingHardFat = document.getElementById('ing-hard-fat');
const ingJalapenos = document.getElementById('ing-jalapenos');
const ingCheddar = document.getElementById('ing-cheddar');
const ingPepper = document.getElementById('ing-pepper');
const ingMilk = document.getElementById('ing-milk');
const ingWater = document.getElementById('ing-water');
const ingWaterHalf = document.getElementById('ing-water-half');
const ingSalt = document.getElementById('ing-salt');
const ingCuringSalt = document.getElementById('ing-curing-salt');

// Estimator elements
const estStuffedWeight = document.getElementById('est-stuffed-weight');
const estLinksExpected = document.getElementById('est-links-expected');
const estTwists = document.getElementById('est-twists');
const estFourLinkRuns = document.getElementById('est-four-link-runs');

// Controls
const btnMinus5 = document.getElementById('btn-minus-5');
const btnMinus1 = document.getElementById('btn-minus-1');
const btnPlus1 = document.getElementById('btn-plus-1');
const btnPlus5 = document.getElementById('btn-plus-5');
const btnReset = document.getElementById('btn-reset');
const btnShare = document.getElementById('btn-share');
const btnShortcut = document.getElementById('btn-shortcut');

// Task rows
const taskRows = document.querySelectorAll('.task-row');

// Initialize App
function init() {
  sessionDisplay.textContent = `Session: ${sessionName.toUpperCase()}`;
  
  // Set up task row click events
  taskRows.forEach(row => {
    row.addEventListener('click', () => {
      const stepIndex = parseInt(row.getAttribute('data-step')) - 1;
      state.tasks[stepIndex] = !state.tasks[stepIndex];
      state.lastUpdated = Date.now();
      
      updateUI();
      saveState();
    });
  });

  // Slider change event
  weightSlider.addEventListener('input', (e) => {
    state.weight = parseFloat(e.target.value);
    state.lastUpdated = Date.now();
    updateUI();
    saveState();
  });

  // Macro adjustments for slider
  btnMinus5.addEventListener('click', () => adjustWeight(-5));
  btnMinus1.addEventListener('click', () => adjustWeight(-1));
  btnPlus1.addEventListener('click', () => adjustWeight(1));
  btnPlus5.addEventListener('click', () => adjustWeight(5));

  // Bottom action buttons
  btnReset.addEventListener('click', resetRun);
  btnShortcut.addEventListener('click', triggerShortcut);
  btnShare.addEventListener('click', copyShareLink);

  // Load state from local storage first (instant responsiveness)
  loadLocalState();
  updateUI();

  // Load and subscribe to cloud state
  syncWithCloud();
  setInterval(pollCloudState, 5000);
}

// Adjust weight via buttons
function adjustWeight(amount) {
  let target = state.weight + amount;
  if (target < 5) target = 5;
  if (target > 150) target = 150;
  state.weight = target;
  state.lastUpdated = Date.now();
  weightSlider.value = target;
  updateUI();
  saveState();
}

// Update DOM elements based on state
function updateUI() {
  // Update weight values
  weightVal.textContent = state.weight.toFixed(1);
  weightSlider.value = state.weight;

  // Recipe Calculations (Base = 50 lbs)
  const scale = state.weight / 50.0;
  
  ingLeanMeat.textContent = (25.5 * scale).toFixed(2);
  ingTrimmings.textContent = (16.0 * scale).toFixed(2);
  ingHardFat.textContent = (8.5 * scale).toFixed(2);
  ingJalapenos.textContent = (2.0 * scale).toFixed(2);
  ingCheddar.textContent = (5.0 * scale).toFixed(2);
  ingPepper.textContent = (1.5 * scale).toFixed(2);
  ingMilk.textContent = (4.5 * scale).toFixed(2);
  
  const totalWater = 10.0 * scale;
  ingWater.textContent = totalWater.toFixed(2);
  ingWaterHalf.textContent = (totalWater / 2).toFixed(2);
  
  ingSalt.textContent = Math.round(454 * scale);
  ingCuringSalt.textContent = Math.round(60 * scale);

  // Link Estimations
  // Total Stuffed Weight: Sum of the meat batch (lean+trimmings+fat), cheese, and jalapeños
  const totalStuffed = (25.5 + 16.0 + 8.5 + 2.0 + 5.0) * scale;
  estStuffedWeight.textContent = totalStuffed.toFixed(1);
  
  // Total Links: Stuffed Weight * 2.6
  const totalLinks = totalStuffed * 2.6;
  const roundedLinks = Math.round(totalLinks);
  estLinksExpected.textContent = roundedLinks;

  // Total Twists: Total Links * 5
  estTwists.textContent = Math.round(totalLinks * 5);

  // 4-Link Twisting Runs: Division of total links by 4
  const completeCycles = Math.floor(roundedLinks / 4);
  const remainderLinks = roundedLinks % 4;
  estFourLinkRuns.textContent = `${completeCycles} cycles + ${remainderLinks} left`;

  // Update Task Checkbox states
  taskRows.forEach(row => {
    const stepIndex = parseInt(row.getAttribute('data-step')) - 1;
    if (state.tasks[stepIndex]) {
      row.classList.add('checked');
    } else {
      row.classList.remove('checked');
    }
  });
}

// Reset Run Function
function resetRun() {
  if (confirm("Are you sure you want to reset all tasks?")) {
    state.tasks = Array(15).fill(false);
    state.lastUpdated = Date.now();
    updateUI();
    saveState();
  }
}

// Pitmaster Shortcut Function (Marks steps 1 to 12 complete)
function triggerShortcut() {
  for (let i = 0; i < 12; i++) {
    state.tasks[i] = true;
  }
  state.lastUpdated = Date.now();
  updateUI();
  saveState();
}

// Share status link copier
function copyShareLink() {
  const currentUrl = new URL(window.location.href);
  currentUrl.searchParams.set('session', sessionName);
  
  navigator.clipboard.writeText(currentUrl.toString())
    .then(() => {
      alert(`Live session link copied to clipboard!\nShare this with anyone to let them track progress.`);
    })
    .catch(err => {
      console.error('Could not copy text: ', err);
    });
}

// Persistence: Local Storage
function loadLocalState() {
  const local = localStorage.getItem(`sausage_run_${sessionName}`);
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (parsed.weight && Array.isArray(parsed.tasks)) {
        state = parsed;
      }
    } catch (e) {
      console.error("Error parsing local state", e);
    }
  }
}

let saveDebounceTimer;
function saveState() {
  // Save locally instantly
  localStorage.setItem(`sausage_run_${sessionName}`, JSON.stringify(state));

  // Debounce saving to cloud to prevent rapid multiple updates
  clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(uploadStateToCloud, 600);
}

// Sync Status styling utility
function setSyncStatus(status, text) {
  syncBadge.className = `sync-badge ${status}`;
  syncText.textContent = text;
}

// Cloud REST API URLs
const cloudUrl = `https://kvdb.io/${BUCKET_ID}/sausage-state-${sessionName}`;

// Cloud sync routines
function uploadStateToCloud() {
  setSyncStatus('syncing', 'Syncing...');
  
  fetch(cloudUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(state)
  })
  .then(res => {
    if (!res.ok) throw new Error('Network error');
    setSyncStatus('live', 'Live');
  })
  .catch(err => {
    console.warn('Sync failed, offline mode active:', err);
    setSyncStatus('offline', 'Offline');
  });
}

function syncWithCloud() {
  setSyncStatus('syncing', 'Connecting...');
  
  fetch(cloudUrl)
    .then(res => {
      if (res.status === 404) {
        // No remote data yet, push our current state
        uploadStateToCloud();
        return null;
      }
      if (!res.ok) throw new Error('Fetch failed');
      return res.json();
    })
    .then(remoteState => {
      if (remoteState && remoteState.lastUpdated) {
        // If remote state is newer or we don't have local differences, apply it
        if (remoteState.lastUpdated > (state.lastUpdated || 0)) {
          state = remoteState;
          updateUI();
          localStorage.setItem(`sausage_run_${sessionName}`, JSON.stringify(state));
        }
      }
      setSyncStatus('live', 'Live');
    })
    .catch(err => {
      console.warn('Could not contact sync backend, operating offline:', err);
      setSyncStatus('offline', 'Offline');
    });
}

function pollCloudState() {
  fetch(cloudUrl)
    .then(res => {
      if (!res.ok) return null;
      return res.json();
    })
    .then(remoteState => {
      if (remoteState && remoteState.lastUpdated) {
        // Only update if remote state has a newer timestamp
        if (remoteState.lastUpdated > state.lastUpdated) {
          state = remoteState;
          updateUI();
          localStorage.setItem(`sausage_run_${sessionName}`, JSON.stringify(state));
        }
      }
      setSyncStatus('live', 'Live');
    })
    .catch(() => {
      setSyncStatus('offline', 'Offline');
    });
}

// Run init
window.addEventListener('DOMContentLoaded', init);
