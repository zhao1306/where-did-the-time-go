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
  if (previousSession && previousSession.isFragmented) {
    fragmentedBtn.disabled = false;
    fragmentedBtn.classList.add('active');
  } else {
    fragmentedBtn.disabled = true;
    fragmentedBtn.classList.remove('active');
  }
};

const showpreviousSession = async () => {
  await updatepreviousSession((previousSession) => {
    if (previousSession.timestamp) {
      let duration = Date.now() - previousSession.timestamp;
      duration = Math.floor(duration / 1000);
      previousSession.duration = duration;
    }
  });
  const result = await getFromStorage(['previousSession']);
  const infoDiv = document.getElementById('activityInfo');
  if (result.previousSession) {
    const { url, title, timestamp, duration } = result.previousSession;
    infoDiv.innerHTML = `<b>Current Session:</b><br>URL: ${url}<br>Title: ${title}<br>Time: ${new Date(timestamp).toLocaleString()}<br>Duration: ${duration ? Math.round(duration / 1000) + 's' : 'N/A'}`;
    updateFragmentedButtonState(result.previousSession);
  } else {
    infoDiv.textContent = 'No activity recorded yet.';
    updateFragmentedButtonState(null);
  }
  console.log(result.previousSession);
  console.log(result.activityList);
};

const clearActivity = async () => {
  // Reset previousSession to initial state (no fragments, no activity, etc.)
  const emptySession = {
    url: "",
    title: "",
    timestamp: 0,
    duration: 0,
    hasFragments: false,
    fragmentedDuration: 0,
    fragmentedActivity: [],
  };
  await setInStorage({ previousSession: emptySession, activityList: [] });
  showpreviousSession();
};


document.getElementById('currPage').addEventListener('click', showpreviousSession);

document.getElementById('stop').addEventListener('click', clearActivity);

document.getElementById('fragmentedBtn').addEventListener('click', async () => {
  const result = await getFromStorage(['previousSession']);
  const infoDiv = document.getElementById('activityInfo');
  const session = result.previousSession;
  if (session && session.isFragmented) {
    const titles = session.fragmentedActivity && session.fragmentedActivity.length
      ? session.fragmentedActivity.map(t => `<li>${t}</li>`).join('')
      : '<li>(none)</li>';
    const duration = session.fragmentedDuration ? Math.round(session.fragmentedDuration / 1000) : 0;
    infoDiv.innerHTML = `<b>Fragmented Activity:</b><br><ul>${titles}</ul>Total Fragmented Duration: ${duration}s`;
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
    const activities = activityList.map((activity, index) => {
      const duration = activity.duration ? Math.round(activity.duration / 1000) + 's' : 'N/A';
      const time = activity.timestamp ? new Date(activity.timestamp).toLocaleString() : 'N/A';
      return `
        <div style="margin-bottom: 10px; padding: 8px; border: 1px solid #ddd; border-radius: 6px;">
          <b>Activity ${index + 1}:</b><br>
          Title: ${activity.title}<br>
          URL: ${activity.url}<br>
          Duration: ${duration}<br>
          Time: ${time}
        </div>
      `;
    }).join('');
    
    infoDiv.innerHTML = `<b>Activity List (${activityList.length} items):</b><br>${activities}`;
  } else {
    infoDiv.textContent = 'No activities recorded yet.';
  }
});

// Initial state on popup open
showpreviousSession(); 