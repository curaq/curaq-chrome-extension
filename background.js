/**
 * Background Service Worker for CuraQ Saver
 * Handles context menu and API communication with token auth
 */

// CuraQ API endpoint
const CURAQ_API_URL = 'https://curaq.pages.dev/api/v1';
// For local development, uncomment:
// const CURAQ_API_URL = 'http://localhost:5173/api/v1';

// Create context menu on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-to-curaq',
    title: 'CuraQに保存',
    contexts: ['page']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'save-to-curaq') {
    // Show immediate feedback
    showNotification('保存中...', 'CuraQに記事を保存しています');

    try {
      await saveArticleToCuraQ(tab);
    } catch (error) {
      console.error('[CuraQ] Context menu save error:', error);
      showNotification('エラー', '記事の保存に失敗しました');
    }
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveArticle') {
    // Get the tab to save
    chrome.tabs.get(request.tabId, async (tab) => {
      const result = await saveArticleToCuraQ(tab);
      sendResponse(result);
    });
    return true;
  }

  if (request.action === 'checkToken') {
    checkTokenValid().then(sendResponse);
    return true;
  }

  if (request.action === 'saveToken') {
    chrome.storage.local.set({ apiToken: request.token }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'clearToken') {
    chrome.storage.local.remove('apiToken', () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

/**
 * Get API token from storage
 */
async function getApiToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get('apiToken', (result) => {
      resolve(result.apiToken || null);
    });
  });
}

/**
 * Check if token is valid by making a test request
 */
async function checkTokenValid() {
  const token = await getApiToken();

  if (!token) {
    return { valid: false, error: 'no-token' };
  }

  try {
    const response = await fetch(`${CURAQ_API_URL}/articles?limit=1`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'invalid-token' };
    } else if (response.status === 403) {
      return { valid: false, error: 'no-pro-plan' };
    } else {
      return { valid: false, error: `api-error-${response.status}` };
    }
  } catch (error) {
    console.error('[CuraQ] Token check failed:', error);
    return { valid: false, error: 'network-error' };
  }
}

/**
 * Extract article content and save to CuraQ
 */
async function saveArticleToCuraQ(tab) {
  try {
    const token = await getApiToken();

    if (!token) {
      showNotification('未設定', 'APIトークンが設定されていません');
      return { success: false, error: 'APIトークンが設定されていません' };
    }

    // Send message to content script to extract article
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'extractContent'
    });

    if (!response.success) {
      const errorMsg = response.error || '記事の抽出に失敗しました';
      showNotification('エラー', errorMsg);
      return { success: false, error: errorMsg };
    }

    const { title, url, markdown } = response.data;

    // Send to CuraQ API with token auth
    const apiResponse = await fetch(`${CURAQ_API_URL}/articles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ url, title, markdown })
    });

    const result = await apiResponse.json();

    if (apiResponse.ok && result.success) {
      const message = result.restored
        ? `「${title}」を再登録しました`
        : `「${title}」をCuraQに保存しました`;
      showNotification('保存完了', message);
      return { success: true };
    }

    // Handle specific errors
    const errorMessages = {
      'unread-limit': '未読記事が30件に達しています',
      'limit-reached': '今月の記事保存上限に達しました',
      'already-read': 'この記事は既に読了済みです',
      'invalid-content': 'このコンテンツは保存できません',
      'fetch-timeout': '記事の取得がタイムアウトしました'
    };

    const errorMsg = errorMessages[result.error] || result.message || `保存に失敗しました (${apiResponse.status})`;
    showNotification('エラー', errorMsg);
    return { success: false, error: errorMsg };

  } catch (error) {
    console.error('[CuraQ] Save error:', error);
    const errorMsg = error.message || '記事の保存に失敗しました';
    showNotification('エラー', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Show notification to user
 */
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: title,
    message: message,
    priority: 2
  });
}
