'use strict';

var Behavior = {
	init: function (entity, config) {
		this.entity = entity;
		this.started = false;
		for (var c in config) {
			this[c] = config[c];
		}
		return this;
	},
	start: function () {
	},
	update: function (dt) {
	},
	end: function () {
	},
	transform: function (ctx) {
	},
	draw: function (ctx) {
	},
	drawAfter: function (ctx) {
	}
}

var Velocity = Object.create(Behavior);
Velocity.update = function (dt) {
	this.entity.x += dt * this.entity.velocity.x;
	this.entity.y += dt * this.entity.velocity.y;
	this.entity.angle += dt * this.entity.velocity.angle || 0;
};

var Accelerate = Object.create(Behavior);
Accelerate.update = function (dt) {
	this.entity.velocity.x += dt * this.entity.acceleration.x;
	this.entity.velocity.y += dt * this.entity.acceleration.y;
	if (this.maxSpeed) {
		this.entity.velocity.x = clamp(this.entity.velocity.x, -this.maxSpeed, this.maxSpeed);
		this.entity.velocity.y = clamp(this.entity.velocity.y, -this.maxSpeed, this.maxSpeed);
	}
};

var Animate = Object.create(Behavior);
Animate.update = function (dt) {
	if (this.paused) return;
	this.entity.frameDelay -= dt;
	if (this.entity.frameDelay <= 0) {
		this.entity.frameDelay = this.entity.maxFrameDelay;
		this.entity.frame = (this.entity.frame + 1) % this.entity.maxFrame;
		if (this.entity.frame == this.entity.maxFrame - 1 &&  this.onEnd) {
			this.onEnd();
		}
	}
};

var Fade = Object.create(Behavior);
Fade.start = function () {
	if (this.entity.active) {
		this.entity.opacity = 0;
	}
	this.entity.activate = function () {
		this.entity.opacity = 0;
		this.entity.active = true;
	}
};
Fade.update = function (dt) {
	if (this.entity.opacity < 1) {
		this.entity.opacity += dt / (this.speed ? this.speed : 1);
	}
};

var Bound = Object.create(Behavior);
Bound.update = function (dt) {
	this.entity.x = clamp(this.entity.x, this.min.x, this.max.x);
	this.entity.y = clamp(this.entity.y, this.min.y, this.max.y);
};

var DrawHitBox = Object.create(Behavior);
DrawHitBox.draw = function (ctx) {
	ctx.fillStyle = "red";
	ctx.fillRect(this.entity.x - this.entity.w / 2, this.entity.y - this.entity.h / 2, this.entity.w, this.entity.h);
}


var Pathfind = Object.create(Behavior);
Pathfind.speed = 160;
Pathfind.start = function () {
	// create grid, path
	var grid = [];
	var e = Object.create(Entity).init(this.bound.min.x + this.cell_size / 2, this.bound.min.y + this.cell_size / 2, this.cell_size, this.cell_size);
	e.family = "code";
	e.setCollision(Polygon);

	var objects = this.layer.entities.filter( function (e) { return (e.solid && e.family == "neutral"); });
	for (var i = this.bound.min.x + this.cell_size / 2; i < this.bound.max.x; i += this.cell_size) {
		e.x = Math.floor(i);
		for (var j = this.bound.min.y + this.cell_size / 2; j < this.bound.max.y; j += this.cell_size) {
			e.y = Math.floor(j);
			var distance = 1;
			var c = {x: Math.floor(i / this.cell_size), y: Math.floor(j / this.cell_size)};
			for (var k = 0; k < objects.length; k++) {
				if (e.collision.onCheck(e, objects[k])) {
					distance = 99999999;
					break;
				} else {
				}
			}
			if (grid[c.x]) {
				grid[c.x][c.y] = {x: c.x, y: c.y, cost: 999999, distance: distance};
			} else {
				grid[c.x] = [];
				grid[c.x][c.y] = {x: c.x, y: c.y, cost: 999999, distance: distance};
			}
		}
	}
	this.grid = grid;
}
Pathfind.draw = function (ctx) {
	//return;
	if (!DEBUG) return;
	if (this.grid) {
		ctx.globalAlpha = 0.3;
		ctx.fillStyle = this.route && this.route.length > 0 ? "green" : "yellow";
		for (var i = 0; i < this.grid.length; i++) {
			for (var j = 0; j < this.grid[i].length; j++) {
				if (this.grid[i][j].distance > 1)
					ctx.fillRect(this.bound.min.x + this.cell_size * i, this.bound.min.y + this.cell_size * j, this.cell_size, this.cell_size);
			}
		}
		if (this.route) {
			ctx.fillStyle = "red";
			for (var i = 0; i < this.route.length; i++) {
				ctx.fillRect(this.route[i].x * this.cell_size, this.route[i].y * this.cell_size, this.cell_size, this.cell_size);
			}
		}
		
		if (this.goal) {
			ctx.fillRect(this.goal.x - 2, this.goal.y - 2, 4, 4);
		}

		ctx.globalAlpha = 1;
	} else {
	}
}
Pathfind.getNeighbors = function (node) {
	var x = node.x, y = node.y;
	var neighbors =[];
	var right = false, left = false;
	for (var i = x - 1; i <= x + 1; i += 1) {
		var nx = i;
		if (this.grid[nx] && this.grid[nx][y])
			neighbors.push(this.grid[nx][y]);
	}
	for (var j = y - 1; j <= y + 1; j += 1) {
		if (this.grid[x]) {
			var ny = j;
			if (this.grid[x][ny])
				neighbors.push(this.grid[x][ny]);
		}
	}
	//console.log('n', neighbors.length);
	return neighbors;
}
Pathfind.new = function (target) {
	this.target = target;
	this.route = null;
}
Pathfind.stop = function () {
	this.target = null;
	this.route = null;
}
Pathfind.a_star = function (start, goals) {
  start.cost = 0;
	var checked = [];
  var fringe = [start];
  var index = 0
  
  while (fringe.length > 0 && index < 1000) {
  	index += 1;
    var f = fringe.sort( function (a, b) { return a.cost < b.cost; }).pop();
    if (goals.indexOf(f) != -1) {
      var route = [];
      //ai.searching = false;
      while (f.from) {
      	route.push({x: f.x , y: f.y });
        g = f.from;
        f.from = undefined;
        f = g;
      }
      return route;
    }
    checked.push(f);
    this.getNeighbors(f).forEach( function (nw) {
    	if (checked.indexOf(nw) == -1) {
      	var d = f.cost + nw.distance;
        if (d < nw.cost) {
        	nw.cost = d;
          nw.from = f;
          fringe.push(nw);
        }
      }
    });
  }
  console.log("not found (max fringe size reached)", index, fringe.length);
  return [];
}
Pathfind.resetCost = function () {
	if (this.grid) {
		for (var i = 0; i < this.grid.length; i++) {
			for (var j = 0; j < this.grid[i].length; j++) {
				this.grid[i][j].cost = 999999;
			}
		}
	}
}
Pathfind.update = function (dt) {
	if (!this.target) return;
	if (this.grid) {
		if (this.route && this.route.length > 0) {
			if (this.goal) {
				var theta = angle(this.entity.x, this.entity.y, this.goal.x, this.goal.y);
				// FIX ME: what is 'speed' used for??? (used to be SPEED.ship)
				var dx = 1.5 * this.speed * Math.cos(theta), dy = 1.5 * this.speed * Math.sin(theta);
				this.entity.velocity.x += 3 * dt * (dx - this.entity.velocity.x);
				this.entity.velocity.y += 3 * dt * (dy - this.entity.velocity.y);
				if (distance(this.entity.x, this.entity.y, this.goal.x, this.goal.y) < 20) {
					this.goal = undefined;
				}
/*				this.entity.velocity.x = (this.goal.x - this.entity.x);
				this.entity.velocity.y = (this.goal.y - this.entity.y);
				if (Math.abs(this.goal.x - this.entity.x) < 10 && Math.abs(this.goal.y - this.entity.y) < 10)
				{
					this.goal = undefined;
				}*/
			} else {
				var next = this.route.pop();
				if (next) {
					this.goal = {x: this.cell_size * next.x + this.cell_size / 2, y: this.cell_size * next.y + this.cell_size / 2};
				}
			}
		} else {
			var i = Math.floor(this.entity.x / this.cell_size), j = Math.floor(this.entity.y / this.cell_size);
			var ti = Math.floor(this.target.x / this.cell_size), tj = Math.floor(this.target.y / this.cell_size);
			if (this.grid[i] && this.grid[i][j] && this.grid[ti] && this.grid[ti][tj]) {
				this.resetCost();
				this.route = this.a_star(this.grid[i][j], [this.grid[ti][tj]]);
			}
		}
	}
	else {
		this.start();
	}
}

