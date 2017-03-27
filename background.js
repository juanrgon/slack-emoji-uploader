chrome.storage.sync.get({'teamDomains': null}, function(items) {
	let teams = items.teamDomains;
	console.log('Slack Teams', teams);
	if (teams === null) {
		chrome.contextMenus.create({
			'title': 'Add emoji to slack',
			'contexts': ['image'],
			'onclick': alertNoTeamEntered,
		});
	} else {
		updateRightClickMenu(teams);
	}
});

/**
* Redirects to the extension options page to enter a team
*/
function alertNoTeamEntered() {
	alert('Oops. No Slack team was entered.');
	chrome.runtime.openOptionsPage();
}

function updateRightClickMenu(teams) {
	chrome.contextMenus.removeAll();
  for (i = 0; i < teams.length; i++) {
    let team = teams[i];
    console.log('adding menu', team);
    chrome.contextMenus.create({
      'title': 'Add emoji to ' + team,
      'contexts': ['image'],
      'id': team,
      'onclick': slack_add_emoji,
    });
  }
}

chrome.runtime.onInstalled.addListener(function(details) {
	if (details.reason == 'install') {
		chrome.runtime.openOptionsPage();
	} else if(details.reason == 'update') {
		let prevVersionString = details.previousVersion;
		let versionString = chrome.runtime.getManifest().version;

		let [major, minor, patch] = versionString.split('.');
		let [pMajor, pMinor, pPatch] = prevVersionString.split('.');

		let pInt = parseInt;
		let version = [pInt(major), pInt(minor), pInt(patch)];
		let previousVersion = [pInt(pMajor), pInt(pMinor), pInt(pPatch)];

		// structure of slack team name storage changed in 1.3.0
		if (previousVersion < [1, 3, 0] && version >= [1, 3, 0]) {
			chrome.storage.sync.get({'team_domain': null}, function(items) {
				if (items.team_domain !== null) {
					chrome.storage.sync.set({'teamDomains': [items.team_domain]});
				}
				chrome.storage.sync.remove('team_domain');
			});

			alert('Slack Emoji Uploader now supports multiple teams!');
			chrome.runtime.openOptionsPage();
		}
	}
});
chrome.runtime.onMessage.addListener(function (request, sender) {
	if (sender.tab) {
		tab_url = sender.tab.url;
		var re = '^http(s)?://(www\.)?slackmojis\.com/?.*$';
		if (tab_url.match(re) !== null) {
			console.log('Retrieved request to add emoji from ' + tab_url);
			console.log('Request ' + JSON.stringify(request));
			xhr = new XMLHttpRequest();
			xhr.open('GET', request.emojiUrl, true);
			xhr.responseType = 'blob';
			xhr.onreadystatechange = function() {
				if (xhr.readyState == XMLHttpRequest.DONE) {
					if (xhr.status === 0) {
						alert_internet_disconnect();
					} else {
						console.log('Downloading slackmoji image.')
						emoji_blob = xhr.response;
						chrome.storage.sync.get({'teamDomains': null}, function(items) {
							let teams = items.teamDomains;
							if (teams !== null) {
								for (let i=0; i < teams.length; i++) {
									let teamName = teams[i];
									upload_emoji(teamName, request.emojiName, emoji_blob);
								}
							}
						});
					}
				}
			}
			xhr.send();
		}
	}
	else {
		updateRightClickMenu(request);
	}
});

function slack_add_emoji(info, tab) {
	var emoji_name = null;
	var prompt_message = "Give your emoji a name."
	do {
		var emoji_name = prompt(prompt_message);
		if (emoji_name === '') {
			prompt_message = "Emoji name can't be blank! Try again.";
		}
	} while (emoji_name === '');
	if (emoji_name !== null) {
		var valid_name = validate_emoji_name(emoji_name);
		if (!valid_name) {
			alert('"' + emoji_name +
				'" is an invalid name. Only use letters, numbers, dashes, spaces, and underscores. You must also include at least one non-space character.'
			);
		} else {
			emoji_name = remove_whitespace(emoji_name);
			emoji_name = emoji_name.toLowerCase();
			console.log('Emoji name:' + emoji_name);
			var image_url = info.srcUrl;
			let teamName = info.menuItemId;
			upload_image(teamName, image_url, emoji_name);
		}
	}
}

