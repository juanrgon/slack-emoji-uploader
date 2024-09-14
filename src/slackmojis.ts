function searchUpForTag(el: HTMLElement, tagName: string): HTMLElement | null {
  let target: HTMLElement | null = el;

  while (target?.tagName !== tagName) {
    target = target?.parentElement;
    if (target === null) {
      return null;
    }
  }

  return target;
}

function getEmojiDetails(clicked_el: HTMLElement) {
  const anchor_tag = searchUpForTag(clicked_el, "A");
  if (anchor_tag === null) {
    return null;
  }
  const imageEl = anchor_tag.getElementsByTagName("img")[0];
  const emojiName = anchor_tag
    .getElementsByClassName("name")[0]
    .innerHTML.split(":")[1];
  return {
    name: emojiName,
    url: imageEl.src,
  };
}

function addEmoji(event: MouseEvent) {
  const clicked_el = event.target;
  const name_and_url = getEmojiDetails(clicked_el as HTMLElement);
  if (name_and_url === null) {
    return;
  }
  const url = name_and_url.url;
  const name = name_and_url.name;
  chrome.runtime.sendMessage({
    emojiName: name,
    emojiUrl: url,
  });
}
const emojiButtons = document.getElementsByClassName("downloader");
for (let i = 0; i < emojiButtons.length; i++) {
  const emojiButton = emojiButtons[i];
  emojiButton.removeAttribute("download");
  emojiButton.setAttribute("href", "#");
  emojiButton.setAttribute("onclick", "return false;");
  emojiButton.addEventListener(
    "click",
    function (event) {
      addEmoji(event as MouseEvent);
    },
    false
  );
}
