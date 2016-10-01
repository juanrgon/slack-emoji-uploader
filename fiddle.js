// img = new Image();
// img.src = 'http://i.imgur.com/SHo6Fub.jpg';
img_url = 'http://i.imgur.com/SHo6Fub.jpg';
dim = emoji_dimensions(128, 160);
alert(dim['height']);
alert(dim['width']);
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
            img = xhr.response;
            var urlCreator = window.URL || window.webkitURL;
            var imageUrl = urlCreator.createObjectURL(img);
            imgEl.onload = function() {
                dim = emoji_dimensions(imgEl.width, imgEl.height);
                myCanvas.width = dim['width'];
                myCanvas.height = dim['height'];
                ctx.drawImage(imgEl, 0, 0, dim['width'], dim['height']);
            };
            console.log("Downloaded the image.");
            imgEl.src = imageUrl;
            document.body.appendChild(myCanvas);
            //shrunken_image();
        }
    }
    xhr.send();
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