// img = new Image();
// img.src = 'http://i.imgur.com/SHo6Fub.jpg';
//img_url = 'http://i.imgur.com/CAUyU1v.jpg';
img_url = 'http://i.imgur.com/IJmuA62.gif'
get_image(img_url);

function get_image(image_url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', image_url, true);
    xhr.responseType = 'blob';
    var imgEl = document.createElement('img');
    var myCanvas = document.createElement('canvas');
    var ctx = myCanvas.getContext('2d');
    xhr.onreadystatechange = function() {
        if (xhr.readyState == XMLHttpRequest.DONE) {
            console.log("Downloaded the image.");
            var img = xhr.response;
            var urlCreator = window.URL || window.webkitURL;
            var imageUrl = urlCreator.createObjectURL(img);
            imgEl.onload = function() {
                var target_dim = emoji_dimensions(imgEl.width, imgEl.height);
                var current_longest = Math.max(imgEl.height, imgEl.width);
                var target_longest = Math.max(target_dim['height'], target_dim['width']);
                console.log(current_longest);
                console.log(target_longest);
                var ratio = 0.5
                var steps = Math.floor((Math.log(current_longest / target_longest) / Math.log(1 / ratio)))
                var pre_canvas = document.createElement('canvas');
                pre_ctx = pre_canvas.getContext('2d');
                pre_ctx.drawImage(imgEl, 0, 0, imgEl.width, imgEl.height);
                pre_canvas.width = imgEl.width;
                pre_canvas.height = imgEl.height;
                document.body.appendChild(pre_canvas);
                var width = imgEl.width;
                var height = imgEl.height;
                for (i = 0; i < steps; i++) {
                    var post_canvas = document.createElement('canvas');
                    post_ctx = post_canvas.getContext('2d');
                    width *= ratio;
                    height *= ratio;
                    post_canvas.width = width;
                    post_canvas.height = height;
                    //post_ctx.drawImage(pre_canvas, 0, 0, width, height);
                    //pre_canvas = post_canvas;
                    document.body.appendChild(post_canvas);
                }
                // myCanvas.height = imgEl.height;
                // myCanvas.width = imgEl.width;
                // ctx.drawImage(imgEl, 0, 0, imgEl.width, imgEl.height);
                // document.body.appendChild(myCanvas);
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