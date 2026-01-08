/**
 * Confirmation page script for CuraQ Saver
 * Handles article save confirmation from context menu
 */

const CURAQ_URL = 'https://curaq.pages.dev';

// UI elements
const loadingState = document.getElementById('loading-state');
const confirmationState = document.getElementById('confirmation-state');
const successState = document.getElementById('success-state');
const errorState = document.getElementById('error-state');

const articleTitle = document.getElementById('article-title');
const articleUrl = document.getElementById('article-url');
const errorMessage = document.getElementById('error-message');

const confirmButton = document.getElementById('confirm-button');
const confirmText = document.getElementById('confirm-text');
const confirmSpinner = document.getElementById('confirm-spinner');
const cancelButton = document.getElementById('cancel-button');
const retryButton = document.getElementById('retry-button');
const closeButton = document.getElementById('close-button');
const viewDashboardButton = document.getElementById('view-dashboard-button');

// All states
const allStates = [loadingState, confirmationState, successState, errorState];

// Store article data
let pendingArticle = null;

// State management
function showState(state) {
  allStates.forEach(s => s.classList.add('hidden'));

  switch (state) {
    case 'loading':
      loadingState.classList.remove('hidden');
      break;
    case 'confirmation':
      confirmationState.classList.remove('hidden');
      break;
    case 'success':
      successState.classList.remove('hidden');
      break;
    case 'error':
      errorState.classList.remove('hidden');
      break;
  }
}

// Parse URL parameters
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    url: params.get('url') || '',
    title: params.get('title') || ''
  };
}

// Send article to CuraQ
async function sendArticle() {
  if (!pendingArticle) return;

  try {
    // Disable button and show spinner
    confirmButton.disabled = true;
    confirmText.textContent = '送信中...';
    confirmSpinner.classList.remove('hidden');

    // Send message to background script
    const response = await chrome.runtime.sendMessage({
      action: 'sendArticleUrl',
      url: pendingArticle.url,
      title: pendingArticle.title
    });

    if (response.success) {
      showState('success');
    } else {
      errorMessage.textContent = response.error || '送信に失敗しました';
      showState('error');
    }
  } catch (error) {
    console.error('[CuraQ] Send error:', error);
    errorMessage.textContent = error.message || '送信に失敗しました';
    showState('error');
  } finally {
    // Re-enable button
    confirmButton.disabled = false;
    confirmText.textContent = '送信';
    confirmSpinner.classList.add('hidden');
  }
}

// Initialize page
function initialize() {
  const params = getUrlParams();

  if (!params.url) {
    errorMessage.textContent = 'URLが指定されていません';
    showState('error');
    return;
  }

  pendingArticle = params;
  articleTitle.textContent = params.title || params.url;
  articleUrl.textContent = params.url;

  showState('confirmation');
}

// Event listeners
confirmButton.addEventListener('click', sendArticle);

cancelButton.addEventListener('click', () => {
  window.close();
});

retryButton.addEventListener('click', () => {
  showState('confirmation');
});

closeButton.addEventListener('click', () => {
  window.close();
});

viewDashboardButton.addEventListener('click', () => {
  window.open(CURAQ_URL, '_blank');
  window.close();
});

// Initialize on load
initialize();
