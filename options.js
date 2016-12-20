// Saves options to chrome.storage.sync.
function save_options() {
  var team_domain = document.getElementById('team-domain').value;
  var status = document.getElementById('team_status');
  status.textContent = ''
  var xhr = new XMLHttpRequest();
  team_url = 'https://' + team_domain + '.slack.com/customize/emoji'
  xhr.open('GET', team_url, true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState == XMLHttpRequest.DONE) {
      console.log(xhr.status);
      if (xhr.status === 200) {
        console.log(xhr.responseURL);
        if (team_url !== xhr.responseURL) {
          chrome.tabs.create({
            url: 'https://' + team_domain + '.slack.com'
          });
          status.textContent = 'Login to team in another tab';
          status.style.color = 'red';
        } else {
          chrome.storage.sync.set({
            team_domain: team_domain,
          }, function () {
            // Update status to let user know options were saved.
            var status = document.getElementById('settings_status');
            status.textContent = 'Options saved!';
            status.style.color = 'green';
            setTimeout(function () {
              status.textContent = '';
            }, 750);
          });
        }
      } else {
        status.textContent = 'Unreachable: ' + xhr.status;
        status.style.color = 'red';
        var save_status = document.getElementById('settings_status');
        save_status.textContent = 'Save failed.';
        save_status.style.color = 'red';
        setTimeout(function () {
          save_status.textContent = '';
        }, 750);
        return false;
      }
    }
  }
  xhr.send();
}
// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
  chrome.storage.sync.get({
    team_domain: 'your-team-name',
  }, function (items) {
    document.getElementById('team-domain').value = items.team_domain;
  });
}
document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);