var SimpleAI = Object.create(Behavior);
SimpleAI.speed = 160;
SimpleAI.update = function (dt) {
	//console.log(this.target);
	//console.log(this.target.x, this.entity.x, (this.entity.x > this.target.x ? -1 : 1))
	// FIX ME: obviously, once the screep is wrapping, you need to factor that in too...
	this.entity.velocity = {
		x: clamp( (this.entity.x > this.target.x ? -1 : 1) * Math.abs(this.entity.x - this.target.x) / 2, - this.speed / 2, this.speed / 2),
		y: clamp( (this.entity.y > this.target.y ? -1 : 1) * Math.abs(this.entity.y - this.target.y) / 2, - this.speed / 2, this.speed / 2)
	}
	if (this.entity.health < 5) {
		this.entity.removeBehavior(this);
	}
}

var Wrap = Object.create(Behavior);
Wrap.update = function (dt) {
	if (this.entity.x > this.max.x) {
		this.entity.x = this.min.x + (this.entity.x - this.max.x);
	} else if (this.entity.x < this.min.x) {
		this.entity.x = this.max.x  - (this.min.x - this.entity.x);
	}
  if (this.entity.y > this.max.y) {
		this.entity.y = this.min.y + (this.entity.y - this.max.y);
	} else if (this.entity.y < this.min.y) {
		this.entity.y = this.max.y  - (this.min.y - this.entity.y);
	}
}

var Invulnerable = Object.create(Behavior);
Invulnerable.start = function () {
	this.entity.invulnerable = 0;
}
Invulnerable.update = function (dt) {
	if (this.entity.invulnerable === undefined) this.start();
	if (this.entity.invulnerable > 0) {
		this.entity.invulnerable -= dt;
	}
}

var Drop = Object.create(Behavior);
Drop.end = function () {
	if (this.drop) {
		var d = Object.create(this.drop);
		this.entity.layer.add(d);
	}
}

var Crop = Object.create(Behavior);
Crop.update = function (dt) {
  if (this.entity.x > this.max.x || this.entity.x < this.min.x) this.entity.alive = false;
  if (this.entity.y > this.max.y || this.entity.y < this.min.y) this.entity.alive = false;
}


// a collision object, which will set up the required data

var Collision = {
	init: function ( fns ) {
		object.onStart = fns.start || object.onStart,
		object.onCheck = fns.check || object.onCheck,
		object.onHandle = fns.handle || object.onHandle,
		object.onEnd = fns.end || object.onEnd;
	},
	onStart: function (object) {},
	onCheck: function (object, other) {},
	onHandle: function (object, other) {},
	onEnd: function (object) {},
	onDraw: function (object, ctx) {}
};

var PixelPerfect = Object.create(Collision);
PixelPerfect.onStart = function (object) {
		if (!object.getImageData) {
			object.getImageData = function () {
				if (!object.imageData) {
					var c = document.createElement("canvas");
					c.width = object.w;
					c.height = object.h;
					var ctx = c.getContext("2d");
					ctx.imageSmoothingEnabled = false;
					var x = object.x, y = object.y, opacity = object.opacity;
					object.x = object.w / 2, object.y = object.h / 2, object.opacity = 1;
					object.draw(ctx);
					object.ig = ctx.getImageData(0, 0, object.w, object.h);
					object.imageData = object.ig.data;
					object.x = x, object.y = y, object.opacity = opacity;
		   			return object.imageData;
				}
				else {
					return object.imageData;
				}
	  };
	}
};
PixelPerfect.onCheck = function (object, other) {
	// object is a weird/hacky/exciting thing... so if an entity has the 'doPixelPerfect' collision, it will check for imageData, and create and supply its own function if it isn't found.

	if (!object.getImageData || !other.getImageData) return false;
  
	var m = object, n = other;
	var n_data = n.getImageData();
	var m_data = m.getImageData();

	// if either does not have an imageData field, cannot find collision

  m = {x: m.getBoundX(), y: m.getBoundY(), w: m.w, h: m.h};
  n = {x: n.getBoundX(), y: n.getBoundY(), w: n.w, h: n.h};
	if (m.x + m.w < n.x || m.x > n.x + n.w)
		return false;
	if (m.y + m.h < n.y || m.y > n.y + n.h)
		return false;


	// find intersection...
	var minX = Math.max(m.x, n.x), minY = Math.max(m.y, n.y);
	var maxX =  Math.min(m.x + m.w, n.x + n.w), maxY = Math.min(m.y + m.h, n.y + n.h);
	
/**					************************					**/
/**					Compare in overlap range					**/
/**					(Pixel by pixel, if not 					**/
/**					transparent i.e. 255)   					**/
/**					************************					**/

	for (var j = 0; j < maxY - minY; j++)
	{
		for (var i = 0; i < maxX - minX; i++)
		{
			var my = ((minY - m.y) + j) * m.w * 4,
				mx = ((minX - m.x) + i) * 4 + 3;
			var ny = ((minY - n.y) + j) * n.w * 4,
				nx = ((minX - n.x) + i) * 4 + 3;
			if (m_data[my + mx] != 0 && n_data[ny + nx] != 0)
			{
				return true;
			}
		}
	}
	return false;
};

var Box = Object.create(Collision);
Box.onCheck = function (object, other) {
	if (object.x + object.w > other.x && object.x < other.x + other.w) {
		if (object.y + object.h > other.y && object.y < other.y + other.h) {
			return true;
		}
	}
	return false;
};

var Polygon = Object.create(Collision);
Polygon.onStart = function (object) {
	if (!object.vertices) {
		var d = Math.sqrt(Math.pow(object.w, 2) + Math.pow(object.h, 2)) / 2;
		var th = Math.acos(0.5 * object.w / d);
		object.vertices = [
			{d: d, theta: th},
			{d: d, theta: Math.PI - th},
			{d: d, theta: Math.PI + th},
			{d: d, theta: 2 * Math.PI - th}
		];
	}
	object.getVertices = function () {
		var result = [];
		for (var i = 0; i < this.vertices.length; i++) {
			var x = this.x + this.vertices[i].d * Math.cos(this.vertices[i].theta + this.angle);
			var y = this.y + this.vertices[i].d * Math.sin(this.vertices[i].theta + this.angle);
			result.push({x: x, y: y});
		}
		return result;
	}
	object.getAxes = function () {
		var result = [];
		var v = this.getVertices();
		for (var i = 0; i < v.length; i++) {
			var x = v[i].x - v[(i+1) % v.length].x;
			var y = v[i].y - v[(i+1) % v.length].y;
			var magnitude = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
			result.push({x: -y / magnitude, y: x / magnitude});
		}
		return result;
	}
};

