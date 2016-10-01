// img = new Image();
// img.src = 'http://i.imgur.com/SHo6Fub.jpg';
img_url = 'http://i.imgur.com/CAUyU1v.jpg';
get_image(img_url);

function get_image(image_url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', image_url, true);
    xhr.responseType = 'blob';
    var imgEl = document.createElement('img');
    var myCanvas = document.createElement('canvas');
    var ctx = myCanvas.getContext('2d');
    var working_canvas = document.createElement('canvas');
    xhr.onreadystatechange = function() {
        if (xhr.readyState == XMLHttpRequest.DONE) {
            console.log("Downloaded the image.");
            img = xhr.response;
            var urlCreator = window.URL || window.webkitURL;
            var imageUrl = urlCreator.createObjectURL(img);
            imgEl.onload = function() {
                target_dim = emoji_dimensions(imgEl.width, imgEl.height);
                working_ctx = working_canvas.getContext('2d');
                working_canvas.height = imgEl.height;
                working_canvas.width = imgEl.width;
                working_ctx.drawImage(imgEl, 0, 0, imgEl.width, imgEl.height);
                current_longest = Math.max(imgEl.height, imgEl.width);
                target_longest = Math.max(target_dim['height'], target_dim['width']);
                console.log(current_longest);
                console.log(target_longest);
                ratio = 0.5
                steps = Math.ceil((Math.log(current_longest / target_longest) / Math.log(1 / ratio)))

                for (i = 0; i < steps; i++) {

                    working_ctx.drawImage(working_canvas, 0, 0, working_canvas.width * ratio, working_canvas.height * ratio)
                }
                myCanvas.height = target_dim['height'];
                myCanvas.width = target_dim['width'];
                ctx.drawImage(working_canvas, 0, 0, working_canvas.width * Math.pow(ratio, steps), working_canvas.height * Math.pow(ratio, steps), 0, 0, myCanvas.width, myCanvas.height);
                document.body.appendChild(myCanvas);
            };
            imgEl.src = imageUrl;

        }
    }
    xhr.send();
}

function high_quality_resize(canvas, target_dim) {
    current_longest = Math.max(canvas.height, canvas.width);
    target_longest = Math.max(target_dim['height'], target_dim['width']);

    if ((current_longest > target_longest) && (current_longest > 2 * target_longest)) {
        canvas = half(canvas);
        return high_quality_resize(canvas, target_dim);
    } else if ((current_longest < target_longest) && (current_longest < 2 * target_longest)) {
        canvas = double(canvas);
        return high_quality_resize(canvas, target_dim);
    } else {
        canvas_context = canvas.getContext('2d');
        canvas_context.drawImage(canvas, 0, 0, canvas.width, canvas.height);
        return canvas;
    }
}

function half(canvas) {
    canvas_context = canvas.getContext('2d');
    canvas_context.drawImage(canvas, 0, 0, canvas.width * 0.7, canvas.height * 0.7);
    return canvas;
}

function double(canvas) {
    canvas_context = canvas.getContext('2d');
    canvas_context.drawImage(canvas, 0, 0, canvas.width * 0.7, canvas.height * 0.7);
    return canvas
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