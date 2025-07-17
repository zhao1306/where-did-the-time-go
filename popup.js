document.getElementById('currPage').addEventListener('click', function() {
  chrome.storage.local.get(['lastActivity'], function(result) {
    const infoDiv = document.getElementById('activityInfo');
    if (result.lastActivity) {
      const { url, title, timestamp, duration } = result.lastActivity;
      infoDiv.innerHTML = `<b>Last Activity:</b><br>URL: ${url}<br>Title: ${title}<br>Time: ${new Date(timestamp).toLocaleString()}<br>Duration: ${duration ? duration + 's' : 'N/A'}`;
    } else {
      infoDiv.textContent = 'No activity recorded yet.';
    }
  });
}); 