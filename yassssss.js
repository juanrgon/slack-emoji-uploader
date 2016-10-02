// img_url = 'https://i.imgur.com/SHo6Fub.jpg'; // (Mountain)
img_url = 'https://i.imgur.com/CAUyU1v.jpg'; // (American Psycho)
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
                canvas = img_to_canvas(img_el);
                emoji_sized_canvas = emoji_sized(canvas);
                document.body.appendChild(emoji_sized_canvas);
            };
            img_el.src = image_url;
        }
    }
    xhr.send();
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

function emoji_dimensions(width, height) {
    const MAX_SIDE_LENGTH = 128;

    // Get the larger side
    long_side = Math.max(height, width);

    // Determine the scale ratio
    scale = MAX_SIDE_LENGTH / long_side;

    // If the image is between 95% to 100% of the target
    // emoji size, don't adjust it's size.
    if ((scale >= 0.95) && (scale <= 1)) {
        scale = 1;
    }

    return {
        'height': height * scale,
        'width': width * scale
    };
}