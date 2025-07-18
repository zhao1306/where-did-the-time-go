function updateFragmentedButtonState(currentSession) {
  const fragmentedBtn = document.getElementById('fragmentedBtn');
  if (currentSession && currentSession.isFragmented) {
    fragmentedBtn.disabled = false;
    fragmentedBtn.classList.add('active');
  } else {
    fragmentedBtn.disabled = true;
    fragmentedBtn.classList.remove('active');
  }
}

function updateCurrentSession(updater, callback) {
  chrome.storage.local.get(['currentSession'], function(result) {
    let currentSession = result.currentSession;
    if (currentSession) {
      updater(currentSession);
      chrome.storage.local.set({ currentSession }, callback);
    } else if (callback) {
      callback();
    }
  });
}

function showCurrentSession() {
  updateCurrentSession(function(currentSession) {
    if (currentSession.timestamp) {
      let duration = Date.now() - currentSession.timestamp;
      duration = Math.floor(duration / 1000);
      currentSession.duration = duration;
    }
  }, function() {
    chrome.storage.local.get(['currentSession'], function(result) {
      const infoDiv = document.getElementById('activityInfo');
      if (result.currentSession) {
        const { url, title, timestamp, duration } = result.currentSession;
        infoDiv.innerHTML = `<b>Current Session:</b><br>URL: ${url}<br>Title: ${title}<br>Time: ${new Date(timestamp).toLocaleString()}<br>Duration: ${duration ? duration + 's' : 'N/A'}`;
        updateFragmentedButtonState(result.currentSession);
      } else {
        infoDiv.textContent = 'No activity recorded yet.';
        updateFragmentedButtonState(null);
      }
    });
  });
}

document.getElementById('currPage').addEventListener('click', showCurrentSession);

document.getElementById('fragmentedBtn').addEventListener('click', function() {
  chrome.storage.local.get(['currentSession'], function(result) {
    const infoDiv = document.getElementById('activityInfo');
    const session = result.currentSession;
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
});

// Initial state on popup open
showCurrentSession(); 