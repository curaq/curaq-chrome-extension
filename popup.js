/**
 * Popup Script for CuraQ Saver
 * Handles UI state and user interactions with token-based auth
 */

const CURAQ_URL = 'https://curaq.app';

// UI elements
const loadingState = document.getElementById('loading-state');
const noTokenState = document.getElementById('no-token-state');
const invalidTokenState = document.getElementById('invalid-token-state');
const noProState = document.getElementById('no-pro-state');
const readyState = document.getElementById('ready-state');
const successState = document.getElementById('success-state');
const errorState = document.getElementById('error-state');
const confirmationState = document.getElementById('confirmation-state');
const settingsState = document.getElementById('settings-state');

const settingsToggle = document.getElementById('settings-toggle');
const tokenInput = document.getElementById('token-input');
const tokenInputRetry = document.getElementById('token-input-retry');
const tokenInputSettings = document.getElementById('token-input-settings');
const saveTokenButton = document.getElementById('save-token-button');
const saveTokenRetryButton = document.getElementById('save-token-retry-button');
const saveTokenSettingsButton = document.getElementById('save-token-settings-button');
const saveButton = document.getElementById('save-button');
const saveButtonText = document.getElementById('save-button-text');
const saveSpinner = document.getElementById('save-spinner');
const viewDashboardButton = document.getElementById('view-dashboard-button');
const retryButton = document.getElementById('retry-button');
const errorMessage = document.getElementById('error-message');
const backButton = document.getElementById('back-button');
const clearTokenButton = document.getElementById('clear-token-button');

// Track previous state for settings back button
let previousState = 'ready';

// All states
const allStates = [
  loadingState,
  noTokenState,
  invalidTokenState,
  noProState,
  readyState,
  successState,
  errorState,
  confirmationState,
  settingsState
];

// State management
function showState(state) {
  allStates.forEach(s => s.classList.add('hidden'));

  switch (state) {
    case 'loading':
      loadingState.classList.remove('hidden');
      break;
    case 'no-token':
      noTokenState.classList.remove('hidden');
      break;
    case 'invalid-token':
      invalidTokenState.classList.remove('hidden');
      break;
    case 'no-pro':
      noProState.classList.remove('hidden');
      break;
    case 'ready':
      readyState.classList.remove('hidden');
      break;
    case 'success':
      successState.classList.remove('hidden');
      break;
    case 'error':
      errorState.classList.remove('hidden');
      break;
    case 'confirmation':
      confirmationState.classList.remove('hidden');
      break;
    case 'settings':
      settingsState.classList.remove('hidden');
      break;
  }
}

// Check token status
async function checkTokenStatus() {
  showState('loading');

  const response = await chrome.runtime.sendMessage({ action: 'checkToken' });

  // Always allow saving - token is optional now
  previousState = 'ready';
  showState('ready');

  // Store token status for UI hints
  window.tokenStatus = response;

  // Show Pro plan hint if no valid token
  const noTokenHint = document.getElementById('no-token-hint');
  if (!response.valid) {
    noTokenHint.classList.remove('hidden');
  } else {
    noTokenHint.classList.add('hidden');
  }
}

// Save token
async function saveToken(token) {
  if (!token || token.trim().length === 0) {
    return;
  }

  showState('loading');

  // Save token first
  await chrome.runtime.sendMessage({ action: 'saveToken', token: token.trim() });

  // Verify it works
  const response = await chrome.runtime.sendMessage({ action: 'checkToken' });

  window.tokenStatus = response;

  if (response.valid) {
    previousState = 'ready';
    showState('ready');
    // Hide Pro plan hint when token is valid
    document.getElementById('no-token-hint').classList.add('hidden');
  } else if (response.error === 'no-pro-plan') {
    previousState = 'ready';
    showState('ready');
    // Show Pro plan hint for non-Pro users
    document.getElementById('no-token-hint').classList.remove('hidden');
  } else {
    // Token invalid - clear it and show error
    await chrome.runtime.sendMessage({ action: 'clearToken' });
    previousState = 'ready';
    showState('ready');
    // Show Pro plan hint
    document.getElementById('no-token-hint').classList.remove('hidden');
  }
}

// Store article data for confirmation
let pendingArticle = null;