function remove_whitespace(emoji_name) {
	parts = emoji_name.split(' ');
	new_parts = [];
	for (i = 0; i < parts.length; i++) {
		if ((parts[i] !== '') && (parts[i] !== ' ')) {
			new_parts.push(parts[i]);
		}
	}
	return new_parts.join('-');
}

function validate_emoji_name(emoji_name) {
	var re = '^[a-zA-Z0-9-_ ]*[a-zA-Z0-9-_]+[a-zA-Z0-9-_ ]*$'
	var empty_re = '^ *$'
	if (emoji_name.match(re) === null) {
		return false;
	} else {
		return true;
	}
}

function upload_image(teamName, image_url, emoji_name) {
	url_parser = document.createElement('a');
	url_parser.href = image_url;
	var img_el = document.createElement('img');
	img_el.crossOrigin = 'Anonymous';
	img_el.onload = function () {
		canvas = img_to_canvas(img_el);
		emoji_sized_canvas = emoji_sized(canvas);
		emoji_sized_canvas.toBlob(function (emoji_blob) {
			console.log('canvas is now a blob');
			upload_emoji(teamName, emoji_name, emoji_blob);
		});
	};
	if ((url_parser.protocol == 'data:') || (url_parser.protocol == 'file:')) {
		if (url_parser.protocol === 'file:'){
			chrome.extension.isAllowedFileSchemeAccess(function(isAllowedAccess){
				if (!isAllowedAccess) {
					alert('You must check "Allow access to file URLs" to upload local images opened in chrome.');
					chrome.runtime.openOptionsPage();
				}
			});
		}
		console.log("Interpreting data url.");
		img_el.src = image_url;
	} else {
		var xhr = new XMLHttpRequest();
		xhr.open('GET', image_url, true);
		xhr.responseType = 'blob';
		xhr.onreadystatechange = function () {
			if (xhr.readyState == XMLHttpRequest.DONE) {
				if (xhr.status === 0) {
					alert_internet_disconnect();
				} else {
					img_blob = xhr.response;
					img_type = img_blob.type;
					if (img_type === 'image/gif') {
						shrink_gif_3rd_party(emoji_name, img_blob);
					} else {
						img_el.src = URL.createObjectURL(img_blob);
					}
				}
			}
		}
		console.log("Loading the image.");
		xhr.send();
	}
}

function alert_internet_disconnect() {
	alert("Woah. I got disconnected from the internet. Are you sure you're connected?");
}

function shrink_gif_3rd_party(emoji_name, img_blob) {
	console.log('Going to shrink gif.')
	var form_1_data = new FormData();
	form_1_data.append('new-image', img_blob);
	var post_1_xhr = new XMLHttpRequest();
	post_1_xhr.open("POST", 'http://ezgif.com/resize', true);
	post_1_xhr.responseType = 'document';
	post_1_xhr.onreadystatechange = function () {
		if (post_1_xhr.readyState == XMLHttpRequest.DONE) {
			if (post_1_xhr.status === 0) {
				alert_internet_disconnect();
			} else {
				console.log('Got response back from uploading gif.')
				var stats = post_1_xhr.response.getElementsByClassName('filestats')[0].innerText;
				var file_size_str = stats.split(',')[0].split(':')[1];
				var file_size = file_size_str.substring(0, file_size_str.length - 1);
				file_size = parseFloat(file_size);
				if (file_size_str.substring(file_size_str.length - 1) == 'M') {
					file_size = file_size * 1000;
				}
				console.log('file_size: ' + file_size_str);
				var width = stats.split(',')[1].split(':')[1];
				width = parseInt(width);
				console.log('width: ' + width);
				var height = stats.split(',')[2].split(':')[1];
				height = parseInt(height);
				console.log('height: ' + height);
				var long_side = Math.max(height, width);
				var long_side_name;
				if (width === long_side) {
					long_side_name = 'width';
				} else {
					long_side_name = 'height';
				}
				var percentage_1 = 128 / long_side;
				var percentage_2 = 64 / file_size;
				var percentage = Math.min(percentage_1, percentage_2);
				console.log('long_side' + long_side);
				var filename = post_1_xhr.responseURL.split('/')[4];
				console.log(filename);
				var token = post_1_xhr.response.getElementsByName('token')[0].value;
				var post_2_xhr = new XMLHttpRequest();
				post_2_xhr.open("POST", 'http://ezgif.com/resize', true);
				post_2_xhr.responseType = 'document';
				var form_2_data = new FormData();
				form_2_data.append('file', filename);
				form_2_data.append('token', token);
				form_2_data.append('old_width', width);
				form_2_data.append('old_height', height);
				console.log(long_side + ': ' + percentage * long_side);
				form_2_data.append(long_side_name, percentage * long_side);
				form_2_data.append('percentage', percentage)
				form_2_data.append('method', 'gifsicle')
				post_2_xhr.onreadystatechange = function () {
					if (post_2_xhr.readyState == XMLHttpRequest.DONE) {
						if (post_2_xhr.status === 0) {
							alert_internet_disconnect();
						} else {
							console.log('Got response back from resizing gif.')
							dom = post_2_xhr.response;
							console.log(dom);
							var img_url = dom.getElementsByTagName('img')[0].src;
							get_xhr = new XMLHttpRequest();
							get_xhr.open('GET', img_url, true);
							get_xhr.responseType = 'blob';
							get_xhr.onreadystatechange = function () {
								if (get_xhr.readyState == XMLHttpRequest.DONE) {
									if (get_xhr.status === 0) {
										alert_internet_disconnect();
									} else {
										console.log('Downloading resized gif.')
										emoji_blob = get_xhr.response;
										upload_emoji(teamName, emoji_name, emoji_blob);
									}
								}
							}
							get_xhr.send();
						}
					}
				}
				console.log('Sending request to resize gif.')
				post_2_xhr.send(form_2_data);
			}
		}
	}
	console.log('Uploading gif.')
	post_1_xhr.send(form_1_data);
}

