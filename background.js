// Store the last activity to detect changes
let previousSession = {
  url: "",
  title: "",
  timestamp: 0, // Store as number (ms since epoch)
  duration: 0,
  hasFragments: false,
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
const enterSite = (url, title) => {
  console.log('enterSite called with:', { url, title });
  
  if (url === previousSession.url && title === previousSession.title) {
    console.log('Same URL/title, returning early');
    return;
  }

  const now = Date.now();
  const minimumDuration = 5000; // 5 seconds, in ms

  // Calculate duration of last session
  if (previousSession.timestamp) {
    const duration = now - previousSession.timestamp;
    previousSession.duration = duration; // Keep in milliseconds
    console.log('Previous session duration:', previousSession.duration, 'ms');
  }

  // Helper: finalize and push a session
  const pushSession = (session) => {
    console.log('pushSession called with:', session);
    activityList.push({
      ...session,
      timestamp: new Date(session.timestamp).toISOString(),
    });
    console.log("Activity tracked:", session);
    console.log("Current activityList length:", activityList.length);
    chrome.storage.local.set({ activityList }, () => {
      console.log('Activity list saved to storage');
    });
  };

  // Case 1: Previous session has fragments
  if (previousSession.hasFragments) {
    console.log('Previous session has fragments');
    if (previousSession.duration >= minimumDuration) {
      console.log('Previous session duration >= minimum, pushing fragments and current session');
      // Previous session has fragments AND itself is long enough
      // Push fragments as a session, then push itself as a session
      const fragmentedSession = {
        ...previousSession,
        title: "fragmented",
        url: "fragmented",
        duration: previousSession.fragmentedDuration,
      };
      pushSession(fragmentedSession);
      
      const previousSessionCopy = {
        ...previousSession,
        fragmentedDuration: 0,
        fragmentedActivity: [],
        hasFragments: false,
      };
      pushSession(previousSessionCopy);
    } else if (previousSession.fragmentedDuration + previousSession.duration >= minimumDuration) {
      console.log('Combined duration >= minimum, pushing combined fragments');
      // Previous session has fragments, itself is short, but together they're long enough
      // Add itself to fragments and push combined
      const alreadyInFragments = previousSession.fragmentedActivity.includes(previousSession.title);
      const combinedFragments = {
        ...previousSession,
        title: "fragmented",
        url: "fragmented",
        duration: previousSession.fragmentedDuration + previousSession.duration,
        fragmentedActivity: alreadyInFragments
          ? [...previousSession.fragmentedActivity]
          : [...previousSession.fragmentedActivity, previousSession.title],
      };
      pushSession(combinedFragments);
    } else {
      console.log('Combined duration still < minimum, adding to fragments');
      // Previous session has fragments, itself is short, together still short
      // Add itself to fragments, don't push anything
      const alreadyInFragments = previousSession.fragmentedActivity.includes(previousSession.title);
      previousSession = {
        ...previousSession,
        fragmentedDuration: previousSession.fragmentedDuration + previousSession.duration,
        fragmentedActivity: alreadyInFragments
          ? [...previousSession.fragmentedActivity]
          : [...previousSession.fragmentedActivity, previousSession.title],
      };
    }
  } else {
    console.log('Previous session has no fragments');
    // Case 2: Previous session has no fragments
    if (previousSession.duration >= minimumDuration) {
      console.log('Previous session duration >= minimum, pushing current session');
      // Previous session no fragments + itself is long enough
      // Push itself
      const previousSessionCopy = {
        ...previousSession,
        fragmentedActivity: [],
      };
      pushSession(previousSessionCopy);
    } else {
      console.log('Previous session duration < minimum, adding to fragments');
      // Previous session no fragments + itself is short
      // Add itself to fragments, don't push
      previousSession = {
        ...previousSession,
        hasFragments: true,
        fragmentedDuration: previousSession.duration,
        fragmentedActivity: previousSession.title ? [previousSession.title] : [],
      };
    }
  }

  // Start a new session with new title, url, and timestamp, retain fragments if any
  previousSession = {
    ...previousSession,
    url,
    title,
    timestamp: now,
    duration: 0,
  };

  console.log('New previousSession:', previousSession);

  // Persist previousSession only (activityList is saved in pushSession)
  chrome.storage.local.set({ previousSession }, () => {
    console.log('Previous session saved to storage');
  });

  // Send to n8n every time activity is updated, temp disabled
  /*
  if (activityList.length >= 1) {
    console.log("Sending activity to n8n:", activityList);
    sendToN8n(activityList);
    // Reset activities after sending
    activityList = [];
    chrome.storage.local.set({ activityList });
  }
  */
  return;
};

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