// Save current article
async function saveCurrentArticle() {
  try {
    // Disable button and show spinner
    saveButton.disabled = true;
    saveButtonText.textContent = '確認中...';
    saveSpinner.classList.remove('hidden');

    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Send message to background script to prepare article
    const response = await chrome.runtime.sendMessage({
      action: 'saveArticle',
      tabId: tab.id
    });

    if (response.success) {
      if (response.tokenless) {
        // No token mode: opened in new tab, close popup
        window.close();
      } else if (response.needsConfirmation) {
        // Token mode: show confirmation screen
        pendingArticle = { url: response.url, title: response.title };
        document.getElementById('confirm-title').textContent = response.title;
        document.getElementById('confirm-url').textContent = response.url;
        showState('confirmation');
      }
    } else {
      errorMessage.textContent = response.error || '保存に失敗しました';
      showState('error');
    }
  } catch (error) {
    console.error('[CuraQ] Save error:', error);
    errorMessage.textContent = error.message || '保存に失敗しました';
    showState('error');
  } finally {
    // Re-enable button
    saveButton.disabled = false;
    saveButtonText.textContent = 'この記事を保存';
    saveSpinner.classList.add('hidden');
  }
}

// Send article after confirmation
async function sendConfirmedArticle() {
  if (!pendingArticle) return;

  try {
    // Get button elements
    const confirmSendButton = document.getElementById('confirm-send-button');
    const confirmSendText = document.getElementById('confirm-send-text');
    const confirmSendSpinner = document.getElementById('confirm-send-spinner');

    // Disable button and show spinner
    confirmSendButton.disabled = true;
    confirmSendText.textContent = '送信中...';
    confirmSendSpinner.classList.remove('hidden');

    // Send article URL to server
    const response = await chrome.runtime.sendMessage({
      action: 'sendArticleUrl',
      url: pendingArticle.url,
      title: pendingArticle.title
    });

    if (response.success) {
      showState('success');
      pendingArticle = null;
    } else {
      errorMessage.textContent = response.error || '送信に失敗しました';
      showState('error');
    }
  } catch (error) {
    console.error('[CuraQ] Send error:', error);
    errorMessage.textContent = error.message || '送信に失敗しました';
    showState('error');
  }
}

// Clear token
async function clearToken() {
  await chrome.runtime.sendMessage({ action: 'clearToken' });
  window.tokenStatus = { valid: false, error: 'no-token' };
  previousState = 'ready';
  showState('ready');
  // Show Pro plan hint after clearing token
  document.getElementById('no-token-hint').classList.remove('hidden');
}

// Event listeners
saveTokenButton.addEventListener('click', () => {
  saveToken(tokenInput.value);
});

saveTokenRetryButton.addEventListener('click', () => {
  saveToken(tokenInputRetry.value);
});

saveTokenSettingsButton.addEventListener('click', () => {
  saveToken(tokenInputSettings.value);
});

// Allow Enter key to save token
tokenInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    saveToken(tokenInput.value);
  }
});

tokenInputRetry.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    saveToken(tokenInputRetry.value);
  }
});

tokenInputSettings.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    saveToken(tokenInputSettings.value);
  }
});

saveButton.addEventListener('click', () => {
  saveCurrentArticle();
});

viewDashboardButton.addEventListener('click', () => {
  chrome.tabs.create({ url: CURAQ_URL });
  window.close();
});

retryButton.addEventListener('click', () => {
  showState('ready');
});

// Confirmation screen buttons
document.getElementById('confirm-send-button').addEventListener('click', () => {
  sendConfirmedArticle();
});

document.getElementById('cancel-button').addEventListener('click', () => {
  pendingArticle = null;
  showState('ready');
});

// Settings toggle is temporarily disabled
if (settingsToggle) {
  settingsToggle.addEventListener('click', () => {
    if (!settingsState.classList.contains('hidden')) {
      // Already in settings, go back
      checkTokenStatus();
    } else {
      // Show settings
      showState('settings');

      // Update settings UI based on token status
      const tokenStatus = window.tokenStatus || { valid: false };
      const tokenNotSetSection = document.getElementById('token-not-set-section');
      const tokenSetSection = document.getElementById('token-set-section');

      if (tokenStatus.valid) {
        tokenNotSetSection.classList.add('hidden');
        tokenSetSection.classList.remove('hidden');
      } else {
        tokenNotSetSection.classList.remove('hidden');
        tokenSetSection.classList.add('hidden');
      }
    }
  });
}

backButton.addEventListener('click', () => {
  // Re-check token status to update UI hints
  checkTokenStatus();
});

clearTokenButton.addEventListener('click', () => {
  clearToken();
});

// Initialize popup
checkTokenStatus();
