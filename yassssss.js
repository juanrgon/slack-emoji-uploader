img_url = 'https://i.imgur.com/SHo6Fub.jpg'; // (Mountain)
//img_url = 'https://i.imgur.com/CAUyU1v.jpg'; // (American Psycho)
//img_url = 'https://i.imgur.com/IJmuA62.gif'; // (Elmo)
//img_url = 'https://i.imgur.com/Kb9bVR1.jpg;' // (dat boi)
get_image(img_url);

function get_image(image_url) {
    var img_el = document.createElement('img');

    var xhr = new XMLHttpRequest();
    xhr.open('GET', image_url, true);
    xhr.responseType = 'blob';
    xhr.onreadystatechange = function() {
        if (xhr.readyState == XMLHttpRequest.DONE) {
            console.log("Downloaded the image.");
            var img = xhr.response;
            var urlCreator = window.URL || window.webkitURL;
            var image_url = urlCreator.createObjectURL(img);
            img_el.onload = function() {
                canvas = emoji_sized(img_el);
                document.body.appendChild(canvas);
            };
            img_el.src = image_url;
        }
    }
    xhr.send();
}

function emoji_sized(img_el) {
    var target_dim = emoji_dimensions(img_el.width, img_el.height);
    var current_longest = Math.max(img_el.height, img_el.width);
    var target_longest = Math.max(target_dim['height'], target_dim['width']);

    factor = 2;
    if (current_longest > target_longest) {
        var factor = 1 / factor;
    }
    var steps = Math.floor((Math.log(target_longest / current_longest) / Math.log(factor)));

    var pre_canvas = document.createElement('canvas');
    var pre_ctx = pre_canvas.getContext('2d');
    var width = pre_canvas.width = img_el.width;
    var height = pre_canvas.height = img_el.height;
    pre_ctx.drawImage(img_el, 0, 0, width, height);
    var post_canvas = document.createElement('canvas');
    for (i = 0; i < steps; i++) {
        var post_canvas = document.createElement('canvas');
        post_ctx = post_canvas.getContext('2d');
        post_canvas.width = width *= factor;
        post_canvas.height = height *= factor;
        post_ctx.drawImage(pre_canvas, 0, 0, width, height);
        pre_canvas = post_canvas;
    }

    var final_canvas = document.createElement('canvas');
    final_canvas.width = target_dim['width'];
    final_canvas.height = target_dim['height'];
    var ctx = final_canvas.getContext('2d');
    ctx.drawImage(post_canvas, 0, 0, post_canvas.width, post_canvas.height, 0, 0, final_canvas.width, final_canvas.height);
    return final_canvas;
}

function emoji_dimensions(width, height) {
    // Get the larger side
    long_side = Math.max(height, width);

    // Determine the scale ratio
    scale = 128 / long_side;

    return {
        'height': height * scale,
        'width': width * scale
    };
}