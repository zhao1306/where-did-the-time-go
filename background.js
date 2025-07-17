// Store the last activity to detect changes
let currentSession = {
  url: "",
  title: "",
  timestamp: 0, // Store as number (ms since epoch)
  duration: 0,
  isFragmented: false,
  fragmentedDuration: 0,
  fragmentedActivity: [],
};

// Restore currentSession from storage on startup
chrome.storage.local.get(["currentSession"], (result) => {
  if (result.currentSession) {
    currentSession = result.currentSession;
  }
});

let activityList = [];

// Restore activityList from storage on startup
chrome.storage.local.get(["activityList"], (result) => {
  if (result.activityList) {
    activityList = result.activityList;
  }
});

// Track when a tab is updated (page load completes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
   finalizeSession(tab.url, tab.title);
  }
});

// Track when user switches tabs
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
   finalizeSession(tab.url, tab.title);
  });
});

// Core processing function
function finalizeSession(url, title) {
  if (url === currentSession.url && title === currentSession.title) {
    return;
  }

  const now = Date.now();
  const minimumDuration = 60000;

  // Calculate duration of last session
  if (currentSession.timestamp) {
    const duration = now - currentSession.timestamp;
    currentSession.duration = Math.floor(duration / 1000); // Convert to seconds
  }

  let finalizedSession = null;

  // Helper: finalize and push a session
  function pushSession(session) {
    activityList.push({
      ...session,
      timestamp: new Date(session.timestamp).toISOString(),
      // Only keep titles in fragmentedActivity
      fragmentedActivity: session.fragmentedActivity ? [...session.fragmentedActivity] : [],
    });
    console.log("Activity tracked:", session);
  }

  // Case 1: Previous session was fragmented
  if (currentSession.isFragmented) {
    // Add the last activity's title to the fragmentedActivity array
    if (currentSession.title) {
      if (!currentSession.fragmentedActivity) currentSession.fragmentedActivity = [];
      currentSession.fragmentedActivity.push(currentSession.title);
      currentSession.fragmentedDuration += currentSession.duration;
    }
    // If total fragmented duration now exceeds minimum, finalize the fragmented session
    if (currentSession.fragmentedDuration > minimumDuration) {
      finalizedSession = {
        ...currentSession,
        duration: currentSession.fragmentedDuration,
        // Only keep titles in fragmentedActivity
        fragmentedActivity: [...currentSession.fragmentedActivity],
      };
      pushSession(finalizedSession);
      // Start a new session (could be long or fragment, handled below)
      currentSession = {
        url,
        title,
        timestamp: now,
        duration: 0,
        isFragmented: false,
        fragmentedDuration: 0,
        fragmentedActivity: [],
      };
    } else {
      // Not enough total duration yet, keep accumulating
      currentSession.fragmentedDuration += currentSession.duration;
      currentSession = {
        ...currentSession,
        url,
        title,
        timestamp: now,
        duration: 0,
        isFragmented: true,
        // Keep accumulating fragmentedDuration and fragmentedActivity
      };
    }
  } else {
    // Case 2: Previous session was long or first session
    if (currentSession.duration > minimumDuration) {
      // Finalize the long session
      finalizedSession = {
        ...currentSession,
        timestamp: new Date(currentSession.timestamp).toISOString(),
        fragmentedActivity: [],
      };
      pushSession(finalizedSession);
      // Start a new session (could be long or fragment, handled below)
      currentSession = {
        url,
        title,
        timestamp: now,
        duration: 0,
        isFragmented: false,
        fragmentedDuration: 0,
        fragmentedActivity: [],
      };
    } else {
      // Not long enough, start a new fragmented session
      currentSession = {
        url,
        title,
        timestamp: now,
        duration: 0,
        isFragmented: true,
        fragmentedDuration: currentSession.duration,
        fragmentedActivity: currentSession.title ? [currentSession.title] : [],
      };
    }
  }

  // Persist currentSession and activityList
  chrome.storage.local.set({ currentSession });
  chrome.storage.local.set({ activityList });

  // Send to n8n every time activity is updated
  if (activityList.length >= 1) {
    console.log("Sending activity to n8n:", activityList);
    sendToN8n(activityList);
    // Reset activities after sending
    activityList = [];
    chrome.storage.local.set({ activityList });
  }

  return;
}

// Sanitize URLs (remove personal data)
function sanitizeUrl(url) {
  try {
    const urlObj = new URL(url);
    // Clear sensitive query parameters
    ["session", "token", "password"].forEach((param) => {
      urlObj.searchParams.delete(param);
    });
    return urlObj.toString();
  } catch {
    return url;
  }
}

// Extract root domain, not used currently but can be useful
function extractDomain(url) {
  const matches = url.match(/^https?:\/\/(?:[^@\n]+@)?([^:\/\n]+)/im);
  return matches && matches.length >= 2 ? matches[1] : null;
}

const N8N_WEBHOOK =
  "https://fancy-terrier-super.ngrok-free.app/webhook/activity-tracker-justinzhao9909";
// Send data to n8n webhook
function sendToN8n(data) {
  fetch(N8N_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).catch((error) => {
    console.error("Failed to send activity:", error);
  });
}
