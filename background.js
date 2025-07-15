// Store the last activity to detect changes
let lastActivity = {
  url: "",
  title: "",
  timestamp: 0, // Store as number (ms since epoch)
  duration: 0,
};

// Restore lastActivity from storage on startup
browser.storage.local.get("lastActivity").then((result) => {
  if (result.lastActivity) {
    lastActivity = result.lastActivity;
  }
});

let activityList = [];

// Restore activityList from storage on startup
browser.storage.local.get("activityList").then((result) => {
  if (result.activityList) {
    activityList = result.activityList;
  }
});

// Track when a tab is updated (page load completes)
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
    processActivity(tab.url, tab.title);
  }
});

// Track when user switches tabs
browser.tabs.onActivated.addListener((activeInfo) => {
  browser.tabs.get(activeInfo.tabId).then((tab) => {
    processActivity(tab.url, tab.title);
  });
});

// Core processing function
function processActivity(url, title) {
  // Skip if same URL as last
  if (url === lastActivity.url) {
    return;
  }
  const now = Date.now();

  sanitizedActivity = {
    url: sanitizeUrl(url),
    title: title,
    timestamp: new Date(now).toISOString(),
    duration: 0,
  };

  // Calculate duration of last activity
  if (lastActivity.url !== "" && lastActivity.timestamp) {
    const duration = now - lastActivity.timestamp;
    lastActivity.duration = Math.floor(duration / 1000); // Convert to seconds
  }

  if (
    lastActivity.url !== "" &&
    lastActivity.title !== "" &&
    lastActivity.duration > 10
  ) {
    // Push a copy with ISO timestamp for sending
    activityList.push({
      ...lastActivity,
      timestamp: new Date(lastActivity.timestamp).toISOString(),
    });
    console.log("Activity tracked:", lastActivity);
  }
  // Update last activity
  lastActivity = {
    url,
    title,
    timestamp: now, // Store as number
    duration: 0,
  };
  // Persist lastActivity to storage
  browser.storage.local.set({ lastActivity });
  // Persist activityList to storage
  browser.storage.local.set({ activityList });

  // Send to n8n every time activity is updated
  if (activityList.length >= 1) {
    console.log("Sending activity to n8n:", activityList);
    sendToN8n(activityList);
    // Reset activities after sending
    activityList = [];
    browser.storage.local.set({ activityList });
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
