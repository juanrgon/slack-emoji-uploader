function searchUpForTag(el, tagName) {
    while (el.tagName !== tagName) {
        (el = el.parentElement);
    }
    return el;
}

function getEmojiDetails(clicked_el) {
    var anchor_tag = searchUpForTag(clicked_el, 'A');
    var imageEl = anchor_tag.getElementsByTagName('img')[0];
    var emojiName = anchor_tag.getElementsByClassName('name')[0].innerHTML.split(':')[1];
    emojiName.strp
    return {
        name: emojiName,
        url: imageEl.src
    };
}

function addEmoji(event) {
    var clicked_el = event.target;
    name_and_url = getEmojiDetails(clicked_el);
    var url = name_and_url.url;
    var name = name_and_url.name;
    chrome.runtime.sendMessage({
        emojiName: name,
        emojiUrl: url
    });
}
var emojiButtons = document.getElementsByClassName('downloader');
for (var i = 0; i < emojiButtons.length; i++) {
    var emojiButton = emojiButtons[i];
    emojiButton.removeAttribute("download");
    emojiButton.setAttribute("href", "#");
    emojiButton.setAttribute("onclick", "return false;")
    emojiButton.addEventListener("click", function (event) {
        addEmoji(event);
    }, false);
}