Polygon.onCheck = function (o1, o2) {
	if (!o1.getVertices || !o2.getVertices) return false;
	else if (o1 == o2) return false;
	else if (distance(o1.x, o1.y, o2.x, o2.y) > Math.max(o1.h, o1.w) + Math.max(o2.h, o2.w)) return false;
	var v1 = o1.getVertices(), v2 = o2.getVertices();
	var a1 = o1.getAxes(), a2 = o2.getAxes();

	var separate = false;

	for (var i = 0; i < a1.length; i++) {
		var p1 = project(a1[i], v1);
		var p2 = project(a1[i], v2);

		if (!overlap(p1, p2)) return false;
	}

	for (var i = 0; i < a2.length; i++) {
		var p1 = project(a2[i], v1);
		var p2 = project(a2[i], v2);

		if (!overlap(p1, p2)) return false;
	}

	// line between center point of the two objects
	/*
	var s_a = {x: (o1.x - o2.x) , y: (o1.y - o2.y)}
	var max = 0, index = 0;

	for (var i = 0; i < v2.length; i++) {
		var p = dot(s_a, v2[i]);
		if (p > max) {
			max = p;
			index = i;
		}
	}

	var v = {x: v2[index].x - o2.x, y: v2[index].y - o2.y};

	var proj = (dot(v, s_a) / dot(s_a, s_a));
	var projection = {x: proj * s_a.x, y: proj * s_a.y};*/

	return true;//distance(0, 0, projection.x, projection.y);
}


var Collisions = {
	Box: Box
}

var HandleCollision = {
	handleSolid: function (object, other) { 
		if (other.solid) {
			var dx = Math.abs(object.x - other.x);
			var d = distance(object.x, object.y, other.x, other.y);
			var cross = distance(other.x, other.y, other.getBoundX(), other.getBoundY());
			//console.log(dx, d, 0.5 * other.w, cross);
			var bounce = (object.bounce || 0) || (other.bounce || 0);
			if (Math.abs(dx / d) < Math.abs(0.5 * other.w / cross)) {
				//console.log('vertical');
				object.y += object.getBoundY() < other.getBoundY() ? -2 : 2;
        		object.velocity.y = object.getBoundY() < other.getBoundY() ? Math.min(-1 * bounce * object.velocity.y, object.velocity.y) : Math.max(-1 * bounce * object.velocity.y, object.velocity.y);
        		object.acceleration.y = object.getBoundY() < other.getBoundY() ? Math.min(0, object.acceleration.y) : Math.max(0, object.acceleration.y);
        	} else {
        		//console.log('horizontal')
				object.x += object.getBoundX() < other.getBoundX() ? -2 : 2;
        		object.velocity.x = object.getBoundX() < other.getBoundX() ? Math.min(-1 * bounce * object.velocity.x, object.velocity.x) : Math.max(-1 * bounce * object.velocity.x, object.velocity.x);
        		object.acceleration.x = object.getBoundX() < other.getBoundX() ? Math.min(0, object.acceleration.x) : Math.max(0, object.acceleration.x);
        	}//object.velY *= -1;
		}
	}
}

var PI = Math.PI;
var PI2 = 2 * Math.PI;

var fullscreen = false;
function requestFullScreen () {
// we've made the attempt, at least
  fullscreen = true;
  console.log('requestingFullScreen');
  var body = document.documentElement;
  if (body.requestFullscreen) {
    body.requestFullscreen();
  } else if (body.webkitRequestFullscreen) {
    body.webkitRequestFullscreen();
  } else if (body.mozRequestFullscreen) {
    body.mozRequestFullscreen();
  } else if (body.msRequestFullscreen) {
    body.msRequestFullscreen();
  }
}

function range(min, max) {
  var arr = [];
  for (var i = min; i < max; i++) {
    arr.push(i);
  }
  return arr;
}

