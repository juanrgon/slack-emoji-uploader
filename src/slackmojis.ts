function searchUpForTag(el, tagName) {
	while (el.tagName !== tagName) {
		(el = el.parentElement);
	}
	return el;
}

function getEmojiDetails(clicked_el) {
	const anchor_tag = searchUpForTag(clicked_el, 'A');
	const imageEl = anchor_tag.getElementsByTagName('img')[0];
	const emojiName = anchor_tag.getElementsByClassName('name')[0].innerHTML.split(':')[1];
	return {
		name: emojiName,
		url: imageEl.src
	};
}

function addEmoji(event) {
	const clicked_el = event.target;
	const name_and_url = getEmojiDetails(clicked_el);
	const url = name_and_url.url;
	const name = name_and_url.name;
	chrome.runtime.sendMessage({
		emojiName: name,
		emojiUrl: url
	});
}
const emojiButtons = document.getElementsByClassName('downloader');
for (let i = 0; i < emojiButtons.length; i++) {
	const emojiButton = emojiButtons[i];
	emojiButton.removeAttribute("download");
	emojiButton.setAttribute("href", "#");
	emojiButton.setAttribute("onclick", "return false;")
	emojiButton.addEventListener("click", function (event) {
		addEmoji(event);
	}, false);
}
