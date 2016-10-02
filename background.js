chrome.contextMenus.create({
	title: "Add as an emoji to slack",
	contexts: ["image"],
	"onclick": slack_add_emoji
});

function slack_add_emoji(info, tab) {
	var emoji_name = prompt("Give your emoji a name:");
	if (emoji_name !== '') {
		console.log('Emoji name:' + emoji_name);
		var valid_name = validate_emoji_name();
		var image_url = info.srcUrl;
		upload_image(image_url, emoji_name);
	}
}

function validate_emoji_name() {
	//TODO
	return true;
}

function upload_image(image_url, emoji_name) {
	var img_el = document.createElement('img');
	img_el.crossOrigin = 'Anonymous';
	img_el.onload = function () {
		canvas = img_to_canvas(img_el);
		emoji_sized_canvas = emoji_sized(canvas);
		emoji_sized_canvas.toBlob(function (emoji_blob) {
			console.log('canvas is now a blob');
			upload_emoji(emoji_name, emoji_blob);
		});
	};
	console.log("setting image url");
	img_el.src = image_url;
}

function emoji_dimensions(width, height) {
	const MAX_SIDE_LENGTH = 128;
	// Get the larger side
	long_side = Math.max(height, width);
	// Determine the scale ratio
	scale = MAX_SIDE_LENGTH / long_side;
	// If the image is between 95% to 100% of the target
	// emoji size, don't adjust it's size.
	if ((scale <= (1 / 0.95)) && (scale >= 1)) {
		scale = 1;
	}
	return {
		'height': height * scale,
		'width': width * scale
	};
}

function img_to_canvas(img) {
	canvas = document.createElement('canvas');
	canvas.width = img.width;
	canvas.height = img.height;
	canvas_ctx = canvas.getContext('2d');
	canvas_ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
	return canvas;
}

function emoji_sized(canvas) {
	var target_dim = emoji_dimensions(canvas.width, canvas.height);
	var factor = 2;
	var canvas_long_side = Math.max(canvas.width, canvas.height);
	var target_long_side = Math.max(target_dim.width, target_dim.height);
	new_canvas = document.createElement('canvas');
	new_canvas_ctx = new_canvas.getContext('2d');
	if ((target_long_side === canvas_long_side)) {
		// Return the image.
		return canvas;
	} else if (target_long_side > canvas_long_side * factor) {
		// Increase the size of the image and then resize the result.
		new_canvas.width = canvas.width * factor;
		new_canvas.height = canvas.height * factor;
		new_canvas_ctx.drawImage(canvas, 0, 0, new_canvas.width, new_canvas.height);
		return emoji_sized(new_canvas);
	} else if (canvas_long_side > target_long_side * factor) {
		// Half the size of the image and then resize the result.
		var width = new_canvas.width = canvas.width / factor;
		var height = new_canvas.height = canvas.height / factor;
		new_canvas_ctx.drawImage(canvas, 0, 0, new_canvas.width, new_canvas.height);
		return emoji_sized(new_canvas);
	} else {
		// Resize the image in one shot
		new_canvas.width = target_dim.width;
		new_canvas.height = target_dim.height;
		new_canvas_ctx.drawImage(canvas, 0, 0, new_canvas.width, new_canvas.height);
		return new_canvas;
	}
}

function upload_emoji(emoji_name, emoji_blob) {
	chrome.storage.sync.get({
		team_domain: null,
	}, function (items) {
		var slack_team_domain = items.team_domain;
		console.log('slack team: ' + slack_team_domain);
		var emoji_cust_url = 'https://' + slack_team_domain + '.slack.com/customize/emoji';
		var get_xhr = new XMLHttpRequest();
		get_xhr.open("GET", emoji_cust_url, true);
		get_xhr.responseType = 'document';
		get_xhr.onreadystatechange = function () {
			if (get_xhr.readyState == XMLHttpRequest.DONE) {
				if (get_xhr.status != 200) {
					alert('Cannot reach the emoji customization page of ' + slack_team_domain + '.');
				} else {
					emoji_page = get_xhr.response;
					upload_form = emoji_page.getElementById('addemoji');
					inputs = upload_form.getElementsByTagName('input');
					for (var i = 0; i < inputs.length; i++) {
						input = inputs[i];
						if (input.name == 'crumb') {
							crumb = input.value;
							break;
						}
					}
					console.log(crumb);
					if (crumb !== undefined) {
						var post_xhr = new XMLHttpRequest();
						post_xhr.open("POST", emoji_cust_url, true);
						post_xhr.responseType = 'document';
						var form_data = new FormData();
						form_data.append('name', emoji_name);
						form_data.append('img', emoji_blob);
						form_data.append('mode', 'data');
						form_data.append('add', '1');
						form_data.append('crumb', crumb);
						post_xhr.onreadystatechange = function () {
							if (post_xhr.readyState == XMLHttpRequest.DONE) {
								results = analyze_slack_response(post_xhr.response);
								if (results !== 'Success') {
									alert('Upload failed: ' + results);
								} else {
									console.log('Uploaded Image!');
								}
							}
						}
						post_xhr.send(form_data);
					}
				}
			}
		}
		get_xhr.send();
	});
}

function analyze_slack_response(response) {
	alerts = response.getElementsByClassName('alert alert_error');
	if (alerts.length !== 0) {
		return alerts[0].innerText;
	} else {
		return 'Success'
	}
}