function distance(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

function angle(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

function modulo(n, p) {
  return (n % p + p) % p;
}

function dot (v1, v2) {
  return v1.x * v2.x + v1.y * v2.y;
}

function cross(v1, v2) {
  return v1.x * v2.y - v1.y * v2.x;
}

function sign (n) {
  return n >= 0 ? 1 : -1;
}

function short_angle(a1, a2) {
  var MAX = Math.PI * 2;  
  var da = (a2 - a1) % MAX;
  return 2 * da % MAX - da;
}

function lerp_angle (a1, a2, rate) {
  var r = a1 + short_angle(a1, a2) * rate;
  if (Math.abs(r - a2) < 0.01) return a2;
  else return r;
}

function choose (array) {
  return array[Math.floor(Math.random() * array.length)];
}

function project(axes, vertices) {
  var min = dot(axes, vertices[0]);
  var max = min;
  for (var i = 0; i < vertices.length; i++) {
    var p = dot(axes, vertices[i]);
    if (p < min) min = p;
    else if (p > max) max = p;
  }
  return [min, max];
}

function between(n, min, max) {
  return n >= min && n <= max;
}

function randomColor () {
  return "#" + ("000000" + Math.floor(Math.random()*Math.pow(256,3)).toString(16)).substr(-6);
}

function randint(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function randomGray () {
  var seed = ("00" + Math.floor(Math.random() * 150 + 56).toString(16)).substr(-2);
  return "#" + seed + seed + seed;
}

function lerp (current, goal, rate) {
  if (Math.abs(goal - current) <= 1) {
    return goal;
  } else {
    return (1-rate)*current + rate*goal
  }  
}

function normalize (x, y) {
  var d = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
  return {x: x / d, y: y / d};
}

function overlap(p1, p2) {
  if ((p1[0] >= p2[0] && p1[0] < p2[1]) || (p1[1] > p2[0] && p1[1] <= p2[1])) {
      return true;
  }
  if ((p2[0] >= p1[0] && p2[0] < p1[1]) || (p2[1] > p2[0] && p2[1] <= p1[1])) {
      return true;
  }
  else {
      return false;
  }
}

function clamp (n, min, max) {
	return Math.max(Math.min(n, max), min);
}

function distance (x1, y1, x2, y2) {
	return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

var DEBUG = false;

var KEYCODE = {
	left: 37,
  up: 38,
  right: 39,
  down: 40,
  a: 65,
  d: 68,
  s: 83,
  w: 87,
  p: 80,
  escape: 27,
  enter: 13,
  space: 32
};

var Resources = [];
var RESOURCES = [];

var debug = {};

// movement (x,y), size, rate, threshold
var TileMovement = Object.create(Behavior);
TileMovement.threshold = 0;
TileMovement.update = function (dt) {
  if (this.movement.y != 0) {
    this.entity.velocity.y = this.movement.y * this.speed;
  } else {
    this.entity.velocity.y = Math.round((Math.round((this.entity.y + sign(this.entity.velocity.y) * this.threshold * this.size)/ this.size) * this.size - this.entity.y)) * (this.rate);
    if (this.entity.velocity.y == 0) this.entity.y = Math.round(Math.round(this.entity.y / this.size) * this.size);
  }
  if (this.movement.x != 0) {
    this.entity.velocity.x = this.movement.x * this.speed;
  } else {
    this.entity.velocity.x = Math.round((Math.round((this.entity.x + sign(this.entity.velocity.x) * this.threshold * this.size)/ this.size) * this.size - this.entity.x)) * (this.rate);
    if (this.entity.velocity.y == 0) this.entity.y = Math.round(Math.round(this.entity.y / this.size) * this.size);
  }
}

var Follow = Object.create(Behavior);
Follow.update = function (dt) {  
  if (this.offset.x !== false)
    this.entity.x = this.target.x + (this.offset.x || 0);
  if (this.offset.y !== false)
    this.entity.y = this.target.y + (this.offset.y || 0);
  if (this.offset.z !== false)
    this.entity.z = this.target.z + (this.offset.z || 0);
  if (this.offset.angle !== false)
    this.entity.angle = this.target.angle + (this.offset.angle || 0);
  if (this.target.alive === false) this.entity.alive = false;
};

var Shake = Object.create(Behavior);
Shake.update = function (dt) {
  if (this.time === undefined) this.start();
  this.time += dt;
  if (!this.time || this.time > this.duration) {
    if (this.original)
    {
      this.entity.x = this.original.x, this.entity.y = this.original.y;
      this.original = undefined;
    }
    return;
  }
  else {
    this.entity.x += Math.random() * this.magnitude - this.magnitude / 2;
    this.entity.y += Math.random() * this.magnitude - this.magnitude / 2;
  }
};
Shake.start = function () {
  if (this.original) return;
  this.original = {x: this.entity.x, y: this.entity.y};
  this.time = 0;
};

var Trail = Object.create(Behavior);
Trail.update = function (dt) {
  if (!this.time) this.start();
  if (this.totalTime > this.duration) return;
  this.time += dt;
  this.totalTime += dt;
  if (this.time > this.interval) {
    this.time = 0;
    var p = this.createParticle(this.entity.x, this.entity.y - 12);
    p.z = 10;
    p.health = 0;
    p.opacity = 0.3;
    p.addBehavior(FadeOut, {duration: 1});
    this.entity.layer.add(p);
  }
};
Trail.createParticle = function (x, y) {
  return Object.create(Entity).init(x + Math.random() * 16 - 8,y + Math.random() * 16 - 8,32,32);
};
Trail.start = function () {
  this.time = 0;
  this.totalTime = 0;
  this.interval = this.interval || 0.05;
  this.duration = this.duration || 10;
};

var Flip = Object.create(Behavior);
Flip.update = function (dt) {
  if (this.entity.velocity.x > 0) {
    this.entity.mirrored = false;
  } else {
    this.entity.mirrored = true;
  }
};
Flip.transform = function (ctx) {
  if (this.entity.mirrored) ctx.scale(-1, 1);
};

var Flash = Object.create(Behavior);
Flash.update = function (dt) {
  if (!this.time) this.start();
  this.time += dt;
  if (this.time >= this.duration) {
    this.entity.removeBehavior(this);
    this.entity.blend = "normal";
  }
}
Flash.start = function () {
  this.duration = this.duration || 1;
  this.time = 0;
  this.entity.blend = "screen";
}


var Delay = Object.create(Behavior);
Delay.start = function () {
  this.time = 0;
}
Delay.update = function (dt) {
  if (this.time == undefined) this.start();

  this.time += dt;
  if (this.time > this.duration) {
    this.callback();
    this.entity.removeBehavior(this);
  }
}


var FadeOut = Object.create(Behavior);
FadeOut.start = function () {
  if (this.entity.collision) {
    this.entity.collision.onCheck = function (a, b) { console.log(2);  return false };
  }
  this.maxOpacity = this.entity.opacity;
  this.time = 0;
}

var FadeIn = Object.create(Behavior);
FadeIn.start = function () {
  if (this.entity.collision) {
    this.entity.collision.onCheck = function (a, b) { console.log(3);  return false };
  }
  this.maxOpacity = 1;
  this.time = 0;
};

//object, field, goal, rate
var Lerp = Object.create(Behavior);
Lerp.update = function (dt) {
  if (this.field == "angle")
    this.object[this.field] = lerp_angle(this.object[this.field], this.goal, this.rate * dt);
  else
    this.object[this.field] = lerp(this.object[this.field], this.goal, this.rate * dt);
  if (this.object[this.field] == this.goal && this.callback) this.callback(); 
};

FadeIn.update = function (dt) {
    if (!this.time) this.start();

    if (this.delay && this.delay > 0) {
      this.delay -= dt;
      return;
    }
    
    this.time += dt;
    if (this.time < this.duration) {
      this.entity.opacity = clamp(this.maxOpacity * (this.time) / this.duration, 0, 1);      
    }
};

FadeOut.update = function (dt) {
    if (this.time === undefined) this.start();

    if (this.delay && this.delay > 0) {
      this.delay -= dt;
      return;
    }

    this.time += dt;
    if (this.time >= this.duration && this.remove) this.entity.alive = false;
    this.entity.opacity = clamp(this.maxOpacity * (this.duration - this.time) / this.duration, 0, 1);
};
FadeOut.start = function () {
  if (this.entity.collision) {
    this.entity.collision.onCheck = function (a, b) { return false };
  }
  this.maxOpacity = this.maxOpacity || this.entity.opacity;
  this.remove = this.remove === undefined ? true : this.remove;
  this.time = 0;
  this.delay = this.delay || 0;
}

var Face = Object.create(Behavior);
Face.update = function (dt) {
  this.time = this.time || 0;
  this.time += dt;
  if (this.target) {
    this.entity.angle = angle(this.entity.x + this.entity.offset.x, this.entity.y + this.entity.offset.y, 
      this.target.x + this.target.offset.x, this.target.y + this.target.offset.y) + (this.offsetAngle || 0);
  }
}

var Oscillate = Object.create(Behavior);
Oscillate.update = function (dt) {
  if (!this.started) this.start();
  this.time += this.rate * dt;
  this.object[this.field] = this.constant * Math.sin(this.time) + this.initial;
}
Oscillate.start = function () {
  this.started = true;
  this.time = this.time || 0;
  this.constant = this.constant || 1;
  this.initial = this.initial || 0;
  this.rate = this.rate || 1;
  this.object = this.object || this.entity;
}

var Cooldown = Object.create(Behavior);
Cooldown.update = function (dt) {
  if (this.entity.cooldown === undefined) this.start;

  if (this.entity.cooldown > 0)
    this.entity.cooldown -= dt;
}
Cooldown.start = function () {
  this.entity.cooldown = 0;
}

var HighLight = Object.create(Behavior);
HighLight.start = function () {
  this.time = 0;
  this.duration = this.duration || 1;
}
HighLight.update = function (dt) {
  if (this.time == undefined) this.start();
  if (this.entity.frame == 1) {
    this.time += dt;
    if (this.time > this.duration) {
      this.time = 0;
      this.entity.frame = 0;
    }
  }
}

var Entity = {
	opacity: 1,
	angle: 0,
	alive: true,
	z: 1,
	points: 1,
	// this makes it a CLASS variable, which is maybe not a good idea, since that means unless it is initialized, adding a behavior adds it to ALL objects ofthat class
	behaviors: [],
	instance: function () {
		this.velocity = {x: 0, y: 0};
		this.offset = {x: 0, y: 0};
		this.behaviors = [];
	},
	init: function (x, y, w, h) {
		this.instance();
		this.x = x, this.y = y;
		this.h = h || 4, this.w = w || 4;
		return this;
	},
	getX: function () { return this.x; },
	getY: function () { return this.y; },
  getBoundX: function () { return Math.floor(this.x - this.w/2); },
  getBoundY: function () { return Math.floor(this.y - this.h/2); },
	draw: function (ctx) {
		for (var i = 0; i < this.behaviors.length; i++) {
			this.behaviors[i].draw(ctx);
		}
		ctx.save();
		ctx.translate(this.x, this.y);
		ctx.translate(this.offset.x, this.offset.y);
		
		if (this.origin)
			ctx.translate(this.origin.x, this.origin.y);
		
		ctx.rotate(this.angle);

		if (this.origin)
			ctx.translate(-this.origin.x, -this.origin.y);
		
		if (this.scale !== undefined) {
			ctx.scale(this.scale, this.scale);
		}
		if (this.blend) {
			ctx.globalCompositeOperation = this.blend;
		} else {
			ctx.globalCompositeOperation = "normal";
		}
		for (var i = 0; i < this.behaviors.length; i++) {
			this.behaviors[i].transform(ctx);
		}
		ctx.translate(-this.x, -this.y);
		ctx.globalAlpha = this.opacity;
		this.onDraw(ctx);

		ctx.globalAlpha = 1;
		ctx.restore();
		for (var i = 0; i < this.behaviors.length; i++) {
			this.behaviors[i].drawAfter(ctx);
		}
		this.drawDebug(ctx);
	},
	drawDebug: function (ctx) {
		return
	},
	onDraw: function (ctx) {
		ctx.fillStyle = this.color || "black";
		ctx.fillRect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
	},
	setVertices: function (vertices) {
		if (vertices) {
			this.vertices = vertices.map( function (v) {
				var _d = Math.sqrt(Math.pow(v.x, 2) + Math.pow(v.y, 2));
				var _theta = Math.atan2(v.y, v.x);
				return {d: _d, theta: _theta}
			});
		} else {
			var d = Math.sqrt(Math.pow(this.w, 2) + Math.pow(this.h, 2)) / 2;
			var th = Math.acos(0.5 * this.w / d);
			this.vertices = [
				{d: d, theta: th},
				{d: d, theta: Math.PI - th},
				{d: d, theta: Math.PI + th},
				{d: d, theta: 2 * Math.PI - th}
			];
		}
	},
	offsetVertices: function () {
		for (var i = 0; i < this.vertices.length; i++) {
			this.vertices[i].x += this.offset.x;
			this.vertices[i].y += this.offset.y;
		}
	},
	setCollision: function (collision) {
		this.collision = Object.create(collision);
		this.collision.onStart(this);
	},
	addBehavior: function (name, config) {
		var b = Object.create(name).init(this, config);
		this.behaviors.push(b);
		return b;
	},
	removeBehavior: function (obj) {
    if (obj) {
      var i = this.behaviors.indexOf(obj);    
      obj.end();
      this.behaviors.splice(i, 1);      
    }
	},
	start: function () {
		for (var i = 0; i < this.behaviors.length; i++) {
			this.behaviors[i].start();
		}
	},
	end: function () {
		for (var i = 0; i < this.behaviors.length; i++) {
			this.behaviors[i].end();
		}
	},
//	checkCollision: function (obj) { return false },
	checkCollisions: function (start, entities) { 
		if (!this.collision) return;
		for (var i = start; i < entities.length; i++) {
			if (this == entities[i]) {}
			else {
				if (this.collision.onCheck(this, entities[i])) {
					this.collision.onHandle(this, entities[i]);
					entities[i].collision.onHandle(entities[i], this);
				}
			}
		}
	},
//	handleCollision: function ( other ) {
//	},
	update: function (dt) {
		for (var i = 0; i < this.behaviors.length; i++) {
			this.behaviors[i].update(dt);
		}
//		this.x += dt * this.velocity.x;
//		this.y += dt * this.velocity.y;
	}
};

var Circle =Object.create(Entity);
Circle.init = function(x, y, radius) {
	this.instance();
	this.x = x, this.y = y, this.radius = radius;
	return this;
};
Circle.onDraw = function (ctx) {
	ctx.moveTo(this.x, this.y);
	ctx.beginPath();
	ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, true);
	ctx.fillStyle = this.color;
	ctx.fill();
};

var Sprite = Object.create(Entity);
Sprite.acceleration = {x: 0, y: 0};
Sprite.init = function (x, y, sprite) {
	this.x = x;
	this.y = y;
	this.instance();
	this.offset = {x: 0, y: 0};
	//this.checkCollision = Collision.doPixelPerfect;
	if (sprite) {
		if (sprite.speed) this.addBehavior(Animate);
		this.sprite = sprite, this.sprite.w = this.sprite.image.width / this.sprite.frames;
		this.animations = sprite.animations, this.animation = 0, this.sprite.h = this.sprite.image.height / this.animations;
		this.h = this.sprite.h, this.w = this.sprite.image.width / this.sprite.frames;
		this.frame = 0, this.maxFrame = this.sprite.frames, this.frameDelay = this.sprite.speed, this.maxFrameDelay = this.sprite.speed;
	}
	return this;
};
Sprite.onDraw = function (ctx) {
	ctx.drawImage(this.sprite.image, 
		this.frame * this.sprite.w, this.animation * this.sprite.h, 
		this.sprite.w, this.sprite.h, 
		Math.round(this.x - this.w / 2), this.y - Math.round(this.h / 2), this.w, this.h);
};
Sprite.drawDebug = function (ctx) {
	if (DEBUG) {
		ctx.strokeStyle = "red";
		if (this.getVertices) {
			var v = this.getVertices();
			ctx.beginPath();
			ctx.moveTo(v[0].x, v[0].y);
			for (var i = 1; i < v.length; i++) {
				ctx.lineTo(v[i].x, v[i].y);
			}
			ctx.closePath();
			ctx.stroke();

			var a = this.getAxes();
			ctx.strokeStyle = "green";
			ctx.beginPath();
			for (var i = 0; i < a.length; i++) {
				ctx.moveTo(this.x + a[i].x, this.y + a[i].y);
				ctx.lineTo(100 * a[i].x + this.x, 100 * a[i].y + this.y);
			}
			ctx.closePath();
			ctx.stroke();
		}
		ctx.fillStyle = "red";
		ctx.fillText(Math.floor(this.x) + ", " + Math.floor(this.y), this.x, this.y);

		ctx.beginPath();
		ctx.moveTo(this.x, this.y);
		ctx.strokeStyle = "blue";
		ctx.lineTo(this.x + 200 * Math.cos(this.angle), this.y + 200 * Math.sin(this.angle));
		ctx.stroke();
	}
}
Sprite.setFrame = function (frame) {
	if (frame == "random") {
		this.frame = Math.floor(Math.random() * this.maxFrame);
	} else {
		this.frame = frame;
	}
};

var TiledBackground = Object.create(Sprite);
TiledBackground.superInit = Sprite.init;
TiledBackground.init = function (x, y, w, h, sprite) {
	this.instance();
	if (sprite) {
		// FIX ME: add multiple animations (see PLATFORMS code)
		this.sprite = sprite, this.sprite.h = this.sprite.image.height, this.sprite.w = this.sprite.image.width / this.sprite.frames;
		this.h = this.sprite.image.height, this.w = this.sprite.image.width / this.sprite.frames;
		this.frame = 0, this.maxFrame = this.sprite.frames, this.frameDelay = this.sprite.speed, this.maxFrameDelay = this.sprite.speed;
		//this.imageData = this.getImageData(buf);
	}
	this.x = x, this.y = y;
  this.w = w, this.h = h;
  this.behaviors = [];
	return this;
};
TiledBackground.onDraw = function (ctx) {
	if (!this.pattern) {
		this.pattern = ctx.createPattern(this.sprite.image,"repeat");
  }
	ctx.fillStyle = this.pattern;
  ctx.translate((this.x - this.w / 2), (this.y - this.h / 2));
  ctx.fillRect(0, 0, this.w, this.h);
  ctx.translate(-(this.x - this.w / 2), -(this.y - this.h / 2));
};

var Camera = Object.create(Entity);
Camera.to_s = "Camera";
Camera.scale = 1;
Camera.draw = function (ctx) {
	ctx.translate(-this.x,-this.y);
  ctx.scale(this.scale, this.scale);
};
Camera.shake = function (n) {
	if (n == 0) {
		this.x =  Math.floor(world.player.x - canvas.width/2), 
		this.y =  0;
		return;
	}
	var c = this;
	setTimeout(function () {
		c.x += Math.random() * 10 - 5;
		c.y += Math.random() * 10 - 5;
		c.shake(n - 1);
	}, 10)
};

var Text = Object.create(Entity);
Text.type = "text";
Text.z = -1;
Text.init = function (x, y, text, format) {
	this.instance();
	this.x = x, this.y = y, this.text = text;
	this.size = format.size || 40;
	this.color = format.color || "black";
	this.align = format.align || "center";
	this.behaviors = [];
	return this;
};
Text.update = function (dt) {
	for (var i = 0; i < this.behaviors.length; i++) {
		this.behaviors[i].update(dt);
	}
};
Text.onDraw = function (ctx) {
	ctx.textAlign = this.align;
	ctx.fillStyle = this.color;
	ctx.font = "900 " + this.size + "px " + "Visitor";
	ctx.fillText(this.text, this.x, this.y);
};

var SpriteFont = Object.create(Sprite);
SpriteFont.characters = ['!', '"', '#', '$', '%', '&', '\'', '(', ')', '*', '+', ',', '-', '.', '/', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ';', '<', '=', '>', '?', '@', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '[', '\\', ']', '^', '_', '`', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p',  'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '{', '|', '}', '~', 'ƒ'];
SpriteFont.oldInit = SpriteFont.init;
SpriteFont.init = function (x, y, sprite, text, options) {
	this.instance();
  this.oldInit(x, y, sprite);
  this.text = text;
  this.align = options.align || "left";
  this.spacing = options.spacing || 0;
  return this;
}
SpriteFont.getX = function (n) {
  if (this.align == "center") {
    return this.w * (n - this.text.length / 2) - this.spacing * this.text.length / 2;
  } else if (this.align == "left") {
    return this.w * n;
  } else if (this.align == "right") {
    return this.w * (n - this.text.length);
  }
}
SpriteFont.draw = Sprite.draw;
SpriteFont.onDraw = function (ctx) {
  for (var i = 0; i < this.text.length; i++) {
    var c = this.characters.indexOf(this.text[i]);
    var x = this.getX(i);
    if (c != -1) {
      ctx.drawImage(this.sprite.image, 
        c * this.sprite.w, 0, 
        this.sprite.w, this.sprite.h, 
        Math.round(this.x - this.w / 2) + x + this.spacing * i, this.y - Math.round(this.h / 2), this.w, this.h);          
    }
  }
};

var TileMap = Object.create(Sprite);
TileMap.oldInit = Sprite.init;
TileMap.init = function(x, y, sprite, map) {
	this.instance()
	this.oldInit(x, y, sprite);
  this.map = map;
  this.w = this.map.length * this.sprite.w;
  this.h = this.map[0].length * this.sprite.h;
  return this;
}
TileMap.onDraw = function (ctx) {
	//ctx.fillRect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
	for (var i = 0; i < this.map.length; i++) {
  	for (var j = 0; j < this.map[i].length; j++) {
    	ctx.drawImage(this.sprite.image,
        this.map[i][j].x * this.sprite.w, this.map[i][j].y * this.sprite.h, 
        this.sprite.w, this.sprite.h, 
        Math.round(this.x - this.w / 2 + i * this.sprite.w), this.y - Math.round(this.h / 2) + j * this.sprite.h, this.sprite.w, this.sprite.h);
    }
  }
}

// from Tiled map editor
var TiledMap = Object.create(Sprite);
TiledMap.oldInit = Sprite.init;
TiledMap.init = function (x, y, sprite, data) {
	this.instance();
	this.oldInit(x, y, sprite);
	this.data = data;
	this.w = this.data.width * this.sprite.w;
	this.h = this.data.height * this.sprite.h;
	return this;
};
TiledMap.onDraw = function (ctx) {
	for (var i = 0; i < this.data.width; i++) {
		for (var j = 0; j < this.data.height; j++) {
			var d = this.data.data[i + j * this.data.width];
			if (d !== 0) {
				d = d - 1;
				ctx.drawImage(this.sprite.image, this.sprite.w * (d % this.sprite.frames), this.sprite.h * Math.floor(d / this.sprite.frames), this.sprite.w, this.sprite.h,
					Math.round(this.x - this.w / 2 + i * this.sprite.w), this.y - Math.round(this.h / 2) + j * this.sprite.h, this.sprite.w, this.sprite.h);				
			}
		}
	}
};

var mapping = ["a", "b", "x", "y", "lb", "rb", "lt", "rt", "back", "start", "ls", "rs", "dup", "ddown", "dleft", "dright"];

var GamepadButton = {
	init: function (name, gamepad) {
  	this.active = false;
    this.duration = 0;
    this.name = name;
    this.gamepad = gamepad;
    return this;
  },
  update: function (dt) {
  	this.duration += dt;
    if (this.onUpdate) this.onUpdate(dt);
  },
  start: function () {
  	this.active = true;
    if (this.onStart) this.onStart();
  },
  end: function () {
  	this.active = false;
    this.duration = 0;
    if (this.onEnd) this.onEnd();
  }
}

var Axis = {
	init: function (name, gamepad) {
  	this.x = 0;
    this.y = 0;
    this.name = name;
    this.gamepad = gamepad;
    return this;
  },
  update: function (dt, x, y) {
  	this.x = x;
    this.y = y;
    if (this.onUpdate) this.onUpdate(dt);
  }
}

var Gamepad = {
	init: function () {
  	this.buttons = {}
    for (var i = 0; i < mapping.length; i++) {
    	this.buttons[mapping[i]] = Object.create(GamepadButton).init(mapping[i], this);   
    }
    this.aleft = Object.create(Axis).init('aleft', this);
    this.aright = Object.create(Axis).init('aright', this);
    return this;
  },
  update: function (dt) {
    if (!navigator.getGamepads) return;
  	var gp = navigator.getGamepads();
    for (var i = 0; i < gp.length; i++) {
    	var pad = gp[i];
      if (pad) {
      	for (var j = 0; j < pad.buttons.length; j++) {
        	var b = this.buttons[mapping[j]];
          if (!b) {}
        	else if (pad.buttons[j].pressed) {
          	if (b.active) b.update(dt);
            else b.start();
          } else {
          		if (b.active) b.end();
          }
        }
        this.aleft.update(dt, pad.axes[0], pad.axes[1]);
        this.aright.update(dt, pad.axes[2], pad.axes[3]);
      }
    }
  }
}

//var myGamePad = Object.create(Gamepad).init();
//https://jsfiddle.net/littlegustv/k1jb2qba/5/

var Layer = {
  init: function (w, h, camera) {
    this.paused = 0, this.active = true;
    if (camera) {
      this.camera = camera;
    } else {
      this.camera = Object.create(Camera).init(0,0);
    }
    this.bg = "white";
    this.entities = [];
    this.canvas = document.createElement('canvas');
    this.canvas.width = w, this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d');    
    // is all of this neccessary?
    this.ctx.mozImageSmoothingEnabled = false;
    this.ctx.webkitImageSmoothingEnabled = false;
    this.ctx.msImageSmoothingEnabled = false;
    this.ctx.imageSmoothingEnabled = false;

    this.canvas.style.imageRendering = "optimizeSpeed";
    this.canvas.style.imageRendering = "-moz-crisp-edges";
    this.canvas.style.imageRendering = "-webkit-optimize-contrast";
    this.canvas.style.imageRendering = "-o-crisp-edges";
    this.canvas.style.imageRendering = "pixelated";
    this.canvas.style.msInterpolationMode = "nearest-neighbor";
    return this;
  },
  add: function (e) {
    e.layer = this;
    this.entities.push(e);
    return e;
  },
  remove: function (e) {
    var index = this.entities.indexOf(e);
    if (e != -1) {
      this.entities.splice(index, 1);
    }
  },
  drawOrder: function () {
    var t = this;
    return this.entities.sort(function (a, b) { 
      if (a.z && b.z && b.z !== a.z) return a.z - b.z;
      else return t.entities.indexOf(a) - t.entities.indexOf(b);
    });
  },
  draw: function (ctx) {
    //this.ctx.fillStyle = this.bg;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.camera.draw(this.ctx);

    if (this.drawOrder) {
      var entities = this.drawOrder();
    } else {
      var entities = this.entities;
    }

    for (var i = 0; i < entities.length; i++) {
      entities[i].draw(this.ctx);
    }
    this.ctx.restore();
  },
  onButton: function (x, y) {
    for (var i = 0; i < this.entities.length; i++) {
      if (this.entities[i].family == 'button') {
        var e = this.entities[i];
        if (x >= e.x - e.w/2 && x <= e.x + e.w/2 && y >= e.y - e.h/2 && y <= e.y + e.h/2) {
          return e;
        }
      }
    }
  },
  update: function (dt) {
    this.camera.update(dt);
    if (this.paused === true) {
      return;
    } else if (this.paused > 0) {
      this.paused -= dt;
      return;
    }
    for (var i = 0; i < this.entities.length; i++) {
      this.entities[i].update(dt);
    }
    for (var i = 0; i < this.entities.length; i++) {
      this.entities[i].checkCollisions(i + 1, this.entities); // i + 1 instead of i
    }
    for (var i = 0; i < this.entities.length; i++) {
      if (!this.entities[i].alive) {
        this.entities[i].end();
        delete this.entities[i];
        this.entities.splice(i, 1);
      }
    }
  }
};

var Particles = Object.create(Entity);
Particles.init = function (x, y, createParticle, rate, max, random) {
  this.behaviors = [];
  this.particles = [];
  this.x = x, this.y = y, this.createParticle = createParticle;
  this.rate = rate, this.max = max || 0, this.random = random || 1;
  this.time = 0;
  this.count = 0;
  this.offset = {x: 0, y: 0};
  return this;
}
Particles.update = function (dt) {
  this.time += dt;
  if (this.max !== 0 && this.count > this.max ) {
    if (this.particles.length <= 0) this.alive = false;
  }
  else if (this.time > this.rate && Math.random() <= this.random) {
    var p = this.createParticle(this.x + this.offset.x, this.y + this.offset.y);
    if (p) {
      this.particles.push(p);
      this.count += 1;
      this.time = 0;
    }
  }
  for (var i = 0; i < this.particles.length; i++) {
    this.particles[i].update(dt);
  }
  for (var i = 0; i < this.particles.length; i++) {
    if (!this.particles[i].alive) {
      this.particles.splice(i, 1);
    }
  }
  for (var i = 0; i < this.behaviors.length; i++) {
    this.behaviors[i].update(dt);
  }
}
Particles.onDraw = function (ctx) {
  for (var i = 0; i < this.particles.length; i++) {
    this.particles[i].draw(ctx);
  }
}

var Scene = {
	resourceCount: 1,
	resourceLoadCount: 0,
	init: function (name, file) {
		this.time = 0;
		this.name = name;
		this.layers = [];
		if (file) {
			this.loadBehavior(this.name + ".js");
		}
		return this;
	},
	onStart: function () {},
	onUpdate: function () {},
	onEnd: function () {},
	addLayer: function (layer) {
		this.layers.push(layer);
		return layer;
	},
	add: function (e) {
		if (this.layers.length <= 0) console.log('this scene has no layers.');
		else {
			var layer = e.layer || this.layers[0];
			layer.add(e);
		}
		return e;
	},
	remove: function (e) {
		if (this.layers.length <= 0) console.log('this scene has no layers.');
		else {
			var layer = e.layer || this.layers[0];
			layer.remove(e);
		}
	},
	loadProgress: function () {
		this.resourceLoadCount += 1;
		if (this.resourceLoadCount >= this.resourceCount) {
			this.ready = true;
			//this.onStart();
		}
	},
	loadBehavior: function (script) {
    var s = document.createElement("script");
    s.type = "text/javascript";
    s.src = "scenes/" + script;
    s.id = this.name;

    var old = document.getElementById(this.name);
    if (old) {
      old.parentElement.removeChild(old);
    }
    document.body.appendChild(s);

    // FIX ME: cross browser support
    var t = this;
    s.onload = function () {
      t.onStart = onStart;
      t.onUpdate = onUpdate;
      t.onEnd = onEnd;
      t.onDraw = onDraw;
      t.onStart();
      t.ready = true;
      //t.loadProgress();
    };
  },
	draw: function (ctx) {
    for (var i = 0; i < this.layers.length; i++) {
      if (this.layers[i].active)
      {
        this.layers[i].draw(ctx);
        ctx.drawImage(this.layers[i].canvas, 0, 0);
      }
    }
  },
	update: function (dt) {
    this.time += dt;
    for (var i = 0; i < this.layers.length; i++) {
      if (this.layers[i].active)
        this.layers[i].update(dt);
    }
    this.onUpdate(dt);
  }
};

var onStart = function () {

  var fg_camera = Object.create(Camera).init(0, 0);

  var fg = Object.create(Layer).init(fg_camera);
  this.layers.push(fg);

  this.onKeyDown = function (e) {
    e.preventDefault();
    return false;
  }

};

var onUpdate = function (dt) {
};

var onEnd = function () {
};

var onDraw = function (ctx) {
};

var AudioContext = window.AudioContext || window.webkitAudioContext;

// creates window
var World = {
  events: ["onClick", "onMouseMove", "onMouseDown", "onMouseUp", "onKeyDown", "onKeyUp", "onKeyPress", "onTouchStart", "onTouchEnd", "onTouchCancel", "onTouchMove"],
  init: function (width, height, gameinfo) {
    this.height = height, this.width = width;
    var t = this;
    this.scenes = [];
    this.time = 0;
    this.speed = 1;
    this.scene = undefined;
    this.paused = false;
    this.muted = false;
    // does this work for JSFIDDLE?  I don't think it does!
    window.addEventListener('DOMContentLoaded', function (e) {
      if (gameinfo) {
        t.loadGameInfo(gameinfo);
      } else {
        t.createCanvas();
        t.createDebug();
        t.start();
      }
    });
    return this;
  },
  start: function () {
    this.beginTime();
    this.step();
    if (!this.gameInfo) {
      this.scene.onStart();      
    }
  },
  step: function () {
    var t = this;
    if (this.paused) {
      window.requestAnimationFrame( function () { t.step() });
      return;
    }
    var newTime = new Date();
    var dt = this.speed * ( newTime - this.startTime ) / 1000;
    this.startTime = newTime;

    this.time += dt;
    if (this.time > 1) {
      if (DEBUG) this.debug.style.display = "block";
      else this.debug.style.display = "none";
      this.time = 0;
      this.debug.innerHTML = Math.floor(1 / dt) + " fps";
    }

    this.update(dt);
    this.draw();

    window.requestAnimationFrame(function() { t.step() });
  },
  resizeCanvas: function () {
    this.canvas.style.width = "", this.canvas.style.height = "";
    var ratio = this.canvas.width / this.canvas.height;
    // wider
    if (window.innerWidth / window.innerHeight > ratio)
    {
      this.canvas.style.height = window.innerHeight + "px";
      var scale = window.innerHeight / this.canvas.height;
    } else {
      this.canvas.style.width = window.innerWidth + "px";
      var scale = window.innerWidth / this.canvas.width;
    }
    this.scale = scale;
  },
  filterEvent: function (event) {
    var w = this;
    return {
      x: event.offsetX / this.scale, 
      y: event.offsetY / this.scale, 
      keyCode: event.keyCode, 
      touch: event.changedTouches && event.changedTouches.length > 0 ? {x: event.changedTouches[0].pageX / w.scale, y: event.changedTouches[0].pageY / w.scale} : {}
    };
  },
  createCanvas: function () {
    this.canvas = document.createElement("canvas");
    this.canvas.height = this.height, this.canvas.width = this.width;
    if (this.gameInfo && this.gameInfo.scale) {
      this.canvas.style.height = this.gameInfo.scale * this.height + "px";
      this.canvas.style.width = this.gameInfo.scale * this.width + "px";
    }
    document.body.appendChild(this.canvas);
    //this.canvas.fullscreenElement ();
    this.ctx = this.canvas.getContext("2d");
    
    this.ctx.mozImageSmoothingEnabled = false;
    this.ctx.webkitImageSmoothingEnabled = false;
    this.ctx.msImageSmoothingEnabled = false;
    this.ctx.imageSmoothingEnabled = false;

    this.canvas.style.imageRendering = "optimizeSpeed";
    this.canvas.style.imageRendering = "-moz-crisp-edges";
    this.canvas.style.imageRendering = "-webkit-optimize-contrast";
    this.canvas.style.imageRendering = "-o-crisp-edges";
    this.canvas.style.imageRendering = "pixelated";
    this.canvas.style.msInterpolationMode = "nearest-neighbor";
    this.resizeCanvas();
    var w = this;
		window.addEventListener('resize', function () { 
			w.resizeCanvas(); 
		});
  },
  createDebug: function () {
    this.debug = document.createElement("div");
    this.debug.setAttribute("class", "debug");
    document.body.appendChild(this.debug);
  },
  update: function (dt) {
    debug.fps = Math.floor(100 / dt) / 100;
    if (this.scene) {
      this.scene.update(dt);
    }
  },
  draw: function () {
    // it is up to the individual scenes to 'clear' or not
    if (this.scene) {
      this.scene.draw(this.ctx);
    }
  },
  progressBar: function () {
    var n = Math.floor((this.width - 50) / this.resourceCount);
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(25 + this.resourceLoadCount * n, this.height / 2 - 12, n, 25);
    this.resourceLoadCount += 1;
    var t = this;
    if (this.resourceLoadCount >= this.resourceCount) {
      this.loadScenes();
      this.setScene(0);
      if (this.scene) {
        setTimeout( function () {
          t.start();
        }, 100);
      } else {
      }
    }
  },
  beginTime: function () {
    this.startTime = new Date();
    var t = this;
    document.addEventListener("visibilitychange", function (e) { 
      t.startTime = new Date(); 
    });
  },
  loadGameInfo: function (gameinfo) {
    var request = new XMLHttpRequest();
    request.open("GET", gameinfo, true);
    var w = this;
    console.log('loading game info');
    request.onload = function (data) {
      w.gameInfo = JSON.parse(request.response);
      w.createCanvas();
      console.log('loaded', w.gameInfo);
      w.createDebug(); 
      w.loadResources();
    };
    request.send();        
  },
  loadScenes: function () {
    // scene data is just the name of the scenes, which implies their script file name
    var sceneData = this.gameInfo.scenes;
    for (var i = 0; i < sceneData.length; i++) {
      var sceneName = sceneData[i].name;
      //var s = Object.create(Scene).init(sceneName, true);
      //s.reload = sceneData[i].reload || false;
      //this.scenes.push(s);
      this.scenes.push(sceneData[i]);
    }
  },
  setScene: function (n, reload) {
    if (this.scenes[n].reload || reload === true) {
      console.log('reloading, supposedly');
      this.scenes[n] = Object.create(Scene).init(this.scenes[n].name, true);
    }
    this.removeEventListeners(this.scene);
    this.scene = this.scenes[n];
    this.addEventListeners(this.scene);
  },
  removeEventListeners: function (scene) {
    if (scene && scene.ready) {
      for (var i = 0; i < this.events.length; i++) {
        var event = this.events[i];
        if (this[event]) {
          if (event.substr(0,5) == "onKey") {
            document.removeEventListener(event.toLowerCase().substr(2,event.length - 2), this[event]);
          } else {            
            this.canvas.removeEventListener(event.toLowerCase().substr(2,event.length - 2), this[event]);
          } 
        }
      }
    }
  },
  addEventListeners: function (scene) {
    var w = this;
    if (scene.ready) {
      for (var i = 0; i < this.events.length; i++) {
      // interesting : to create a unique var scope, wrap this in a function - a closure, perhaps?
        (function () {
        var event = w.events[i];
        if (scene[event]) {
          //w[event] = scene[event];
          w[event] = function (e) {
            e.preventDefault();
            scene[event](w.filterEvent(e));
            return false;
          };
          if (event.substr(0,5) == "onKey") {
            document.addEventListener(event.toLowerCase().substr(2,event.length - 2), w[event]);
          } else {            
            w.canvas.addEventListener(event.toLowerCase().substr(2,event.length - 2), w[event]);
          }
        }
        })();
      }
    } else {
      var t = this;
      // fix me: is there maybe a more elegant way of checking whether the scene is loaded?
      setTimeout(function () { t.addEventListeners(scene); }, 10);
    }
  },
  initAudio: function () {
    var a = new Audio();
    this.audioType = a.canPlayType("audio/ogg");

    if (AudioContext) AudioContext.createGain = AudioContext.createGain || AudioContext.createGainNode;

    if (AudioContext) {
      this.audioContext = new AudioContext();
      this.audioContext.gn = this.audioContext.createGain();
    }
    var t = this;
    window.addEventListener("focus", function (e) {
      if (t.audioContext && t.audioContext.resume && !this.muted) t.audioContext.resume();
      t.startTime = new Date();
      t.speed = 1;
    });
    window.addEventListener("blur", function (e) {
      if (t.audioContext && t.audioContext.suspend) t.audioContext.suspend();
      t.speed = 0;
    });
  },
  /* FIX ME: loads image, sound and data assets into global Resources array -> is there a better place to do this? */
  loadResources: function () {
    if (!this.gameInfo.resources) return;
    //this.setupControls();
    this.initAudio();

    this.resourceLoadCount = 0;
    this.resourceCount = this.gameInfo.resources.length;
    this.ctx.fillStyle = "pink";
    this.ctx.textAlign = "center";	
    this.ctx.fillRect(this.width / 2 - 25 * this.resourceCount + i * 50, this.height / 2 - 12, 50, 25);      
    this.ctx.fillText("loading...", this.width / 2, this.height / 2 - 50);
    var w = this;

    for (var i = 0; i < this.gameInfo.resources.length; i++ ) {
      var res = this.gameInfo.resources[i].path;
      var e = res.indexOf(".");
      var name = res.substring(0, e);
      var ext = res.substring(e, res.length);
      if (ext == ".png") {
        Resources[name] = {image: new Image(), frames: this.gameInfo.resources[i].frames || 1, speed: this.gameInfo.resources[i].speed || 1, animations: this.gameInfo.resources[i].animations || 1 };
        Resources[name].image.src = "res/" + res;
        Resources[name].image.onload = function () {
          w.progressBar();
        }
      }
      else if (ext == ".ogg") {
        this.loadOGG(res, name);
/*        Resources[name] = {sound: new Audio("res/" + res, streaming=false)};
        w.progressBar();
        Resources[name].sound.onload = function () {
          console.log("loaded sound");
        }*/
      }
      else if (ext == ".wav") {
        this.loadOGG(res, name);
      }
      else if (ext == ".js") {
        var request = new XMLHttpRequest();
        request.open("GET", "res/" + res, true);
        request.onload = function () {
          w.sceneInfo = request.response;
          w.progressBar();
        };
        request.send();
      }
      else if (ext == ".json") {
        var request = new XMLHttpRequest();
        request.open("GET", "res/" + res, true);
        request.onload = function () {
          Resources[name] = JSON.parse(request.response);
          w.progressBar();
        };
        request.send();
      }
    }
  },
  loadOGG: function (res, name) {
    var w = this;
    // cant play ogg, load mp3
    /*if (name == "soundtrack" || name == "soundtrackFast") {
      this.progressBar();
    }*/
    if (this.audioType.length <= 0) {
      res = res.replace("ogg", "mp3");
      //console.log("replaced?");
    }
    //console.log("NEW", res);
    if (!AudioContext) {
      Resources[name] = new Audio("res/" + res, streaming=false);
      //Resources[name].src = "res/" + res;
      w.progressBar();
      return;
    }
    var request = new XMLHttpRequest();
    request.open('GET', "res/" + res, true);
    request.responseType = 'arraybuffer';

    var w = this;
    request.onload = function() {
      w.audioContext.decodeAudioData(request.response, function(b) {
        Resources[name] = {buffer: b, play: false};
        if (false) { //(name == "soundtrack" || name == "soundtrackFast") {
//          if (AudioContext && Resources.soundtrack && name == "soundtrack") w.musicLoop();
        } else {
          w.progressBar();
        }
      }, function () {console.log("ERROR with decoding audio");});
    };
    request.send();
  },
  playSound: function(sound, volume)
  {
    if (AudioContext) {
      var volume = volume || 1;
      //console.log(sound);
      var buffer = sound.buffer;
      var source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      
      source.connect(this.audioContext.gn);
      //this.audioContext.gn.gain.value = volume;
      this.audioContext.gn.connect(this.audioContext.destination);
      source.start(0);
      
      return source;
    } else {
      if (window.muted) {
        return;
      }
      else {
        sound.play();
        debug = sound;
        return sound;
      }
    }
  }
};
