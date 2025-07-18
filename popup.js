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
    infoDiv.innerHTML = `<b>Current Session:</b><br>URL: ${url}<br>Title: ${title}<br>Time: ${new Date(timestamp).toLocaleString()}<br>Duration: ${duration ? duration + 's' : 'N/A'}`;
    updateFragmentedButtonState(result.previousSession);
  } else {
    infoDiv.textContent = 'No activity recorded yet.';
    updateFragmentedButtonState(null);
  }
};

document.getElementById('currPage').addEventListener('click', showpreviousSession);

document.getElementById('fragmentedBtn').addEventListener('click', async () => {
  const result = await getFromStorage(['previousSession']);
  const infoDiv = document.getElementById('activityInfo');
  const session = result.previousSession;
  if (session && session.isFragmented) {
    const titles = session.fragmentedActivity && session.fragmentedActivity.length
      ? session.fragmentedActivity.map(t => `<li>${t}</li>`).join('')
      : '<li>(none)</li>';
    const duration = session.fragmentedDuration ? Math.floor(session.fragmentedDuration / 1000) : 0;
    infoDiv.innerHTML = `<b>Fragmented Activity:</b><br><ul>${titles}</ul>Total Fragmented Duration: ${duration}s`;
  } else {
    infoDiv.textContent = 'No fragmented activity.';
  }
  updateFragmentedButtonState(session);
});

// Initial state on popup open
showpreviousSession(); 