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
    try {
      const token = await getApiToken();
      const url = tab.url;
      const title = tab.title || '';

      // If no token, open GET /share in new tab
      if (!token) {
        const shareUrl = `https://curaq.pages.dev/share?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
        chrome.tabs.create({ url: shareUrl });
        return;
      }

      // Token exists: open confirmation page
      const confirmUrl = chrome.runtime.getURL(`confirm.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`);
      chrome.tabs.create({ url: confirmUrl });
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

  if (request.action === 'sendArticleUrl') {
    sendArticleUrl(request.url, request.title).then(sendResponse);
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
 * Prepare article save (returns URL/title for confirmation)
 */
async function saveArticleToCuraQ(tab) {
  try {
    const token = await getApiToken();
    const url = tab.url;
    const title = tab.title || '';

    // If no token, open GET /share in new tab
    if (!token) {
      const shareUrl = `https://curaq.pages.dev/share?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
      chrome.tabs.create({ url: shareUrl });
      return { success: true, tokenless: true };
    }

    // Token exists: return URL/title for confirmation popup
    return {
      success: true,
      needsConfirmation: true,
      url,
      title
    };

  } catch (error) {
    console.error('[CuraQ] Preparation error:', error);
    const errorMsg = error.message || '記事情報の取得に失敗しました';
    return { success: false, error: errorMsg };
  }
}

/**
 * Send article URL to CuraQ API (no page content)
 */
async function sendArticleUrl(url, title) {
  try {
    const token = await getApiToken();

    if (!token) {
      return { success: false, error: 'トークンが設定されていません' };
    }

    // Send only URL and title to CuraQ API (server will fetch content)
    const apiResponse = await fetch(`${CURAQ_API_URL}/articles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ url, title })
    });

    const result = await apiResponse.json();

    if (apiResponse.ok && result.success) {
      const message = result.restored
        ? `「${title}」を再登録しました`
        : `「${title}」をCuraQに保存しました`;
      showNotification('保存完了', message);
      return { success: true, restored: result.restored };
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
    console.error('[CuraQ] Send error:', error);
    const errorMsg = error.message || '記事の送信に失敗しました';
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
    priority: 2,
    requireInteraction: true  // User must dismiss the notification
  });
}
