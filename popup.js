document.addEventListener('DOMContentLoaded', function () {
    chrome.storage.sync.get({
        team_domain: null
    }, function (items) {
        var slack_team_domain = items.team_domain;
        console.log(slack_team_domain === null);
        if (slack_team_domain === null) {
            alert('Oops. No Slack team was entered.');
            chrome.runtime.openOptionsPage();
        } else {
            slack_emoji_url = 'https://' + slack_team_domain + '.slack.com/customize/emoji'
            chrome.tabs.create({
                active: true,
                url: slack_emoji_url
            });
        }
    });
});