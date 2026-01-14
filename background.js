/**
 * Background Service Worker for CuraQ Saver
 * Handles context menu and API communication with token auth
 */

// CuraQ API endpoint
const CURAQ_API_URL = 'https://curaq.app/api/v1';
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
      const url = tab.url;
      const title = tab.title || '';

      // Check if user has API token
      const token = await getApiToken();

      if (token) {
        // Token exists: open confirm.html in a small popup window
        const confirmUrl = chrome.runtime.getURL(`confirm.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`);
        chrome.windows.create({
          url: confirmUrl,
          type: 'popup',
          width: 500,
          height: 600,
          focused: true
        });
      } else {
        // No token: open /share page in new tab (traditional method)
        const shareUrl = `https://curaq.app/share?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
        chrome.tabs.create({ url: shareUrl });
      }
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
    // Send article URL to CuraQ API with token auth
    (async () => {
      try {
        const token = await getApiToken();
        if (!token) {
          sendResponse({ success: false, error: 'トークンが設定されていません' });
          return;
        }

        const response = await fetch(`${CURAQ_API_URL}/articles`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: request.url,
            title: request.title || ''
          })
        });

        const data = await response.json();

        if (response.ok) {
          sendResponse({ success: true });
          showNotification('保存完了', '記事をCuraQに保存しました');
        } else {
          const errorMsg = data.message || '記事の保存に失敗しました';
          sendResponse({ success: false, error: errorMsg });
          showNotification('エラー', errorMsg);
        }
      } catch (error) {
        console.error('[CuraQ] Send article URL error:', error);
        sendResponse({ success: false, error: '送信に失敗しました' });
        showNotification('エラー', '記事の送信に失敗しました');
      }
    })();
    return true;
  }

  if (request.action === 'checkToken') {
    // Check if the stored token is valid
    (async () => {
      const result = await checkTokenValid();
      sendResponse(result);
    })();
    return true;
  }

  // Token storage functions
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
    console.log('[CuraQ] No token found');
    return { valid: false, error: 'no-token' };
  }

  try {
    console.log('[CuraQ] Checking token validity at:', `${CURAQ_API_URL}/articles?limit=1`);
    const response = await fetch(`${CURAQ_API_URL}/articles?limit=1`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('[CuraQ] Token check response status:', response.status);

    if (response.ok) {
      console.log('[CuraQ] Token is valid');
      return { valid: true };
    } else if (response.status === 401) {
      console.log('[CuraQ] Token is invalid (401)');
      return { valid: false, error: 'invalid-token' };
    } else if (response.status === 403) {
      console.log('[CuraQ] No Pro plan (403)');
      return { valid: false, error: 'no-pro-plan' };
    } else {
      console.log('[CuraQ] API error:', response.status);
      const text = await response.text();
      console.log('[CuraQ] Response body:', text);
      return { valid: false, error: `api-error-${response.status}` };
    }
  } catch (error) {
    console.error('[CuraQ] Token check failed with error:', error);
    console.error('[CuraQ] Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return { valid: false, error: 'network-error', details: error.message };
  }
}

/**
 * Open CuraQ share page with current article URL and title
 * Note: This is only called for non-Pro users or users without tokens
 * Pro users with valid tokens use the in-popup confirmation flow
 */
async function saveArticleToCuraQ(tab) {
  try {
    const url = tab.url;
    const title = tab.title || '';

    // Open /share page in new tab (traditional method for free users)
    const shareUrl = `https://curaq.app/share?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
    chrome.tabs.create({ url: shareUrl });

    return { success: true };

  } catch (error) {
    console.error('[CuraQ] Share page open error:', error);
    const errorMsg = error.message || '記事情報の取得に失敗しました';
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
