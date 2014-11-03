(function () {
	'use strict';

	var nFishies = 25;
	var maxFishSize = 5, minFishSize = 1;
	var drag = 0.3;
	var minSpacing = 1.2, maxSpacing = 2, avoidance = 500, chase = 100;
	var minSpeed = 20;
	var mouseFollow = 0.8;
	var fishies = [];
	var position = false;

	function fishScript() {
		var fishTypes = [
			{ code: "\uD83D\uDC1F", angle: -Math.PI / 2, color: 'blue' },
			{ code: "\uD83D\uDC20", angle: -Math.PI / 2, color: 'yellow' }
		];
		for (var i = 0; i < nFishies; i++) {
			var el = document.createElement('div');
			var size = Math.pow(Math.random(), 3) * (maxFishSize - minFishSize) + minFishSize;
			var fish = {
				type: fishTypes[Math.floor(Math.random() * fishTypes.length)],
				x: Math.random() * window.innerWidth,
				y: Math.random() * window.innerHeight,
				dx: 0,
				dy: 0,
				ddx: 0,
				ddy: 0,
				angle: 0,
				speed: 0.4 / size + 0.2,
				size: size,
				el: el
			};
			el.innerHTML = fish.type.code;
			el.style.position = 'absolute';
			el.style.left = 0;
			el.style.top = 0;
			el.style.display = 'block';
			el.style.zIndex = '999999';
			el.style.transformOrigin = 'center center';
			el.style.transition = position ? 'left 60ms linear, top 60ms linear' : 'transform 60ms linear';
			el.style.fontFamily = 'Segoe UI Emoji,Segoe UI Symbol,Symbola,Arial Unicode MS,DejaVu Sans';
			sl.style.color = fish.type.color;
			document.body.appendChild(el);
			fishies.push(fish);
		}
		window.addEventListener('mousemove', mousemove);
		window.addEventListener('mouseout', mouseout);
		window.setInterval(update, 20);
	}

	var x = 0, y = 0, hasCursor = false;

	function mousemove(e) {
		x = e.clientX;
		y = e.clientY;
		hasCursor = true;
	}

	function mouseout(e) {
		hasCursor = false;
	}

	/* Fish size */
	function getSize(fishy) {
		return Math.max(fishy.el.offsetWidth || fishy.el.width, fishy.el.offsetHeight || fishy.el.height) * fishy.size;
	}

	function clamp(x, min, max) {
		return x < min ? min : x > max ? max : x;
	}

	function getScroll() {
		var x, y;
		if (typeof pageXOffset !== 'undefined') {
			x = pageXOffset;
		}
		else {
			x = (D.clientWidth ? document.documentElement : document.body).scrollLeft;
		}
		if (typeof pageYOffset !== 'undefined') {
			y = pageYOffset;
		}
		else {
			y = (D.clientHeight ? document.documentElement : document.body).scrollTop;
		}
		return { x: x, y: y };
	}

	/* Sigmoid transfer with scaling/clamping */
	function sigmoid(x, min, max, cmin, cmax) {
		if (arguments.length <= 3) {
			cmin = min;
			cmax = max;
		}
		if (cmin < cmax && x < cmin) {
			return 1;
		}
		if (cmax > cmin && x > cmax) {
			return 0;
		}
		x = (x - min) / (max - min);
		return 1 / (1 + Math.exp(x * 8 - 4));
	}

	var prev = new Date().getTime();

	function update() {
		var now = new Date().getTime();
		var dt = (now - prev) / 1000;
		dt = clamp(dt, 0, 1 / 20);
		prev = now;
		/* Acceleration */
		fishies.forEach(function(fish) {
			fish.ddx = 0;
			fish.ddy = 0;
		});
		/* Accelerate towards cursor */
		if (hasCursor) {
			fishies.forEach(function(fish) {
				fish.ddx += (x - fish.x) * fish.speed * mouseFollow;
				fish.ddy += (y - fish.y) * fish.speed * mouseFollow;
			});
		}
		/* Drag */
		fishies.forEach(function(fish) {
			if (Math.hypot(fish.dx, fish.dy) < minSpeed) {
				return;
			}
			function spow(x) {
				return Math.pow(Math.abs(x), 1.3) * Math.sign(x);
			}
			fish.ddx -= spow(fish.dx) * drag;
			fish.ddy -= spow(fish.dy) * drag;
		});
		/* Avoidance and chasing */
		fishies.forEach(function (fish) {
			var fishSize = getSize(fish);
			var repulseX = 0, repulseY = 0, chaseX = 0, chaseY = 0;
			fishies.forEach(function (other) {
				var otherSize = getSize(other);
				var collision = (fishSize + otherSize) / 2;
				var minDist = minSpacing * collision;
				var maxDist = maxSpacing * collision;
				var maxVision = maxSpacing * fishSize;
				var Dx = other.x - fish.x;
				var Dy = other.y - fish.y;
				var Dr = Math.hypot(Dx, Dy);
				if (Dr < 5) {
					return;
				}
				var mag = sigmoid(Dr, minDist, maxDist, minDist, maxVision);
				var dx = (Dx / Dr) * mag;
				var dy = (Dy / Dr) * mag;
				if (fishSize / otherSize > 2) {
					chaseX += dx;
					chaseY += dy;
				} else {
					repulseX += dx;
					repulseY += dy;
				}
			});
			if (Math.hypot(repulseX, repulseY) / (1e-9 + Math.hypot(chaseX, chaseY)) < 0.5) {
				fish.ddx += chase * chaseX;
				fish.ddy += chase * chaseY;
			} else {
				fish.ddx -= avoidance * repulseX;
				fish.ddy -= avoidance * repulseY;
			}
		});
		/* Clamp */
		fishies.forEach(function (fish) {
			var fishSize = getSize(fish);
			var softSize = 100, hardSize = 30;
			var clampX = 0, clampY = 0;
			var wX = window.innerWidth - fishSize, wY = window.innerHeight - fishSize;
			clampX += sigmoid(fish.x, hardSize, softSize);
			clampY += sigmoid(fish.y, hardSize, softSize);
			clampX -= sigmoid(fish.x, wX - hardSize, wX - softSize);
			clampY -= sigmoid(fish.y, wY - hardSize, wY - softSize);
			fish.ddx += avoidance * clampX;
			fish.ddy += avoidance * clampY;
		});
		/* Acceleration integral */
		fishies.forEach(function(fish) {
			fish.dx += fish.ddx * dt;
			fish.dy += fish.ddy * dt;
		});
		/* Velocity integral */
		fishies.forEach(function(fish) {
			fish.x += fish.dx * dt;
			fish.y += fish.dy * dt;
		});
		/* Set angle */
		fishies.forEach(function(fish) {
			fish.angle = Math.atan2(fish.dx, -fish.dy) + fish.type.angle;
		});
		/* Update view */
		fishies.forEach(function (fish) {
			var scroll = getScroll();
			fish.el.style.transform = [
				position ? '' : 'translate(' + (fish.x + scroll.x) + 'px, ' + (fish.y + scroll.y) + 'px)',
				'rotate(' + fish.angle + 'rad)',
				'scaleX(-1)',
				'scale(' + fish.size + ')'
			].join(' ');
			if (position) {
				fish.el.style.left = (fish.x + scroll.x) + 'px';
				fish.el.style.top = (fish.y + scroll.y) + 'px';
			}
		});
	}

	/* Physics degree + HTML5 = stupid javascript animations */
	/* Wouldn't it be awesome to have this script on the homepage? */
	if (document.readyState === 'complete') {
		fishScript();
	} else {
		window.addEventListener('load', fishScript);
	}

})();
