document.addEventListener('DOMContentLoaded', function() {
    chrome.storage.sync.get({
        'teamDomains': null,
    }, function(items) {
        const teams = items.teamDomains;
        if (teams === null) {
            alert('Oops. No Slack team was entered.');
            chrome.runtime.openOptionsPage();
        } else {
            for (let i=0; i<teams.length; i++) {
              const teamName = teams[i];
              console.log(teamName);
              const slackEmojiUrl = 'https://' + teamName + '.slack.com/customize/emoji';
              chrome.tabs.create({
                  active: true,
                  url: slackEmojiUrl
              });
            }
        }
    });
});