function emoji_dimensions(width, height) {
	const MAX_SIDE_LENGTH = 128;
	// Get the larger side
	long_side = Math.max(height, width);
	// If the image is between 95% to 100% of the target
	// emoji size, don't adjust it's size.
	if ((long_side >= 0.95 * MAX_SIDE_LENGTH) && (long_side <= MAX_SIDE_LENGTH)) {
		scale = 1;
	} else {
		scale = MAX_SIDE_LENGTH / long_side;
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

function upload_emoji(teamName, emoji_name, emoji_blob) {
		var slack_team_domain = teamName;
		console.log(slack_team_domain === null);
		if (slack_team_domain === null) {
			alert('Oops. No Slack team was entered.');
			chrome.runtime.openOptionsPage();
		} else {
			var emoji_cust_url = 'https://' + slack_team_domain + '.slack.com/customize/emoji';
			var get_xhr = new XMLHttpRequest();
			get_xhr.open("GET", emoji_cust_url, true);
			get_xhr.responseType = 'document';
			get_xhr.onreadystatechange = function () {
				if (get_xhr.readyState == XMLHttpRequest.DONE) {
					if (get_xhr.status != 200) {
						if (get_xhr.status === 0) {
							alert_internet_disconnect();
						} else {
							alert('Cannot reach the emoji customization page of ' + slack_team_domain + '.');
						}
					} else if (get_xhr.responseURL !== emoji_cust_url) {
						alert('Please login to https://' + slack_team_domain + '.slack.com');
						chrome.tabs.create({
							url: 'https://' + slack_team_domain + '.slack.com'
						});
					} {
						emoji_page = get_xhr.response;
						upload_form = emoji_page.getElementById('addemoji');
						if (upload_form === null) {
							alert("You can't upload custom emojis. Your admin has restricted you :(")
						} else {
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
										if (get_xhr.status === 0) {
											alert_internet_disconnect();
										} else {
											results = analyze_slack_response(post_xhr.response);
											var msg;
											var title;
											var iconUrl;
											if (results == 'Success') {
												title = 'Success!';
												msg = 'Added the ' + emoji_name + ' emoji to ' + teamName + '!';
												iconUrl = URL.createObjectURL(emoji_blob);
											} else {
												title = 'Failure';
												msg = 'Upload to '+ teamName + ' failed: ' + results;
												iconUrl = "failure.png";
											}
											var opt = {
												type: "basic",
												title: title,
												message: msg,
												iconUrl: iconUrl
											};
											chrome.notifications.create(undefined, opt);
										}
									}
								}
								post_xhr.send(form_data);
							}
						}
					}
				}
			}
			get_xhr.send();
		}
}

function analyze_slack_response(response) {
	alerts = response.getElementsByClassName('alert alert_error');
	if (alerts.length !== 0) {
		return alerts[0].innerText;
	} else {
		return 'Success';
	}
}
