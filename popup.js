document.getElementById('currPage').addEventListener('click', function() {
  chrome.storage.local.get(['currentSession'], function(result) {
    const infoDiv = document.getElementById('activityInfo');
    if (result.currentSession) {
      const { url, title, timestamp, duration } = result.currentSession;
      if (timestamp) {
        duration = Date.now() - timestamp;
        duration = Math.floor(duration / 1000);
      }
      infoDiv.innerHTML = `<b>Current Session:</b><br>URL: ${url}<br>Title: ${title}<br>Time: ${new Date(timestamp).toLocaleString()}<br>Duration: ${duration ? duration + 's' : 'N/A'}`;
    } else {
      infoDiv.textContent = 'No activity recorded yet.';
    }
  });
}); 