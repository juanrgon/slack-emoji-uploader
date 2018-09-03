document.addEventListener('DOMContentLoaded', function () {
    chrome.storage.sync.get({
        'teamDomains': null,
    }, function (items) {
        teams = items.teamDomains;
        if (teams === null) {
            alert('Oops. No Slack team was entered.');
            chrome.runtime.openOptionsPage();
        }
        else {
            for (var i_1 = 0; i_1 < teams.length; i_1++) {
                var teamName = teams[i_1];
                console.log(teamName);
                var slackEmojiUrl = 'https://' + teamName + '.slack.com/customize/emoji';
                chrome.tabs.create({
                    active: true,
                    url: slackEmojiUrl
                });
            }
        }
    });
});
