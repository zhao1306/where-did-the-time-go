// Store the last activity to detect changes
let previousSession = {
  url: "",
  title: "",
  timestamp: 0, // Store as number (ms since epoch)
  duration: 0,
  isFragmented: false,
  fragmentedDuration: 0,
  fragmentedActivity: [],
};

// Restore previousSession from storage on startup
chrome.storage.local.get(["previousSession"], (result) => {
  if (result.previousSession) {
    previousSession = result.previousSession;
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
   enterSite(tab.url, tab.title);
  }
});

// Track when user switches tabs
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
   enterSite(tab.url, tab.title);
  });
});

// Core processing function
function enterSite(url, title) {
  if (url === previousSession.url && title === previousSession.title) {
    return;
  }

  const now = Date.now();
  const minimumDuration = 60000;

  // Calculate duration of last session
  if (previousSession.timestamp) {
    const duration = now - previousSession.timestamp;
    previousSession.duration = Math.floor(duration / 1000); // Convert to seconds
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
  if (previousSession.isFragmented) {
    if (previousSession.title && (previousSession.fragmentedDuration + previousSession.duration) > minimumDuration) {
      
    }
    // If total fragmented duration now exceeds minimum, finalize the fragmented session
    if (previousSession.fragmentedDuration > minimumDuration) {
      finalizedSession = {
        ...previousSession,
        duration: previousSession.fragmentedDuration,
        // Only keep titles in fragmentedActivity
        fragmentedActivity: [...previousSession.fragmentedActivity],
      };
      pushSession(finalizedSession);
      // Start a new session (could be long or fragment, handled below)
      previousSession = {
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
      previousSession = {
        ...previousSession,
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
    if (previousSession.duration > minimumDuration) {
      // Finalize the long session
      finalizedSession = {
        ...previousSession,
        timestamp: new Date(previousSession.timestamp).toISOString(),
        fragmentedActivity: [],
      };
      pushSession(finalizedSession);
      // Start a new session (could be long or fragment, handled below)
      previousSession = {
        url,
        title,
        timestamp: now,
        duration: 0,
        isFragmented: false,
        fragmentedDuration: 0,
        fragmentedActivity: [],
      };
    } else {
      // Not long enough, start a new fragmented session using the current session data
      previousSession = {
        ...previousSession,
        isFragmented: true,
        fragmentedDuration: previousSession.duration,
        fragmentedActivity: previousSession.title ? [previousSession.title] : [],
      };
    }
  }

  // Persist previousSession and activityList
  chrome.storage.local.set({ previousSession });
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
