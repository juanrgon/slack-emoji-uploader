/**
* Redirects to the extension options page to enter a team
*/
export default () => {
    alert('Oops. No Slack team was entered.');
    chrome.runtime.openOptionsPage();
}
