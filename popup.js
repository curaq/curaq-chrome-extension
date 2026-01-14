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

  // Check if token exists and is valid
  const response = await chrome.runtime.sendMessage({ action: 'checkToken' });
  console.log('[CuraQ Popup] Initial token check:', response);
  window.tokenStatus = response;

  if (response.valid) {
    // Valid Pro token: show ready state without hint
    previousState = 'ready';
    showState('ready');
    document.getElementById('no-token-hint').classList.add('hidden');
  } else if (response.error === 'no-token') {
    // No token saved: show hint to set up token
    previousState = 'ready';
    showState('ready');
    document.getElementById('no-token-hint').classList.remove('hidden');
  } else {
    // Token exists but invalid/no-pro: show hint but keep token
    previousState = 'ready';
    showState('ready');
    document.getElementById('no-token-hint').classList.remove('hidden');
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
  console.log('[CuraQ Popup] Token check response:', response);

  window.tokenStatus = response;

  if (response.valid) {
    previousState = 'ready';
    showState('ready');
    // Hide Pro plan hint when token is valid
    document.getElementById('no-token-hint').classList.add('hidden');
  } else if (response.error === 'no-pro-plan') {
    // Token is valid but user doesn't have Pro plan - keep token
    previousState = 'ready';
    showState('ready');
    // Show Pro plan hint for non-Pro users
    document.getElementById('no-token-hint').classList.remove('hidden');
  } else {
    // Token invalid - show error but don't delete immediately
    console.warn('[CuraQ Popup] Token validation failed:', response.error);
    errorMessage.textContent = `トークンの検証に失敗しました: ${response.error}`;
    showState('error');
  }
}

// Store article data for confirmation
let pendingArticle = null;

// Save current article
async function saveCurrentArticle() {
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check if user has token
    const tokenStatus = window.tokenStatus || { valid: false };

    if (tokenStatus.valid) {
      // Pro user with valid token: show confirmation in popup
      pendingArticle = {
        url: tab.url,
        title: tab.title || ''
      };

      // Update confirmation UI
      document.getElementById('confirm-title').textContent = pendingArticle.title;
      document.getElementById('confirm-url').textContent = pendingArticle.url;

      // Show confirmation state
      showState('confirmation');
    } else {
      // Free user or no token: open share page in new tab
      saveButton.disabled = true;
      saveButtonText.textContent = '開いています...';
      saveSpinner.classList.remove('hidden');

      const response = await chrome.runtime.sendMessage({
        action: 'saveArticle',
        tabId: tab.id
      });

      if (response.success) {
        // Share page opened in new tab, close popup
        window.close();
      } else {
        errorMessage.textContent = response.error || '保存に失敗しました';
        showState('error');
      }

      // Re-enable button
      saveButton.disabled = false;
      saveButtonText.textContent = 'この記事を保存';
      saveSpinner.classList.add('hidden');
    }
  } catch (error) {
    console.error('[CuraQ] Save error:', error);
    errorMessage.textContent = error.message || '保存に失敗しました';
    showState('error');
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
      // Auto-close popup after 1.5 seconds
      setTimeout(() => {
        window.close();
      }, 1500);
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
  console.log('[CuraQ Popup] Token cleared');
  window.tokenStatus = { valid: false, error: 'no-token' };
  // Go back to ready state and re-check status
  checkTokenStatus();
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
  checkTokenStatus();
});

// Confirmation screen buttons
document.getElementById('confirm-send-button').addEventListener('click', () => {
  sendConfirmedArticle();
});

document.getElementById('cancel-button').addEventListener('click', () => {
  pendingArticle = null;
  showState('ready');
});

// Settings toggle
if (settingsToggle) {
  settingsToggle.addEventListener('click', async () => {
    if (!settingsState.classList.contains('hidden')) {
      // Already in settings, go back
      checkTokenStatus();
    } else {
      // Show settings
      showState('settings');

      // Check if token is saved (not just valid)
      const response = await chrome.runtime.sendMessage({ action: 'checkToken' });
      console.log('[CuraQ Popup] Settings opened, token status:', response);

      const tokenNotSetSection = document.getElementById('token-not-set-section');
      const tokenSetSection = document.getElementById('token-set-section');

      if (response.error === 'no-token') {
        // No token saved at all
        tokenNotSetSection.classList.remove('hidden');
        tokenSetSection.classList.add('hidden');
      } else {
        // Token is saved (valid or not)
        tokenNotSetSection.classList.add('hidden');
        tokenSetSection.classList.remove('hidden');
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

// Setup token button from hint
document.getElementById('setup-token-button').addEventListener('click', () => {
  showState('settings');
  // Update settings UI to show token input
  document.getElementById('token-not-set-section').classList.remove('hidden');
  document.getElementById('token-set-section').classList.add('hidden');
});

// Initialize popup
checkTokenStatus();
