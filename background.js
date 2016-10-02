var loginFormPath = '/?no_sso=1';
var emojiUploadFormPath = '/admin/emoji';
var emojiUploadImagePath = '/customize/emoji';

function slack_add_emoji(info, tab) {
	var emoji_name = prompt("Give your emoji a name:");

	var image_url = info.srcUrl;
	var image = get_image(image_url);
	var upload_image(image);

	// logged_in = check_if_logged_in();
	// if (!logged_in)
	// {
	// 	upload_image(image_url);	
	// }
}

function get_image(image_url) {
	var xhr = new XMLHttpRequest();
	xhr.open('GET', image_url, true);
	xhr.responseType = 'blob';

	var img;
	xhr.onreadystatechange = function() {
		if (xhr.readyState == XMLHttpRequest.DONE) {
			img = xhr.response;
			console.log("Downloaded the image.");
		}
	}

	xhr.send();

	img = shrunken_image(img);

	return img;
}


function shrunken_image(img) {
	console.log('stuff');
}


function upload_image() {
	var slack_team_domain = ""
	var emoji_cust_url = 'https://' + slack_team_domain + '.slack.com/customize/emoji';

}


chrome.contextMenus.create({
	title: "Add as an emoji to slack.",
	contexts: ["image"],
	"onclick": slack_add_emoji
});