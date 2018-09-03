import SlackTeam from '../models/SlackTeam';

/**
* Redirects to the extension options page to enter a team
*/
export const alertNoTeamEntered = () => {
    alert('Oops. No Slack team was entered.');
    chrome.runtime.openOptionsPage();
}

// See https://developer.chrome.com/apps/contextMenus
interface rightClickMenuInfo {
    menuItemId: string,  // The ID of the menu item that was clicked
    editable: boolean, // A flag indicating whether the element is editable (text input, textarea, etc.).
    parentMenuItemId?: string,  // The ID of the menu item that was clicked
    mediaType?: string,  // One of 'image', 'video', or 'audio' if the context menu was activated on one of these types of elements.
    linkUrl?: string, // If the element is a link, the URL it points to.
    srcUrl?: string, // Will be present for elements with a 'src' URL.
    pageUrl?: string  // The URL of the page where the menu item was clicked.
    frameUrl?: string  // The URL of the frame of the element where the context menu was clicked, if it was in a frame.
    framedId?: string, // The ID of the frame of the element where the context menu was clicked
    selectionText?: string, // The text for the context selection, if any.
    wasChecked?: boolean, // A flag indicating the state of a checkbox or radio item before it was clicked.
    checked?: boolean, // A flag indicating the state of a checkbox or radio item after it is clicked.
}

export const addEmoji = async (info: rightClickMenuInfo, tab: chrome.tabs.Tab) => {
    const teamName = info.menuItemId;
    const team = new SlackTeam(teamName);
    const url = info.srcUrl;

    let success: boolean = false
    try {
        success = await team.addEmoji(url)
    } catch(e) {

    }
}
