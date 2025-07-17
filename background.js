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
  const now = Date.now();
  const minimumDuration = 60000;

  // Calculate duration of last session
  if (currentSession.timestamp) {
    const duration = now - currentSession.timestamp;
    currentSession.duration = Math.floor(duration / 1000); // Convert to seconds
  }

  if (currentSession.isFragmented) {
    
    if (currentSession.duration > minimumDuration) {
       // finilize fragmented session and add to activityList
       activityList.push({
        ...currentSession,
        timestamp: new Date(currentSession.timestamp).toISOString(),
      });
      console.log("Activity tracked:", currentSession);
      // also push the current session to the activityList
      activityList.push({
        ...currentSession,
        timestamp: new Date(currentSession.timestamp).toISOString(),
      });
    }
    else {
      // just put the current session into the fragmented activity list
      currentSession.fragmentedActivity.push(currentSession.title);
      currentSession.fragmentedDuration += currentSession.duration;
      // if the fragmented duration is greater than the minimum duration, finalize the session
      if (currentSession.fragmentedDuration > minimumDuration) {
        // finilize fragmented session and add to activityList
        activityList.push({
          ...currentSession,
          timestamp: new Date(currentSession.timestamp).toISOString(),
        });
      }
    }
  }

  else if (currentSession.duration > minimumDuration) {
    // Push a copy with ISO timestamp for sending
    activityList.push({
      ...currentSession,
      timestamp: new Date(currentSession.timestamp).toISOString(),
    });
    console.log("Activity tracked:", currentSession);
      // Update last activity
  let newSession = {
    url,
    title,
    timestamp: now, // Store as number
    duration: 0,
    isFragmented: false,
    fragmentedDuration: 0,
    fragmentedActivity: [],
  };
  }
  else {
    //  create new fragmented activity
    currentSession.isFragmented = true;
    currentSession.fragmentedDuration = currentSession.duration;
    currentSession.fragmentedActivity.push(currentSession.title);

  }

      // Update last activity
      let newSession = {
        url,
        title,
        timestamp: now, // Store as number
        duration: 0,
        isFragmented: currentSession.isFragmented,
        fragmentedDuration: currentSession.fragmentedDuration,
        fragmentedActivity: currentSession.fragmentedActivity,

      };
  // Persist newSession to storage
  chrome.storage.local.set({ currentSession: newSession });
  // Persist activityList to storage
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
