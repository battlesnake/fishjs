(function (requestAnimationFrame) {
	'use strict';

	/*
	 * TODO:
	 *
	 *   a) When two larger fish are chasing the same small one, randomly make
	 *   them co-operate so one chases it towards the other.  Teamwork.
	 *
	 *   b) Implement a matrix which keeps track of which fish have been
	 *   co-operative to each other and which have been nasty to each other, then
	 *   use this to "bias" the chance that fish choose to co-operate or not.
	 *
	 *   c) We now have fish forming packs and hunting in packs...
	 *
	 *   d) PROFIT!!
	 */

	/* Initial number of fish */
	var nFishies = 25;
	/* Fish count limits */
	var maxFishies = 35, minFishies = 10;
	/* Fish size limits */
	var maxFishSize = 7, minFishSize = 1;
	/* Fluid drag */
	var drag = 0.3;
	/* Inter-fish spacing, will to avoid bigger fish, will to chase smaller ones */
	var minSpacing = 1.2, maxSpacing = 3, avoidance = 1500, chase = 500;
	/* Avoid edge of browser window */
	var edgeAvoidance = 2500;
	/* Minimum fish speed (stops things getting boring) */
	var minSpeed = 30;
	/* How strongly to follow the cursor when it moves */
	var mouseFollow = 0.8;
	/* Use css left/top to set position?  Uses transform/translate otherwise. */
	var position = true;
	/*
	 * CSS transition delay (ms) for smoothing motion (0 to disable).
	 *
	 * Enabling this may force each fish to be rendered in its own GraphicsLayer
	 * which will hurt performance (on Blink anyway).
	 */
	var smoothingTime = 0;
	/* Cowardice.  If set to 2.5, fish will only chase others 2.5x smaller */
	var cowardice = 1.3;
	/* Big fish slowly shrink */
	var fishShrinkThreshold = (maxFishSize - minFishSize) / 4 + minFishSize;
	/* Half-life of excess fish size (seconds) */
	var fishShrinkHalfLife = 20;
	/* Container element for fishies */
	var fishTank;
	/* Used in animateFrame */
	var lastFrameTime;

	/* Types of fish */
	var fishTypes = [
		{ code: "\uD83D\uDC1F", angle: -Math.PI / 2, color: 'blue' },
		{ code: "\uD83D\uDC20", angle: -Math.PI / 2, color: 'yellow' }
	];

	/* Fish array */
	var fishies = [];

	/* Cursor tracking */
	var x = 0, y = 0, hasCursor = false;

	/* Animation stuff */
	var frameSpeedWindow = 15;
	var frameSpeedDelta = 10;
	var frameSpeedThreshold = 15;
	var frameSpeedWindowFactor = frameSpeedWindow / 100.0 + 1;
	var frameSkip = 0;
	var frameSkipNumber = 0;

	/* Physics degree + HTML5 = stupid javascript animations */
	/* Wouldn't it be awesome to have this script on the homepage? */
	if (document.readyState === 'complete') {
		fishScript();
	} else {
		window.addEventListener('load', fishScript);
	}

	return;

	function fishScript() {
		fishTank = document.createElement('div');
		fishTank.style.position = 'fixed';
		fishTank.style.top = '1px';
		fishTank.style.left = '1px';
		fishTank.style.right = '1px';
		fishTank.style.bottom = '1px';
		fishTank.style.overflow = 'hidden';
		document.body.appendChild(fishTank);
		for (var i = 0; i < nFishies; i++) {
			addFish();
		}
		window.addEventListener('mousemove', mousemove);
		window.addEventListener('mouseout', mouseout);
		animateFrame(update);
	}

	/* Symmetric-range random number */
	function randSym(v) {
		return Math.random() * v * 2 - v;
	}

	function addFish() {
		var el = document.createElement('div');
		var size = Math.pow(Math.random(), 3) * (maxFishSize - minFishSize) + minFishSize;
		/* Margin */
		var wm = -20;
		/* Size */
		var ww = window.innerWidth - 2*wm, wh = window.innerHeight - 2*wm;
		/* Random, int, frac */
		var wr = Math.random() * 4, wi = Math.floor(wr), wf = wr - wi;
		var wx = wi === 0 ? 0 : wi === 1 ? 1 : wf;
		var wy = wi === 2 ? 0 : wi === 3 ? 1 : wf;
		var fish = {
			el: el,
			type: fishTypes[Math.floor(Math.random() * fishTypes.length)],
			x: ww * wx + wm,
			y: wh * wy + wm,
			dx: randSym(minSpeed),
			dy: randSym(minSpeed),
			ddx: 0,
			ddy: 0,
			angle: 0,
			speed: 0.4 / size + 0.2,
			size: size,
			eat: eatFish,
			die: die,
			dying: false
		};
		el.innerHTML = fish.type.code;
		el.style.position = 'absolute';
		el.style.left = 0;
		el.style.top = 0;
		el.style.display = 'block';
		el.style.zIndex = '999999';
		if (!position) {
			el.style.transformOrigin = 'center center';
		}
		updateFishView(fish);
		if (smoothingTime > 0) {
			var smoothen = position ? ['left', 'top'] : ['transform'];
			var transition = smoothen
				.map(function (attr) {
					return [attr, smoothingTime + 'ms', 'linear'].join(' ');
				})
				.join(', ');
			el.style.transition = transition;
		}
		el.style.fontFamily = 'Segoe UI Emoji,Segoe UI Symbol,Symbola,Arial Unicode MS,DejaVu Sans';
		el.style.color = fish.type.color;
		el.style.textRendering = 'optimizeSpeed';
		fishTank.appendChild(el);
		fishies.push(fish);

		function eatFish(other) {
			var fish  = this;
			var mo = other.size * other.size;
			var ma = fish.size * fish.size;
			/* Conservation of fish */
			fish.size = Math.hypot(fish.size, other.size);
			var mb = fish.size * fish.size;
			/* Conservation of momentum */
			fish.dx = (fish.dx * ma + other.dx * mo) / mb;
			fish.dy = (fish.dy * ma + other.dy * mo) / mb;
			/* Death and taxes */
			other.size = 0;
			other.dying = true;
		}

		function die() {
			removeFish(this);
		}
	}

	function removeFish(fish) {
		if (fish) {
			fish = fishies.splice(fishies.indexOf(fish), 1)[0];
		} else {
			fish = fishies.pop();
		}
		fish.el.parentNode.removeChild(fish.el);
		fish.el = null;
	}

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

	/* 
	 * Add/remove fishies to keep frame speed within % of target value
	 *
	 * ms = milliseconds since last frame
	 */
	function populationControl(dt) {
		/* 
		 * Pixels and cpu cycles are a finite resource.  Too many fish results in
		 * the environment being depleted of CPU cycles and pixels, so fish start
		 * to starve to death.  As fish die out, CPU cycles and pixels start to
		 * grow back again.
		 */
		var fps = 1 / dt;
		if (fps < 30) {
			frameSpeedDelta++;
			if (frameSkip) {
				frameSkip--;
			}
		} else if (fps > 45 && fishies.length < maxFishies) {
			frameSpeedDelta--;
		} else if (fps > 45 && fishies.length === maxFishies && requestAnimationFrame) {
			frameSkip++;
		}
		if (Math.abs(frameSpeedDelta) > frameSpeedThreshold) {
			if (frameSpeedDelta > 0) {
				if (fishies.length > minFishies) {
					removeFish();
				}
			} else {
				addFish();
			}
			frameSpeedDelta /= 2;
		}
	}

	function update(dt) {
		dt = clamp(dt, 0, 1 / 20);
		/* Population control */
		populationControl(dt);
		/* Reset acceleration (accumulates each frame) */
		fishies.forEach(function(fish) {
			fish.ddx = 0;
			fish.ddy = 0;
		});
		/* Accelerate towards cursor */
		followCursor();
		/* Drag */
		applyDrag();
		/* Avoidance and chasing */
		socialBehaviour();
		/* Remove eaten fish */
		removeEaten();
		/* Shrink */
		weightLoss(dt);
		/* Clamp */
		avoidTankEdges();
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
		updateView();
	}

	function applyDrag() {
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
	}

	function followCursor() {
		if (hasCursor) {
			fishies.forEach(function(fish) {
				fish.ddx += (x - fish.x) * fish.speed * mouseFollow;
				fish.ddy += (y - fish.y) * fish.speed * mouseFollow;
			});
		}
	}

	function removeEaten() {
		fishies
			.filter(function (fish) {
				return fish.dying;
			})
			.forEach(function (fish) {
				fish.die();
			});
	}

	function weightLoss(dt) {
		fishies
			.forEach(function (fish) {
				var diff = fish.size - fishShrinkThreshold;
				if (diff < 0) {
					return;
				}
				/*
				 * If I recall the decay equation from my nuclear physics
				 * correctly, this should give excess fish mass a "half-life".
				 */
				var loss = 1 - Math.exp(-dt * 0.69 / fishShrinkHalfLife);
				fish.size -= diff * loss;
			});
	}

	function socialBehaviour() {
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
				Dx /= Dr;
				Dy /= Dr;
				var mag = sigmoid(Dr, minDist, maxDist, minDist, maxVision);
				/* 
				 * Dot distance vector with velocity, prefer chasing fish that
				 * are directly ahead.  Also stops fish from eating through their
				 * arses.
				 */
				if (fishSize > otherSize) {
					var dot = (Dx * fish.dx + Dy * fish.dy) / Math.hypot(fish.dx, fish.dy);
					if (dot < 0) {
						return;
					}
					mag *= dot;
				}
				var dx = Dx * mag;
				var dy = Dy * mag;
				if (fishSize / otherSize > cowardice) {
					if (fishSize > otherSize && Dr < fishSize / 3) {
						/* Om nom nom nom */
						fish.eat(other);
					} else {
						chaseX += dx;
						chaseY += dy;
					}
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
	}

	function avoidTankEdges() {
		fishies.forEach(function (fish) {
			var fishSize = getSize(fish);
			var softSize = 50, hardSize = 30;
			var clampX = 0, clampY = 0;
			var wX = window.innerWidth - fishSize, wY = window.innerHeight - fishSize;
			clampX += sigmoid(fish.x, hardSize, softSize);
			clampY += sigmoid(fish.y, hardSize, softSize);
			clampX -= sigmoid(fish.x, wX - hardSize, wX - softSize);
			clampY -= sigmoid(fish.y, wY - hardSize, wY - softSize);
			fish.ddx += edgeAvoidance * clampX;
			fish.ddy += edgeAvoidance * clampY;
		});
	}

	function updateView() {
		fishies.forEach(updateFishView);
	}
	
	function updateFishView(fish) {
		var scroll = {x:0,y:0}; //getScroll();
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
	}

	function animateFrame(fn) {
		if (requestAnimationFrame) {
			requestAnimationFrame(onTick);
		} else {
			setTimeout(function () { onTick(new Date().getTime()); }, 1000 / 60);
		}

		function onTick(now) {
			if (!lastFrameTime) {
				lastFrameTime = now;
				animateFrame(fn);
				return;
			}
			var dt = (now - lastFrameTime) / 1000;
			frameSkipNumber++;
			if (dt > 0 && frameSkipNumber >= frameSkip) {
				frameSkip = 0;
				lastFrameTime = now;
				fn(dt);
			}
			animateFrame(fn);
		}
	}

})(window.requestAnimationFrame);
