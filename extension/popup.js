// Promisified Chrome storage functions
const getFromStorage = (keys) => {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => resolve(result));
  });
};

const setInStorage = (items) => {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, () => resolve());
  });
};

// Utility to update current session
const updatepreviousSession = async (updater) => {
  const result = await getFromStorage(['previousSession']);
  let previousSession = result.previousSession;
  if (previousSession) {
    updater(previousSession);
    await setInStorage({ previousSession });
  }
};

const updateFragmentedButtonState = (previousSession) => {
  const fragmentedBtn = document.getElementById('fragmentedBtn');
  if (previousSession && previousSession.hasFragments) {
    fragmentedBtn.disabled = false;
    fragmentedBtn.classList.add('active');
  } else {
    fragmentedBtn.disabled = true;
    fragmentedBtn.classList.remove('active');
  }
};

// Helper to format duration as Xh Ym Zs
function formatDuration(ms) {
  if (!ms || isNaN(ms)) return 'N/A';
  let totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  let hours = Math.floor(totalSeconds / 3600);
  let minutes = Math.floor((totalSeconds % 3600) / 60);
  let seconds = totalSeconds % 60;
  let result = '';
  if (hours > 0) result += `${hours}h `;
  if (minutes > 0 || hours > 0) result += `${minutes}m `;
  result += `${seconds}s`;
  return result.trim();
}

const showpreviousSession = async () => {
  await updatepreviousSession((previousSession) => {
    if (previousSession.timestamp) {
      let duration = Date.now() - previousSession.timestamp;
      previousSession.duration = duration;
    }
  });
  const result = await getFromStorage(['previousSession']);
  const infoDiv = document.getElementById('activityInfo');
  if (result.previousSession) {
    const { url, title, timestamp, duration } = result.previousSession;
    infoDiv.innerHTML = `<b>Current Session:</b><br>URL: ${url}<br>Title: ${title}<br>Time: ${new Date(timestamp).toLocaleString()}<br>Duration: ${formatDuration(duration)}`;
    console.log("hasFragments: " + result.previousSession.hasFragments);
    updateFragmentedButtonState(result.previousSession);
  } else {
    infoDiv.textContent = 'No activity recorded yet.';
    updateFragmentedButtonState(null);
  }
};


document.getElementById('summary').addEventListener('click', async () => {
  // also process the current session
  await showpreviousSession();
  const result = await getFromStorage(['activityList']);
  const activityList = result.activityList || [];
  //send activityList to summary.js
  document.getElementById('activityInfo').textContent = 'Loading summary...';
  try {
    const summary = await fetch('https://where-did-the-time-go.vercel.app/api/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activityList, params: {} }),
    });
    const summaryData = await summary.json();
    console.log(summaryData);
    document.getElementById('activityInfo').textContent = summaryData.summary;
  } catch (e) {
    document.getElementById('activityInfo').textContent = 'Error fetching summary.';
  }
});

document.getElementById('currPage').addEventListener('click', showpreviousSession);

document.getElementById('clearActivity').addEventListener('click', async () => {
  await new Promise((resolve) => {
    chrome.runtime.sendMessage('clearAllActivity', (response) => {
      resolve();
    });
  });
  showpreviousSession();
});

document.getElementById('fragmentedBtn').addEventListener('click', async () => {
  const result = await getFromStorage(['previousSession']);
  const infoDiv = document.getElementById('activityInfo');
  const session = result.previousSession;
  if (session && session.hasFragments) {
    const titles = session.fragmentedActivity && session.fragmentedActivity.length
      ? session.fragmentedActivity.map(t => `<li>${t}</li>`).join('')
      : '<li>(none)</li>';
    const duration = session.fragmentedDuration ? session.fragmentedDuration : 0;
    infoDiv.innerHTML = `<b>Fragmented Activity:</b><br><ul>${titles}</ul>Total Fragmented Duration: ${formatDuration(duration)}`;
  } else {
    infoDiv.textContent = 'No fragmented activity.';
  }
  updateFragmentedButtonState(session);
});

document.getElementById('activityListBtn').addEventListener('click', async () => {
  const result = await getFromStorage(['activityList']);
  const infoDiv = document.getElementById('activityInfo');
  const activityList = result.activityList || [];
  
  if (activityList.length > 0) {
    console.log("Current activityList:", activityList);
    const activities = activityList.map((activity, index) => {
      const duration = activity.duration ? activity.duration : 0;
      const time = activity.timestamp ? new Date(activity.timestamp).toLocaleString() : 'N/A';
      if (activity.title === 'fragmented') {
        const fragTitles = activity.fragmentedActivity && activity.fragmentedActivity.length
          ? activity.fragmentedActivity.map(t => `<li>${t}</li>`).join('')
          : '<li>(none)</li>';
        return `
          <div style="margin-bottom: 10px; padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
            <b>Activity ${index + 1} (Fragmented):</b><br>
            <ul>${fragTitles}</ul>
            Total Fragmented Duration: ${formatDuration(duration)}<br>
            Time: ${time}
          </div>
        `;
      } else {
        return `
          <div style="margin-bottom: 10px; padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
            <b>Activity ${index + 1}:</b><br>
            Title: ${activity.title}<br>
            URL: ${activity.url}<br>
            Duration: ${formatDuration(duration)}<br>
            Time: ${time}
          </div>
        `;
      }
    }).join('');
    
    infoDiv.innerHTML = `<b>Activity List (${activityList.length} items):</b><br>${activities}`;
  } else {
    infoDiv.textContent = 'No activities recorded yet.';
  }
});

// Initial state on popup open
showpreviousSession(); 