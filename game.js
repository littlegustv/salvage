/* global Resources, Entity, Sprite, SpriteFont, TiledBackground, Behavior, World, randint, clamp, between */
// canvas filter (color style); grayscale(70%) contrast(250%) brightness(90%);

var VERSION = "0.2.2";

var MODES = {
  keyboard: 0,
  touch: 1,
  //gamepad: 2,
  mouse: 3
};
var MODE = undefined;
//var GAMEPAD = undefined;

var directions = {
  39: 0,
  40: PI / 2,
  37: PI,
  38: 3 * PI / 2
};

var MAXHEALTH = 4, DAMAGE_COOLDOWN = 0.5;

var gameWorld = Object.create(World).init(640, 360, "index.json");
gameWorld.wave = 1;
gameWorld.ending = 0;

gameWorld.unmute = function () {
  if (localStorage) {
    localStorage.salvageMuted = false;
  }
  if (this.audioContext && this.audioContext.resume) {
    this.audioContext.resume();
  }
  this.muted = false;
  window.muted = false;
  this.playSound(Resources.select);
};

gameWorld.mute = function () {
  if (localStorage) {
    localStorage.salvageMuted = true;
  }
  if (this.audioContext && this.audioContext.suspend) {
    this.audioContext.suspend();
  }
  this.muted = true;
  window.muted = true;
};

var ENDINGS = [
	"Workplace Accident", // normal in-game death
	"Don't Forget Your Place", // failed insurrection
	"Social Mobility", // buy key
	"The Republic of Virtue", // buy key, still insurrection
	"Insurrection" // simple insurrection
];

function cardinal (angle) {
  return Math.round(modulo((angle + 4 * PI), PI2) / (PI / 2));
}

var TURN = 0.586 // the approximate time of a player turn
var WIDTH = 640;
var HEIGHT = 360;
var ARM_TIME = 0.1;
var TILESIZE = 48;
var MIN = {x: 40, y: 40};
var MAX = {x: MIN.x + TILESIZE * 12, y: MIN.y + TILESIZE * 6};
var SPEEDS = {
  gravity: 120,
  projectile_fast: 200,//100,
  projectile_normal: 160,//80,
  projectile_slow: 32, //40,
  player: 6.5, // each turn take 0.586 seconds...
  enemy_fast: 8,
  enemy_normal: 5.5,
  enemy_horizontal: 32,
  enemy_horizontal_fast: 128,
  enemy_horizontal_slow: 24
};

var COLORS = {
  negative: "#000000",
  primary: "#00bfff",//"#AA0000",
  button: "#00bfff", // used only in STORE now
};

function speechbubble(start, text) {
  var map = [];
  map.push([{x: 0, y: 0}, {x: 0, y: 2}]);
  for (var i = 0; i < text.text.length; i++) {
    map.push([{x: 1, y: 0}, {x: 1, y: 2}]);
  }
  map.push([{x: 2, y: 0}, {x: 2, y: 2}]);
  var bubble = text.layer.add(Object.create(TileMap).init(text.x, text.y, Resources.bubble, map));
  bubble.z = text.z - 1;
  bubble.opacity = 0;
  bubble.addBehavior(Follow, {target: text, offset: {x: false, y: false, z: false, alive: true}});
  bubble.addBehavior(FadeIn, {delay: 0.4, duration: 0.1, maxOpacity: 1});
  // fix me: need to calculate closest corner, then draw dots ONLY to there!
  var w = 16 * map.length;
  var y = start.y < text.y ? text.y - 16 : text.y + 16;
  if (start.x > text.x) {
    var corner = {x: text.x + w / 2, y: y};
  } else {
    var corner = {x: text.x - w / 2, y: y};
  }
  for (var i = 1; i < 4; i++) {
    var dot = gameWorld.scene.ui.add(Object.create(Sprite).init(start.x +  i * (corner.x - start.x) / 3, start.y + i * (corner.y - start.y) / 3, Resources.bubble));
    dot.behaviors = [];
    dot.animation = 3;
    dot.frame = 3 - i;
    dot.z = text.z - 2;
    dot.opacity = 0;
    dot.addBehavior(FadeIn, {duration: 0.1, delay: 0.1 * i, maxOpacity: 1});
    dot.addBehavior(Follow, {target: text, offset: {x: false, y: false, z: false, alive: true}});
  }
}

function notPlayer (e) { // used to avoid spawning enemies on player position
  return !(e.x === gameWorld.player.x && e.y === gameWorld.player.y);
}

function shuffle () { // general utility function (for SORT)
  return 0.5 - Math.random();
}

var spawnPoints = function () { // generate free 'points' for spawning algorithm
  //console.log('spawn points');  
  return {
    sky: Array(11).fill(1).map(function (e, index) { return toGrid(MIN.x + TILESIZE * index, MIN.y) }).filter(notPlayer).sort(shuffle),
    wall: Array(6).fill(1).map(function (e, index) { return toGrid(MAX.x, MIN.y + TILESIZE * index) }).filter(notPlayer).sort(shuffle),
    air: Array(10 * 4).fill(1).map(function (e, index) { return toGrid(MIN.x + TILESIZE * (1 + index % 10), MIN.y + (1 + Math.floor(index / 10)) * TILESIZE); }).filter(notPlayer).sort(shuffle),
    ground: Array(11).fill(1).map(function (e, index) { return toGrid(MIN.x + TILESIZE * index, MAX.y) }).filter(notPlayer).sort(shuffle)
    // all points from x >= 1, 1 >= y <= 5
  };
};

var bossSpawnPoints = function () {
  //console.log('boss spawn points');
  return {
    sky: Array(11).fill(1).map(function (e, index) { return toGrid(MIN.x + TILESIZE * (index + 1), MIN.y) }).filter(notPlayer).sort(function (a, b) { return b.x - a.x; }),
    wall: Array(4).fill(1).map(function(e, index) { return toGrid(MIN.x, MIN.y + (index < 2 ? index * TILESIZE : (index + 3) * TILESIZE)) }).filter(notPlayer).sort(shuffle),
    air: Array(10 * 4).fill(1).map(function (e, index) { return toGrid(MIN.x + TILESIZE * (1 + index % 10), MIN.y + (1 + Math.floor(index / 10)) * TILESIZE); }).filter(notPlayer).sort(function (a, b) {
      return b.x - a.x;
    }),
    ground: Array(11).fill(1).map(function (e, index) { return toGrid(MIN.x + TILESIZE * (index + 1), MAX.y) }).filter(notPlayer).sort(function (a, b) { return b.x - a.x; })
  };
};

// round to nearest grid position
function toGrid(x, y) {
  var g = {
    x: clamp(Math.round((x - MIN.x) / TILESIZE) * TILESIZE + MIN.x, MIN.x, MAX.x),
    y: clamp(Math.round((y - MIN.y) / TILESIZE) * TILESIZE + MIN.y, MIN.y, MAX.y)
  };
  if (gameWorld.player && gameWorld.player.hasFTL) {
    if (g.y == MAX.y || g.y == MAX.y - TILESIZE) { // at gate
      g.x = clamp(Math.round((x - MIN.x) / TILESIZE) * TILESIZE + MIN.x, MIN.x - 2 * TILESIZE, MAX.x);
    }
  }
  return g;
}

// convert from column/row coordinates to x and y
function fromGrid(i, j) {
  return {x: MIN.x + i * TILESIZE, y: MIN.y + j * TILESIZE}; 
}

// button effect adds [] to text
var bracketHover = function () {
  if (this.text.text.indexOf("[") === -1) {
    gameWorld.playSound(Resources.hover);
    this.text.text = "[ " + this.text.text + " ]";
  }
};
var bracketUnhover = function () {
  if (this.text && this.text.text.indexOf("[") !== -1) {
    this.text.text = this.text.text.slice(2, this.text.text.length - 2);
  }
};
// simple button effect
var buttonHover = function () {
  if (this.opacity != 0.6) gameWorld.playSound(Resources.hover);
  this.opacity = 0.6;
};
var buttonUnHover = function () { this.opacity = 1;};

var EASE = {
  linear: function (start, end, t) {
    return start + (end - start) * t;
  },
  easeInQuad: function (start, end, t) {
    return (end - start) * t * t + start;
  },
  easeOutQuad: function (start, end, t) {
    return -(end - start) *(t)*(t-2) + start;
  },
  easeOutBounce: function (start, end, t) {
    var c = end - start;
    if (t < (1/2.75)) {
      return c*(7.5625*t*t) + start;
    } else if (t < (2/2.75)) {
      return c*(7.5625*(t-=(1.5/2.75))*t + .75) + start;
    } else if (t < (2.5/2.75)) {
      return c*(7.5625*(t-=(2.25/2.75))*t + .9375) + start;
    } else {
      return c*(7.5625*(t-=(2.625/2.75))*t + .984375) + start;
    }
  }
}

// used for player 'shield' upgrade
var Shielded = Object.create(Behavior);
Shielded.update = function (dt) {
  if (this.entity.shield < 1) {
    this.entity.shield += dt * this.rate;
    if (this.entity.shield >= 1) {
      gameWorld.playSound(Resources.shield_up);
      var m = this.entity.layer.add(Object.create(SpriteFont).init(this.entity.x, this.entity.y, Resources.expire_font, "shields up!", {spacing: -2, align: "center"}));
      m.addBehavior(Velocity);
      m.scale = 2;
      m.addBehavior(FadeOut, {delay: 0.5, duration: 0.2});
      m.velocity = {x: 0, y: -30};
    }
  }
  else this.entity.shield = 1;
  this.entity.shield_sprite.opacity = this.entity.shield;
};

// camera shake
var Shake = Object.create(Behavior);
Shake.update = function (dt) {
  if (this.time === undefined) this.time = 0;
  this.time += dt;
  if (this.time >= this.duration) this.entity.removeBehavior(this);
  else {
    this.entity.x += randint(this.min, this.max) * dt;
    this.entity.y += randint(this.min, this.max) * dt;
  }
};

// series of movement functions...
var Move = Object.create(Behavior);
Move.move = function (dt) {
  this.entity.x = lerp(this.entity.x, this.goal.x, this.speed * dt);
  this.entity.y = lerp(this.entity.y, this.goal.y, this.speed * dt);
};
Move.check = function () {
  return Math.round(this.entity.x - this.goal.x) === 0 && Math.round(this.entity.y -  this.goal.y) === 0;
};
Move.update = function (dt) {
  if (this.goal) {
    this.move(dt);
    if (this.check()) {
      this.goal = undefined;
      this.entity.velocity = {x: 0, y: 0};
      if (this.callback) {
        this.delay = this.callback();
      } else {
        this.delay = this.duration;
      }
    }
  } else if (this.delay > 0) {
    this.delay -= dt;
  } else {
    this.goal = this.pick();
    if (this.turn) {
      this.entity.angle = angle(this.entity.x, this.entity.y, this.goal.x, this.goal.y);
    }
  }
};
Move.pick = function () {
  var x = randint(-1, 2);
  // don't go on 'boss' side
  if (this.entity.x <= MIN.x + TILESIZE) {
    x = choose([0, 1]);
  }
  return toGrid(this.entity.x + x * TILESIZE, x === 0 ? this.entity.y + choose([-1, 1]) * TILESIZE : this.entity.y);
};

// the boss doesn't move, but it is useful to have a defining behavior anyway?
var Boss = Object.create(Move);
Boss.update = function (dt) {
};
Boss.move = function (dt) {
};
// first collect the scrap, then pay money, then next wave
Boss.collect = function (scrap) {
  for (var i = 0; i < gameWorld.scene.layers.length; i++) {
    gameWorld.scene.layers[i].paused = false;
  }
  for (var i = 0; i < scrap.length; i++) {
    scrap[i].addBehavior(Lerp, {field: "x", rate: 2, goal: this.entity.x, object: scrap[i]});
    scrap[i].addBehavior(Lerp, {field: "y", rate: 2, goal: this.entity.y, object: scrap[i]});
  }
  var t = this;
  if (!this.entity.enemy) {    
    this.entity.addBehavior(Delay, {duration: 1, callback: function () {
      t.pay();
      this.entity.removeBehavior(this);
    }});
  } else {
    this.entity.addBehavior(Delay, {duration: 1, callback: function () {
      gameWorld.player.locked = false;    
      gameWorld.scene.pause();
      this.entity.removeBehavior(this);
    }});
  }
}
// FIX ME:add shield-opening animation
Boss.unshield = function () {

}

Boss.pay = function () {
  var t = this;

  gameWorld.player.buffer = undefined;

  // fix me: improve timing!!
  var pd = gameWorld.scene.ui.add(Object.create(SpriteFont).init(this.entity.x + 128, this.entity.y - 32, Resources.expire_font, "payday! +$1", {spacing: -1, align: "center"}));
  pd.z = 12;
  pd.scale = 2;
  speechbubble(gameWorld.boss, pd);
  gameWorld.playSound(Resources.coins);

  for (var i = 0; i < 6; i++) {
    this.entity.addBehavior(Delay, {duration: 0.4 + i * 0.1, callback: function () {
      var coin = this.entity.layer.add(Object.create(Sprite).init(this.entity.x, this.entity.y + randint(-48, 48), Resources.coin));   
      coin.z = 100;
      coin.addBehavior(Lerp, {field: "x", rate: 3, goal: gameWorld.width + 64, object: coin});
      coin.addBehavior(Lerp, {field: "y", rate: 3, goal: -6, object: coin});
      coin.addBehavior(Delay, {duration: 0.7, callback: function () {
        particles(this.entity, 4, 2);
        this.entity.alive = false;
      }});
      this.entity.removeBehavior(this);
     }});
  }

  pd.opacity = 0;
  pd.addBehavior(FadeIn, {delay: 0.5, duration: 0.1, maxOpacity: 1});
  pd.addBehavior(FadeOut, {delay: 2, duration: 0.1, maxOpacity: 1});

  pd.addBehavior(Delay, {duration: 1.5, callback: function () {
    gameWorld.playSound(Resources.coins);
    gameWorld.player.salvage += 1;
    gameWorld.earned += 1;
    gameWorld.player.cash_counter.text = "$ " + gameWorld.player.salvage;
    if (gameWorld.wave % 2 === 0 && ! gameWorld.boss.store_open) {
      t.storetime();
    } else {
      gameWorld.player.locked = false;    
      gameWorld.scene.pause();
    }
    this.entity.removeBehavior(this);
  }});
  
  this.callback = undefined;
};
Boss.storetime = function () {
  gameWorld.playSound(Resources.store);

  var pd = gameWorld.scene.ui.add(Object.create(SpriteFont).init(this.entity.x + 128, this.entity.y + 32, Resources.expire_font, "store open!", {spacing: -1, align: "center"}));
  pd.z = 12;
  pd.scale = 2;
  speechbubble(gameWorld.boss, pd);

  pd.addBehavior(FadeIn, {delay: 0.5, duration: 0.1, maxOpacity: 1});
  pd.opacity = 0;
  pd.addBehavior(FadeOut, {delay: 1, duration: 0.1, maxOpacity: 1});

  this.entity.store_open = this.entity.layer.add(Object.create(Entity).init(this.entity.x + TILESIZE, this.entity.y, 16, 16));

  this.entity.store_open.opacity = 0;
  this.entity.store_open.setCollision(Polygon);
  this.entity.store_offset = this.entity.store_open.addBehavior(Follow, {target: this.entity, offset: {x: TILESIZE, y: 0, angle: false, z: -2}}).offset;

  // fix me: store position!
  //var store_emphasis = this.entity.layer.add(Object.create(Circle).init(this.entity.x + TILESIZE, this.entity.y, TILESIZE / 4));
  var store_emphasis = this.entity.layer.add(Object.create(TiledBackground).init(this.entity.x + TILESIZE / 2, this.entity.y, 28, 1.5 * TILESIZE, Resources.store_highlight));
  store_emphasis.addBehavior(Follow, {target: this.entity.store_open, offset: {alive: true, z: 0.5, x: false, y: false}});
  //store_emphasis.addBehavior(Oscillate, {field: "radius", object: store_emphasis, initial: TILESIZE / 4, constant: 8, time: 0, func: "sin", rate: 3});

  var t1 = this.entity.layer.add(Object.create(SpriteFont).init(this.entity.x + 24, this.entity.y - 6, Resources.expire_font, "store", {spacing: -3, align: "center"}));
  var t2 = this.entity.layer.add(Object.create(SpriteFont).init(this.entity.x + 24, this.entity.y + 6, Resources.expire_font, "open", {spacing: -3, align: "center"}));
  var t3 = this.entity.layer.add(Object.create(SpriteFont).init(this.entity.x + 24, this.entity.y + 6, Resources.expire_font, "here!", {spacing: -3, align: "center"}));
  t1.addBehavior(Follow, {target: this.entity.store_open, offset: {x: 0, y: -16, alive: true, z: 1 }});
  t2.addBehavior(Follow, {target: this.entity.store_open, offset: {x: 0, y: 0, alive: true, z: 1 }});
  t3.addBehavior(Follow, {target: this.entity.store_open, offset: {x: 0, y: 16, alive: true, z: 1 }});
  t1.addBehavior(FadeIn, {maxOpacity: 1, duration: 0.3});
  t2.addBehavior(FadeIn, {maxOpacity: 1, duration: 0.3});
  t3.addBehavior(FadeIn, {maxOpacity: 1, duration: 0.3});
  t1.opacity = 0;
  t2.opacity = 0;
  t3.opacity = 0;
  this.callback = undefined;

  gameWorld.player.locked = false;    
  gameWorld.scene.pause();
  return 10;
};
Boss.shoot = function () {
  //return choose(this.weapons)(this.entity);
};
// picks from queue, or patrols from top to bottom
Boss.pick = function () {
  /*if (this.entity.health < this.entity.maxhealth - 1) {
    console.log('uhuh');
    this.callback = this.shoot;
  }
  if (this.entity.queue.length > 0) {
    if (this.entity.payday) {
      this.entity.payday = false;
      this.callback = this.pay;
    } else if (this.entity.storeday) {
      this.entity.storeday = false;
      this.callback = this.storetime;
    } else {
      this.callback = this.beam;
    }
    return f(this.entity.x, this.entity.queue.pop());
  } else {
    return toGrid(this.entity.x, this.entity.y > HEIGHT / 2 ? toGrid(0, 0).y : toGrid(0, HEIGHT).y);
  }*/
};

// moves at right angle in approaching "spiral" - ish
var Approach = Object.create(Move);
Approach.pick = function () {

  var me = toGrid(this.entity.x, this.entity.y);
  var you = toGrid(this.target.x, this.target.y);

  // if we are too close, move to the side
  var options = [{x: me.x + TILESIZE, y: me.y}, {x: me.x - TILESIZE, y: me.y}, {x: me.x, y: me.y + TILESIZE}, {x: me.x, y: me.y - TILESIZE}];
  options = options.filter(function (e) { return (e.x >= MIN.x + TILESIZE) && !(e.x === you.x && e.y === you.y); });
  console.log(options.length);
  options.sort(function (a, b) {
    return distance(a.x, a.y, you.x, you.y) - distance(b.x, b.y, you.x, you.y);
  });

  return options[0];
};

// hover - tries to stay above or below, staying vertically aligned - FIX ME: is this used - and could it be?
var Hover = Object.create(Move);
Hover.move = function (dt) {
  this.entity.velocity = {x: sign(this.goal.x - this.entity.x) * this.speed , y: sign(this.goal.y - this.entity.y) * this.speed };    
};
Hover.check = function () {
  return Math.abs(this.entity.x - this.goal.x) <= 2 && Math.abs(this.entity.y - this.goal.y) <= 2;
};
Hover.pick = function () {
  var e = toGrid(this.entity.x, this.entity.y);
  var t = toGrid(this.target.x, this.target.y);
  if (e.y === t.y) {
    return toGrid(this.entity.x, this.entity.y - TILESIZE > MIN.y ? this.entity.y - TILESIZE : this.entity.y + TILESIZE);
  } else {
    return toGrid(this.target.x, this.entity.y);
  }
};

// single-level (does not move vertically, just turns around when reaches the end - for GROUND movement, but also others maybe)
var Horizontal = Object.create(Hover);
Horizontal.move = function (dt) {
  this.entity.velocity = {x: sign(this.goal.x - this.entity.x) * this.speed , y: 0 };    
};
Horizontal.pick = function () {
  if (this.oldGoal) {
    var g = this.oldGoal;
    this.oldGoal = undefined;
    return g;
  }
  else if (this.entity.x > (this.min + this.max) / 2) return toGrid(this.min, this.entity.y);
  else return toGrid(this.max, this.entity.y);
};

Scene.draw = function (ctx) {
  ctx.clearRect(0, 0, gameWorld.width, gameWorld.height); // HERE!
  for (var i = 0; i < this.layers.length; i++) {
    if (this.layers[i].active)
    {
      this.layers[i].draw(ctx);
      ctx.drawImage(this.layers[i].canvas, 0, 0);
    }
  }
};

Scene.update = function (dt) {
  this.time += dt;
  for (var i = 0; i < this.layers.length; i++) {
    if (this.layers[i].active)
      this.layers[i].update(dt);
  }
  this.onUpdate(dt);
};

Layer.drawOrder = function () {
    var t = this;
    return this.entities.sort(function (a, b) {
      if (a.z < b.z) return -1;
      else if (a.z === b.z) {
        if (a.y < b.y) return -1;
        else if (a.y === b.y) {
          if (a.x < b.x) return -1;
          else return 1;
        }
        else return 1;
      }
      else return 1;
    });
};

Layer.update = function (dt) {
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
  /*for (var i = 0; i < this.entities.length; i++) {
    this.entities[i].checkCollisions(i + 1, this.entities); // i + 1 instead of i
  }*/
  for (var i = 0; i < this.entities.length; i++) {
    if (!this.entities[i].alive) {
      this.entities[i].end();
      delete this.entities[i];
      this.entities.splice(i, 1);
    }
  }
};

World.setScene = function (n, reload) {
  if (this.scenes[n].reload || reload === true) {
    console.log('reloading, supposedly');
    this.scenes[n] = Object.create(Scene).init(this.scenes[n].name, true);
  }
  this.removeEventListeners(this.scene);
  this.scene = this.scenes[n];
  this.addEventListeners(this.scene);
};

World.draw = function () {
  if (this.scene) {
    this.scene.draw(this.ctx);
  }
};

World.playSound = function(sound, volume) {
  if (AudioContext) {
    var volume = volume || 1;
    //console.log(sound);
    var buffer = sound.buffer;
    var source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    
    source.connect(this.audioContext.gn);
    this.audioContext.gn.gain.value = volume;
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
};

// this was a confused attempt to create a dual delay/periodic function - in the future, KEEP THEM SEPARATE!
Delay.update = function (dt) {
  if (this.time === undefined) this.start();
  
  this.time += dt;
  if (this.time > this.duration) {
    this.callback();
    this.time = undefined;
    if (this.remove) {
      this.entity.removeBehavior(this);
    }
  }
};
Delay.set = function (t) {
  if (t !== undefined) this.duration = t;
  this.time = 0;
};

Lerp.update = function (dt) {
  if (this.time === undefined) this.time = 0;
    this.time += dt;
  if (this.field == "angle")
    this.object[this.field] = lerp_angle(this.object[this.field], this.goal, this.rate * dt);
  else
    this.object[this.field] = lerp(this.object[this.field], this.goal, this.rate * dt, this.threshold || 1);
  if (this.object[this.field] == this.goal && this.callback) this.callback(); 
};

function lerp (current, goal, rate, threshold) {
  if (threshold === undefined) threshold = 1;
  if (Math.abs(goal - current) <= threshold) {
    return goal;
  } else {
    return (1-rate)*current + rate*goal
  }  
}

// projectile stuff

function projectileHit (object, other) {
  if (other.family == "player") {
    gameWorld.playSound(Resources.hit);
    projectileDie(object);
  } else if (other.family != object.family && other.solid) {
    gameWorld.playSound(Resources.hit_small);
    projectileDie(object);
  }
}

function projectileDie(p, color) {
  p.alive = false;
  color = color === undefined ? 1 : color;
  particles(p, 5, color);
}

function particles (p, count, color) {
  for (var i = 0; i < count; i++) {    
    // particle effect
    var d = p.layer.add(Object.create(Sprite).init(p.x, p.y, Resources.dust));
    d.addBehavior(Velocity);
    d.animation = color;
    d.z = p.z + 1;
    var theta = Math.random() * PI2;
    var speed = randint(5, 30);
    d.velocity = {x: speed * Math.cos(theta), y: speed * Math.sin(theta)};
    d.behaviors[0].onEnd = function () {
      this.entity.alive = false;
    };
  }
}

var projectile_vertices = [
  {x: -2, y: -2},
  {x: 2, y: -2},
  {x: 2, y: 2},
  {x: -2, y: 2}
];

var projectiles = [];

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

// FIX ME: don't use triangles?
var Triangle = Object.create(Entity);
Triangle.init = function (x, y, r) {
  this.instance();
  this.x = x, this.y = y, this.r = r;
  return this;
}
Triangle.onDraw = function (ctx) {
  ctx.fillStyle = this.color;
  ctx.beginPath();
  var theta = PI2 / 3;
  ctx.moveTo(this.x + Math.cos(this.angle) * this.r, this.y + Math.sin(this.angle) * this.r);
  ctx.lineTo(this.x + Math.cos(this.angle + theta) * this.r, this.y + Math.sin(this.angle + theta) * this.r);
  ctx.lineTo(this.x + Math.cos(this.angle + 2 * theta) * this.r, this.y + Math.sin(this.angle + 2 * theta) * this.r);
  ctx.closePath();
  ctx.fill();
  if (this.stroke) {
    ctx.lineWidth = this.width;
    ctx.strokeStyle = this.strokeColor;
    ctx.stroke();
  }
}
// added stroke as well as fill
Circle.oldDraw = Circle.onDraw;
Circle.onDraw = function (ctx) {
  this.oldDraw(ctx);
  if (this.stroke) {
    ctx.lineWidth = this.width;
    ctx.strokeStyle = this.strokeColor;
    ctx.stroke();
  }
};
Oscillate.update = function (dt) {
  if (!this.started) this.start();
  this.time += this.rate * dt;
  if (this.func === "cos") {
    this.object[this.field] = this.constant * Math.cos(this.time) + this.initial;    
  } else {
    this.object[this.field] = this.constant * Math.sin(this.time) + this.initial;    
  }
};
// stroke
Entity.oldDraw = Entity.onDraw;
Entity.onDraw = function (ctx) {
  this.oldDraw(ctx);
  if (this.stroke) {
    ctx.lineWidth = this.width;
    ctx.strokeStyle = this.strokeColor;
    ctx.strokeRect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
  } 
};

var Trail = Object.create(Behavior);
Trail.update = function (dt) {
  if (this.time === undefined) {
    this.record = [];
    this.time = 0;
  }
  this.time += dt;
  
  if (this.time >= this.interval) {
    this.time = 0;
    this.record.push({x: this.entity.x, y: this.entity.y});
    if (this.record.length > this.maxlength) {
      this.record.shift();
    }
  }
};
Trail.draw = function (ctx) {
  var shrink = this.entity.radius / this.record.length;
  ctx.fillStyle = this.entity.strokeColor;
  for (var i = 0; i < this.record.length; i++) {
    ctx.beginPath();
    ctx.arc(this.record[i].x, this.record[i].y, i * shrink, 0, PI2, true);
    ctx.fill();
  }
};

function lerp_angle (a1, a2, rate) {
  var r = a1 + short_angle(a1, a2) * rate;
  if (Math.abs(r - a2) < 0.01) return a2;
  else return r;
}

var Weapons = {
  bombard: function (layer) {
    gameWorld.playSound(Resources.laser);
    for (var i = 0; i < 3; i++) {
      var a = layer.add(Object.create(Sprite).init(this.x - TILESIZE + i * TILESIZE, this.y - 8 * i, Resources.projectile));
      a.strokeColor = COLORS.primary;
      a.radius = 4;
      a.projectile = true;
      a.setCollision(Polygon);
      a.setVertices(projectile_vertices);
      a.addBehavior(Velocity);
      a.family = this.family;
      a.collision.onHandle = projectileHit;
      a.velocity = {x: 0, y: -80};
      a.addBehavior(Trail, {interval: 0.02, maxlength: 10, record: []});
    }
    return TURN * 3;
  },
  target_point: function (layer) {
    gameWorld.playSound(Resources.laser);
    for (var i = 0; i < 2; i++) {
      var a = layer.add(Object.create(Sprite).init(this.x, this.y, Resources.projectile));
      a.strokeColor = COLORS.primary;
      a.radius = 4;
      a.projectile = true;
      a.setCollision(Polygon);
      a.setVertices(projectile_vertices);
      a.addBehavior(Velocity);
      a.family = this.family;
      a.collision.onHandle = projectileHit;
      a.addBehavior(Trail, {interval: 0.02, maxlength: 10, record: []});
      var theta = i * PI;
      a.addBehavior(Target, {target: {x: this.target.x, y: this.target.y}, turn_rate: 2, angle: theta, speed: SPEEDS.projectile_normal, offset: {x: 0, y: 0}, set_angle: true});
      a.addBehavior(FadeOut, {duration: 0, delay: 3});
    }
    return TURN * 3;
  },
  bomb: function (layer) {
    var g = toGrid(this.x, this.y);
    var a = layer.add(Object.create(Sprite).init(g.x, g.y, Resources.projectile));
    a.color = "black";
    a.stroke = true;
    a.strokeColor = COLORS.primary;
    a.width = 2;
    a.radius = 4;
    a.description = {name: "bomber", sprite: this.sprite};
    a.setCollision(Polygon);
    a.setVertices(projectile_vertices);
    gameWorld.playSound(Resources.laser);
    a.collision.onHandle = projectileHit;
    a.addBehavior(Velocity);
    a.family = this.family;//"player";
    a.addBehavior(Delay, {duration: ARM_TIME, callback: function () {
      this.entity.projectile = true;
    }});
    //a.projectile = true;
    a.velocity = {x: 0, y: 0};
    a.addBehavior(Accelerate);
    a.acceleration = {x: 0, y: SPEEDS.gravity};
    a.addBehavior(Trail, {interval: 0.02, maxlength: 10, record: []});
    projectiles.push(a);
    return TURN * 2;
  },
  firework: function (layer) {
    gameWorld.playSound(Resources.laser);
    for (var i = 0; i < 10; i++) {
      var theta = -PI / 2 + i * PI2 / 10 + (this.shoot_angle || 0);
      var a = layer.add(Object.create(Sprite).init(this.x, this.y, Resources.projectile));
      a.radius = 4;
      a.color = "black";
      a.stroke = true;
      a.strokeColor = COLORS.primary;
      a.width = 2;
      a.setCollision(Polygon);
      a.setVertices(projectile_vertices);
      gameWorld.playSound(Resources.laser);
      a.collision.onHandle = projectileHit;
      a.addBehavior(Velocity);
      a.family = this.family;
      a.addBehavior(Delay, {duration: ARM_TIME, callback: function () {
        this.entity.projectile = true;
      }});
    //a.projectile = true;;
      a.angle = theta;
      a.velocity = {x: SPEEDS.projectile_slow * Math.cos(a.angle), y: SPEEDS.projectile_slow * Math.sin(a.angle)  };
      a.addBehavior(Trail, {interval: 0.02, maxlength: 10, record: []});
      projectiles.push(a);
      a.description = {name: "starfish", sprite: this.sprite};
    }
    return TURN * 7;
  },
  hitscan: function (layer) {
    var t = this;
    if (this.move) {
      this.velocity = {x: 0, y: 0};
      this.move.oldGoal = this.move.goal;
      this.move.goal = undefined;
      this.move.delay = 1;
    }
    var theta = this.target ? (this.target.decoy ? angle(this.x, this.y, this.target.decoy.x, this.target.decoy.y) : angle(this.x, this.y, this.target.x, this.target.y)) : this.angle;
    var warn = layer.add(Object.create(Entity).init(this.x + Math.cos(theta) * gameWorld.height, this.y + Math.sin(theta) * gameWorld.height, gameWorld.height * 2, 8));
    gameWorld.playSound(Resources.beam);
    (function () {
      warn.color = COLORS.primary; //"#ff6347";
      warn.opacity = 0;
      warn.angle = theta;
      warn.z = 0;
      warn.fade = warn.addBehavior(FadeIn, {duration: 0.5, maxOpacity: 1})
      warn.addBehavior(FadeOut, {delay: 1, duration: 0.2, maxOpacity: 1});
      warn.addBehavior(Delay, {duration: 0.5, callback: function () {
        var a = this.entity.layer.add(Object.create(Entity).init(this.entity.x, this.entity.y, this.entity.w, 2));
        a.setCollision(Polygon);
        gameWorld.playSound(Resources.laser);
        a.family = "enemy";//"player";
        a.description = {name: "spotlight", sprite: Resources.walker};
        a.beam = true;
        a.z = 100;
        a.angle = this.entity.angle;
        var w = this.entity;
        var t = this;
        //(function () {
        w.removeBehavior(this);
        a.addBehavior(Delay, {duration: 0.3, callback: function () {
          this.entity.addBehavior(FadeOut, {duration: 0.2});
          this.entity.beam = false;
          this.entity.removeBehavior(this);
        }});
        //})();
      }});
    })();
    return TURN * 5;
  },
  standard: function (layer) {
    //var a = layer.add(Object.create(Circle).init(this.x, this.y, 4));
    var a = layer.add(Object.create(Sprite).init(this.x, this.y, Resources.projectile));
    a.radius = 4;
    a.color = "black";
    a.stroke = true;
    a.strokeColor = COLORS.primary;
    a.width = 2;
    a.setCollision(Polygon);
    a.description = {name: "drone", sprite: this.sprite};
    a.setVertices(projectile_vertices);
    gameWorld.playSound(Resources.laser);
    a.collision.onHandle = projectileHit;
    a.addBehavior(Velocity);
    a.family = this.family;
        a.addBehavior(Delay, {duration: ARM_TIME, callback: function () {
      this.entity.projectile = true;
    }});
    //a.projectile = true;;
    var theta = this.target ? (this.target.decoy ? angle(this.x, this.y, this.target.decoy.x, this.target.decoy.y) : angle(this.x, this.y, this.target.x, this.target.y)) : this.angle;
    a.velocity = {x: SPEEDS.projectile_normal * Math.cos(theta), y: SPEEDS.projectile_normal * Math.sin(theta)  };
    //a.angle = theta;    
    a.addBehavior(Trail, {interval: 0.02, maxlength: 10, record: []});
    projectiles.push(a);
    return 3 * TURN;
  },
  triple: function (layer) {
    if (this.count === undefined) this.count = 0;
    var a = layer.add(Object.create(Sprite).init(this.x, this.y, Resources.projectile));
    a.color = "black";
    a.stroke = true;
    a.strokeColor = COLORS.primary;
    a.width = 2;
    a.radius = 4;
    a.description = {name: "demon bus", sprite: this.sprite};
    a.setCollision(Polygon);
    a.setVertices(projectile_vertices);
    gameWorld.playSound(Resources.laser);
    a.collision.onHandle = projectileHit;
    a.addBehavior(Velocity);
    a.family = this.family;
    a.addBehavior(Delay, {duration: ARM_TIME, callback: function () {
      this.entity.projectile = true;
    }});
    //a.projectile = true;;
    var theta = this.target ? (this.target.decoy ? angle(this.x, this.y, this.target.decoy.x, this.target.decoy.y) : angle(this.x, this.y, this.target.x, this.target.y)) : this.angle;
    a.velocity = {x: SPEEDS.projectile_fast * Math.cos(theta), y: SPEEDS.projectile_fast * Math.sin(theta)  };
    a.angle = theta;
    a.addBehavior(Trail, {interval: 0.02, maxlength: 10});
    projectiles.push(a);

    this.count += 1;
    if (this.count % 3 === 0) {
      return 5 * TURN;
    } else {
      return TURN;
    }
  },
  burst: function (layer) {
    if (this.count === undefined) this.count = 0;
    var a = layer.add(Object.create(Sprite).init(this.x + this.offset.x, this.y + this.offset.y, Resources.projectile));
    a.color = "black";
    a.stroke = true;
    a.strokeColor = COLORS.primary;
    a.width = 2;
    a.radius = 4;
    a.description = {name: "watcher", sprite: this.sprite};
    a.setCollision(Polygon);
    a.setVertices(projectile_vertices);
    gameWorld.playSound(Resources.laser);
    a.collision.onHandle = projectileHit;
    a.addBehavior(Velocity);
    a.family = this.family;//"player";
    a.addBehavior(Delay, {duration: ARM_TIME, callback: function () {
      this.entity.projectile = true;
    }});
    //a.projectile = true;;
    if (this.count % 15 === 0) {
      this.theta = this.target ? (this.target.decoy ? angle(this.x, this.y, this.target.decoy.x, this.target.decoy.y) : angle(this.x, this.y, this.target.x, this.target.y)) : this.angle;
    }
    a.velocity = {x: SPEEDS.projectile_normal * Math.cos(this.theta), y: SPEEDS.projectile_normal * Math.sin(this.theta)  };
    a.angle = this.theta;
    a.addBehavior(Trail, {interval: 0.02, maxlength: 10});
    
    projectiles.push(a);
    
    this.count += 1;
    if (this.count % 15 === 0) {
      return TURN * 5;
    } else {
      return TURN / 2;
    }
  },
  homing: function (layer) {
      var a = layer.add(Object.create(Sprite).init(this.x, this.y, Resources.projectile));
      a.color = "black"; //"#4CAF52";
      a.stroke = true;
      a.strokeColor = COLORS.primary;
      a.width = 2;
      a.radius = 4;
      a.setCollision(Polygon);
      a.description = {name: "lurker", sprite: this.sprite};
      a.setVertices(projectile_vertices);
      a.collision.onHandle = projectileHit;
      a.addBehavior(Velocity);
      a.family = this.family;
      a.addBehavior(Delay, {duration: ARM_TIME, callback: function () {
        this.entity.projectile = true;
      }});
    //a.projectile = true;;
      var theta = this.shoot_angle !== undefined ? this.shoot_angle : this.angle;
      a.addBehavior(Target, {target: this.target, turn_rate: 1, angle: theta, speed: 2 * SPEEDS.projectile_slow, offset: {x: 0, y: 0}, set_angle: true});

      a.velocity = {x: SPEEDS.projectile_normal * Math.cos(theta), y: SPEEDS.projectile_normal * Math.sin(theta)};
      a.angle = theta;
      a.addBehavior(Trail, {interval: 0.02, maxlength: 10})

      a.specialFollow = a.addBehavior(Behavior, {target: this});
      a.specialFollow.update = function (dt) {
        if (!this.target.alive) {
          projectileDie(this.entity);
          this.entity.removeBehavior(this);
        }
      }
      //a.addBehavior(Follow, {target: this, offset: {x: false, y: false, z: false, alive: true, angle: false}});
      projectiles.push(a);      
      return TURN * 3;     
  }
}

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
  } else if (body.mozRequestFullScreen) {
      body.mozRequestFullScreen();
  } else if (body.msRequestFullscreen) {
      body.msRequestFullscreen();
  } else if (window.requestFullscreen) {
      window.requestFullscreen();
  } else {
    console.log('could not request fullscreen');
  }
}

// cooldown, shoot
var Enemy = Object.create(Behavior);
Enemy.update = function (dt) {
  if (this.cooldown > 0) this.cooldown -= dt;
  else if (this.entity.shoot) {
    this.cooldown = this.entity.shoot(this.entity.layer);
  }
}
Enemy.draw = function (ctx) {
  if (this.cooldown > 0 && this.cooldown < 2 * TURN) {
    ctx.beginPath();
    ctx.arc(this.entity.x, this.entity.y, this.cooldown * 2 * this.entity.w + this.entity.w / 2, 0, PI2, true);
    ctx.fillStyle = COLORS.primary; //"#ff6347";
    ctx.globalAlpha = 1 - (this.cooldown / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// special behavior for boss enemy
var BossEnemy = Object.create(Enemy);
BossEnemy.patterns = [
  function (dt) { // cross, x, v, whatever!
    for (var i = 0; i <= 4; i++) {        
      this.entity.shoot = Weapons.hitscan;
      this.entity.target = {x: this.entity.x + HEIGHT * Math.cos(i * PI / 2 + this.pattern_index * PI / 8), y: this.entity.y + HEIGHT * Math.sin(i * PI / 2 + this.pattern_index * PI / 8)};
      this.entity.shoot(this.entity.layer);
      this.pattern_cooldown = TURN;
    }
    this.pattern_index += 1;
    if (this.pattern_index >= 4) this.endPattern(2 * TURN);
  },
  function (dt) { // alternative firework
    this.entity.shoot = Weapons.firework;
    this.entity.shoot_angle = this.pattern_index * PI / 8;
    this.entity.shoot(this.entity.layer);
    this.pattern_cooldown = 3 * TURN;
    this.pattern_index += 1;

    if (this.pattern_index >= 4) this.endPattern(4 * TURN);
  },
  function (dt) { // homing (a bit messy!)
    this.entity.shoot = Weapons.homing;
    
    this.entity.target = gameWorld.player.decoy ? gameWorld.player.decoy : gameWorld.player;

    this.entity.shoot_angle = 0//this.pattern_index * PI / 8;
    this.entity.shoot(this.entity.layer);
    this.entity.shoot_angle = PI;
    this.entity.shoot(this.entity.layer);
    
    this.pattern_cooldown = TURN / 2;
    this.pattern_index += 1;

    if (this.pattern_index >= 3) this.endPattern(4 * TURN);
  },
  function (dt) { // spiral
    this.entity.shoot = Weapons.standard;
    this.entity.target = {x: this.entity.x + HEIGHT * Math.cos(-this.pattern_index * PI / 12), y: this.entity.x + HEIGHT * Math.sin(-this.pattern_index * PI / 12)};
    this.entity.shoot(this.entity.layer);
    this.entity.target = {x: this.entity.x + HEIGHT * Math.cos(-PI +this.pattern_index * PI / 12), y: this.entity.x + HEIGHT * Math.sin(-PI +this.pattern_index * PI / 12)};
    this.entity.shoot(this.entity.layer);

    this.pattern_index += 1;
    this.pattern_cooldown = TURN / 2;
    if (this.pattern_index >= 12) this.endPattern(2 * TURN);
  }
];
BossEnemy.endPattern = function(cooldown) {
  this.pattern_cooldown = 0;
  this.pattern_index = 0;
  this.cooldown = cooldown;
  this.pattern = undefined;
}
BossEnemy.update = function (dt) {
  if (this.pattern) {
    if (this.pattern_cooldown > 0) this.pattern_cooldown -= dt;
    else this.pattern(dt);
  }
  else if (this.cooldown > 0) this.cooldown -= dt;
  else {
    this.endPattern(0);
    this.pattern = choose(this.patterns);
    //this.pattern = this.patterns[2];
  }
}

Velocity.update = function (dt) {
  this.entity.x += dt * this.entity.velocity.x;
  this.entity.y += dt * this.entity.velocity.y; 
  this.entity.angle += dt * this.entity.velocity.angle || 0;  
};

FadeIn.start = function () {
  this.maxOpacity = 1;
  this.time = 0;
};

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

// homing missile
var Target = Object.create(Behavior);
Target.update = function (dt) {
  if (this.angle === undefined) this.angle = 0;
  if (!this.offset) {
    this.entity.opacity = 0.5;
    return;
  }
  this.angle =  lerp_angle(this.angle, angle(this.entity.x, this.entity.y, this.target.x + this.offset.x, this.target.y + this.offset.y), this.turn_rate * dt);
  if (this.set_angle) this.entity.angle = this.angle;
  this.entity.velocity = {x: Math.cos(this.angle) * this.speed, y: Math.sin(this.angle) * this.speed};
};

var Periodic = Object.create(Behavior);
Periodic.update = function (dt) {
  if (this.time === undefined) this.time = 0;
  this.time += dt;

  if (this.time >= this.period) {
    this.callback();
    this.time = 0;
  }
}

var sprites = ["drone", "train", "radar", "saucer", "thopter", "fighter", "walker"];
function spawn(layer, key, player, points, nonce) {
  var theta = Math.random() * PI2;
  //var x = randint(MIN.x, MAX.x), y = randint(MIN.y, MAX.y);
  //var c = toGrid(x, y);
  var p = toGrid(player.x, player.y);
  var b = toGrid(gameWorld.boss.x, gameWorld.boss.y);
  // clumsy way of making sure we don't spawn on top of player or boss
  /*while ((c.x === p.x && c.y === p.y) || (c.x === b.x && c.y === b.y)) {
    x = randint(MIN.x, MAX.x), y = randint(MIN.y, MAX.y);
    c = toGrid(x, y);   
  }*/
  var enemy = Object.create(Sprite).init(WIDTH / 2, HEIGHT / 2, Resources[sprites[key % sprites.length]]);
  enemy.z = player.z - 2 + nonce;
  nonce += 0.01;
  enemy.addBehavior(Velocity);
  enemy.velocity = {x: 0, y: 0};
  enemy.setCollision(Polygon);
  //enemy.addBehavior(Crop, {min: {x: MIN.x, y: MIN.y}, max: {x: MAX.x, y: MAX.y}});
  enemy.addBehavior(Bound, {min: {x: MIN.x, y: MIN.y}, max: {x: MAX.x, y: MAX.y}});
  
  //enemy.blend = "destination-out";
  switch (key) {
    case 0: // drone
      enemy.addBehavior(Approach, {duration: 1.2, speed: SPEEDS.enemy_normal, target: player, delay: 0.5}); // hmmm!
      enemy.shoot = Weapons.standard;
      enemy.target = player;
      enemy.setVertices([
        {x: -3, y: -3}, {x: -3, y: 3}, {x: 3, y: 3}, {x: 3, y: -3}
      ]);
      var point = points.air.pop(); if (!point) return;
      enemy.x = point.x, enemy.y = point.y;
      break;
    case 1: // armored train
      enemy.shoot = Weapons.triple;      
      var point = points.ground.pop(); if (!point) return;
      enemy.x = point.x, enemy.y = point.y;

      enemy.offset = {x: 0, y: 2};
      enemy.addBehavior(Horizontal, {duration: 0.5, speed: SPEEDS.enemy_horizontal, target: player, min: MIN.x, max: MAX.x, delay: 0.5}); // hmmm!
      enemy.target = player;
      enemy.y = toGrid(100, 1000).y + 4;
      enemy.setVertices([
        {x: -3, y: -3}, {x: -3, y: 3}, {x: 3, y: 3}, {x: 3, y: -3}
      ]);
      debug = enemy;
      break;
    case 2: // turret
      enemy.shoot = Weapons.burst;
      enemy.target = player;
      //enemy.x = toGrid(WIDTH, 0).x;
      
      var point = points.wall.pop(); if (!point) return;
      enemy.x = point.x, enemy.y = point.y;

      if (enemy.x > WIDTH / 2) enemy.angle = PI;      
      enemy.setVertices([
        {x: -3, y: -3}, {x: -3, y: 3}, {x: 3, y: 3}, {x: 3, y: -3}
      ]);     
      break;
    case 3: // bomber
      enemy.addBehavior(Horizontal, {duration: 0, speed: TILESIZE / (2 * TURN), target: player, min: MIN.x, max: MAX.x, delay: 0.2});
      enemy.setVertices([
        {x: -5, y: -3}, {x: -5, y: 3}, {x: 5, y: 3}, {x: 5, y: -3}
      ]);
      //enemy.y = toGrid(0, 0).y;
      

      var point = points.sky.pop(); if (!point) return;
      enemy.x = point.x, enemy.y = point.y;

      enemy.addBehavior(Flip);
      enemy.shoot = Weapons.bomb;
      break;
    case 4: // minelayer (except the mines are FIREWORKS)
      
      var point = points.air.pop(); if (!point) return;
      enemy.x = point.x, enemy.y = point.y;

      enemy.addBehavior(Move, {duration: 1, speed: SPEEDS.enemy_normal, delay: 1 });
      enemy.shoot = Weapons.firework;
      enemy.shoot_angle = -PI / 2;      
      enemy.setVertices([
        {x: -4, y: 0}, {x: 0, y: 4}, {x: 4, y: 0}, {x: 0, y: -4}
      ]);
      break;
    case 5: // fighter shooting homing missiles
      var point = points.air.pop(); if (!point) return;
      enemy.x = point.x, enemy.y = point.y;
      enemy.addBehavior(Approach, {duration: 1.1, speed: SPEEDS.enemy_normal, target: player, turn: true, delay: 1.1});
      enemy.target = player;
      enemy.shoot = Weapons.homing;
      enemy.setVertices([
        {x: -6, y: -3}, {x: -6, y: 3}, {x: 6, y: 3}, {x: 6, y: -3}
      ]);
      break;
    case 6: // beam weapon!!

      var point = points.ground.pop(); if (!point) return;
      enemy.x = point.x, enemy.y = point.y;

      enemy.move = enemy.addBehavior(Horizontal, {duration: 0.5, speed: SPEEDS.enemy_horizontal_slow, target: player, min: MIN.x, max: MAX.x, delay: 0.5}); // hmmm!

      enemy.animation = 0;
      enemy.target = player;
      enemy.shoot = Weapons.hitscan;
      enemy.offset = {x: 0, y: 4};
      enemy.setVertices([
        {x: -6, y: -3}, {x: -6, y: 3}, {x: 6, y: 3}, {x: 6, y: -3}
      ]);
      break;
  }
  var flash = layer.add(Object.create(Sprite).init(enemy.x, enemy.y, Resources.blink));
  flash.addBehavior(FadeOut, {duration: 0, delay: 0.7});
  enemy.family = "enemy";
  enemy.addBehavior(Enemy, {cooldown: TURN});
  enemy.collision.onHandle = function (object, other) {
    if (other.family == "player") {
      enemy.die();
    }
  };

  layer.add(enemy);
  enemy.die = function () {
    enemy.alive = false;

    // particle effect
    for (var i = 0; i < 40; i++) {
      var d = this.layer.add(Object.create(Sprite).init(this.x, this.y, Resources.dust));
      d.addBehavior(Velocity);
      d.animation = 0;
      var theta = Math.random() * PI2;
      var speed = randint(5, 50);
      d.velocity = {x: speed * Math.cos(theta), y: speed * Math.sin(theta)};
      d.behaviors[0].onEnd = function () {
        this.entity.alive = false;
      };
    }
    gameWorld.playSound(Resources.hit_hard);        
    
    // scrap (coins??)
    var scrap = enemy.layer.add(Object.create(Sprite).init(enemy.x, enemy.y, this.sprite));
    scrap.opacity = 0.8;
    scrap.angle = this.angle;
    var theta = angle(scrap.x, scrap.y, gameWorld.boss.x, gameWorld.boss.y);
    scrap.z = 2.5;
    scrap.addBehavior(Velocity);
    scrap.velocity = {x: 0, y: 0, angle: PI / 6};
    scrap.scrap = true;
    scrap.setCollision(Polygon);
    scrap.addBehavior(Periodic, {period: 0.1, callback: function () {
      if (Math.random() <= 0.5) {
        var d = this.entity.layer.add(Object.create(Sprite).init(this.entity.x + randint(0, this.entity.w) - this.entity.w / 2, this.entity.y + this.entity.offset.y + randint(-this.entity.h / 2, this.entity.h / 2), Resources.dust));
        d.z = this.entity.z + 1;
        d.opacity = this.entity.opacity;
        d.behaviors[0].onEnd = function () {
          this.entity.alive = false;
        };
        d.addBehavior(Velocity);
        d.velocity = {x: 0, y: - 40};
      }
    }});
    if (gameWorld.boss.queue.indexOf(toGrid(0, scrap.y).y) == -1) {
      gameWorld.boss.queue.unshift(toGrid(0, scrap.y).y);      
    }
    scrap.collision.onHandle = function (object, other) {
      if (other == gameWorld.boss) {
        object.alive = false;
        // fix me: play 'processing' or HEALING sound, animation?
        gameWorld.playSound(Resources.work);
      }
    }
  };
  return enemy;
}

var Movement = {
  standard: function (s) {
    s.player.cursor.opacity = 0;

    var x = Math.round(s.player.x + this.distance * Math.cos(s.player.angle)),
        y = Math.round(s.player.y + this.distance * Math.sin(s.player.angle));
    var goal = toGrid(x, y);      
    if (goal.x !== s.player.x || goal.y !== s.player.y) {       
      s.player.lerpx = s.player.addBehavior(Lerp, {field: "x", goal: goal.x, rate: this.speed, object: s.player, callback: function () {
        this.entity.removeBehavior(this);
        this.entity.lerpx = undefined;
        s.pause();
      }});
      s.player.lerpy = s.player.addBehavior(Lerp, {field: "y", goal: goal.y, rate: this.speed, object: s.player, callback: function () {
        this.entity.removeBehavior(this);
        this.entity.lerpy = undefined;
        s.pause();
      }});
      s.unpause();
      if (this.speed === SPEEDS.player) {
        gameWorld.playSound(Resources.move);        
        var d = s.player.layer.add(Object.create(Sprite).init(s.player.x, s.player.y, Resources.dust));
        d.addBehavior(FadeOut, {duration: 0.8});
      } else {
        gameWorld.playSound(Resources.move_fast);        
        particles(this, 3, 2);
      }
    }
  }
}

var Store = {
  init: function (layer, player) {
    this.layer = layer, this.player = player, this.spent = 0, this.repair_cost = 1;
    this.createUI();
    return this;
  },
  buttons: [
    { name: "Health", price: 1, icon: 0, 
      trigger: function (t) {
        t.player.health++;
        gameWorld.scene.updateHealthBar(t.player);
      },
      check: function (t) {
        if (t.player.health < MAXHEALTH) {        
          return true;
        } else {
          return false;
        }
      }
    },
    {
      name: "Shield", price: 2, icon: 1, 
      trigger: function (t) {
        t.player.has_shield = t.player.addBehavior(Shielded, {rate: 0.5});
        gameWorld.scene.updateHealthBar(t.player);
      },
      check: function (t) {
        if (!t.player.has_shield) {
          return true;
        } else {
          return false;
        }
      }
    },
    {
      name: "Speed", price: 2, icon: 2,
      trigger: function (t) {
        t.player.speed = 10;
      },
      check: function (t) {
        if (t.player.speed < 8) {
          return true;          
        } else {
          return false;
        }
      }
    },
    {
      name: "Decoy", price: 2, icon: 3, 
      trigger: function (t) {
        t.player.hasDecoy = t.player.addBehavior(Periodic, {time: 4, period: 5, callback: function () {
          this.entity.decoy = this.entity.layer.add(Object.create(Sprite).init(this.entity.x, this.entity.y, Resources.viper));
          this.entity.decoy.scale = 2;
          this.entity.decoy.angle = this.entity.angle;
          gameWorld.playSound(Resources.decoy);
          var txt = this.entity.layer.add(Object.create(SpriteFont).init(this.entity.x, this.entity.y, Resources.expire_font, "decoy active!!", {spacing: -2, align: "center"}));
          txt.addBehavior(Velocity);
          txt.scale = 2;
          txt.z = t.player.z + 1;
          txt.velocity = {x: 0, y: 10 };
          txt.addBehavior(FadeOut, {delay: 0.4, duration: 0.2});
          var e = this.entity;
          this.entity.decoy.addBehavior(Delay, {duration: 1.5, callback: function () {
            this.entity.addBehavior(FadeOut, {duration: 0.2});
            e.decoy = undefined;
            var txt = this.entity.layer.add(Object.create(SpriteFont).init(this.entity.x, this.entity.y, Resources.expire_font, "decoy inactive.", {spacing: -2, align: "center"}));
            txt.addBehavior(Velocity);
            txt.scale = 2;
            txt.z = t.player.z + 1;
            txt.velocity = {x: 0, y: 10 };
            txt.addBehavior(FadeOut, {delay: 0.4, duration: 0.2});
          }})
        }});
      },
      check: function (t) {
        if (!t.player.hasDecoy) {
          return true;          
        } else {
          return false;
        }
      }
    },
    {
      name: "Bomb", price: 1, icon: 4, 
      trigger: function (t) {
        var enemies = gameWorld.scene.bg.entities.filter(function (e) { return e.family === "enemy"; });
        for (var i = 0; i < enemies.length; i++) {
          if (enemies[i].projectile) {
            projectileDie(enemies[i])
          } else if (enemies[i].die) {
            enemies[i].die();            
          } else {
            console.log(enemies[i].x, enemies[i].y, "isn't projectile or something dieable")
          }
        }
      },
      check: function (t) {
        return true;
      }
    },
    {
      name: "Gate Key", price: 7, icon: 5, 
      trigger: function (t) {
        t.player.hasFTL = true;
      },
      check: function (t) {
        if (!t.player.hasFTL) {
          return true;
        } else {
          return false;
        }
      }
    }
  ],
  createUI: function () {

    var border = this.layer.add(Object.create(TiledBackground).init(gameWorld.width / 2, gameWorld.height / 2, 128, 8 * 16 + 24, Resources.building));
    border.z = -10;
    var b1 = this.layer.add(Object.create(Entity).init(border.x, border.y + 1, border.w - 8, border.h - 16));
    b1.color = "#000";
    b1.z = -9;
    var b2 = this.layer.add(Object.create(Entity).init(border.x, border.y + 2, border.w - 16, border.h - 24));
    b2.color = "#fff";
    b2.z = -8;
    border.scale = 2;
    b1.scale = 2;
    b2.scale = 2;

    var t = this;
    
    var close = this.layer.add(Object.create(Entity).init(gameWorld.width / 2, border.y + border.h - 32, 2 * border.w - 32, 32));
    close.z = -7;
    close.text = this.layer.add(Object.create(SpriteFont).init(close.x, close.y, Resources.expire_font, "DONE", {align: "center", spacing: -2}))
    close.text.z = -6;
    close.text.scale = 2;
    close.family = "button";
    close.color = "white";
    close.trigger = function () {
      if (!t.opened) return;
      t.player.salvage -= t.spent;
      t.spent = 0;
      gameWorld.playSound(Resources.buy);
      t.close();
    };
    close.hover = function () {
      if (this.color != COLORS.button) gameWorld.playSound(Resources.hover);
      this.color = COLORS.button;
    };
    close.unhover = function () {
      this.color = "white";
    };
    //this.weapons = {};
    this.salvage = this.layer.add(Object.create(SpriteFont).init(gameWorld.width / 2, border.y - border.h + 48, Resources.expire_font, "$ 0", {align: "center", spacing: -2}));
    this.salvage.scale = 2;
    this.button_objects = [];

    var t = this;
    for (var i = 0; i < this.buttons.length; i++) {
      // probably need closure here
      (function () {
        var j = i;
        var button = t.layer.add(Object.create(Entity).init(gameWorld.width  / 2, t.salvage.y + 32 * (1 + i), 2 * border.w - 32, 32));
        button.icon = t.layer.add(Object.create(Sprite).init(gameWorld.width / 2 - (border.w - 32), t.salvage.y + 32 * (i + 1), Resources.icons));
        button.name_text = t.layer.add(Object.create(SpriteFont).init(gameWorld.width / 2, t.salvage.y + 32 * (i + 1), Resources.expire_font, t.buttons[i].name, {spacing: -2, align: "center"}));
        button.price_text = t.layer.add(Object.create(SpriteFont).init(gameWorld.width / 2 + (border.w - 8), t.salvage.y + 32 * (i + 1), Resources.expire_font, "$" + t.buttons[i].price, {spacing: -2, align: "right"}));
        button.color = "white";
        button.family = "button";
        button.price = t.buttons[j].price;
        button.check = t.buttons[j].check;
        button.icon.scale = 2;
        button.name_text.scale = 2;
        button.price_text.scale = 2;
        button.hover = function () {
          // check if you can afford it here, change color accordingly
          var color = "#dddddd"; 
          if (t.player.salvage - t.spent < this.price);
          else if (!this.check(t));
          else
            color = COLORS.button;
          if (this.color != color) {
            gameWorld.playSound(Resources.hover);
            this.color = color;
          }
        }
        button.unhover = function () {
          this.color = "white";
        }
        button.z = -2, button.icon.z = -1, button.name_text.z = -1, button.price_text.z = -1;
        button.icon.animation = t.buttons[i].icon;
        button.trigger = function () {
          // check price HERE
          if (!t.opened) return;
          if (t.player.salvage - t.spent >= this.price)
          {
            if (t.buttons[j].check(t)) {
              t.buttons[j].trigger(t);
              t.spent += this.price;
              t.salvage.text = "$" + (t.player.salvage - t.spent);
              gameWorld.player.cash_counter.text = "$ " + (t.player.salvage - t.spent);              
              gameWorld.playSound(Resources.select);
            }
          }
        }
        t.button_objects.push(button);
      })();
    }
    this.button_objects.push(close);
    // allow for rotate transition
    for (var i = 0; i < this.layer.entities.length; i++) {
      this.layer.entities[i].origin = {x: 0, y: 480};
      this.layer.entities[i].angle = -PI/2;
      this.layer.entities[i].lerp = this.layer.entities[i].addBehavior(Lerp, {object: this.layer.entities[i], field: "angle", goal: 0, rate: 8});
      this.layer.entities[i].goal = this.layer.entities[i].lerp.goal;
      this.layer.entities[i].original = this.layer.entities[i].angle;
    }
    
  },
  up: function () {
    this.selected = modulo(this.selected + 1, this.button_objects.length);
    for (var i = 0; i < this.button_objects.length; i++) {
      this.button_objects[i].unhover();
    }
    this.button_objects[this.selected].hover();
  },
  down: function () {
    this.selected = modulo(this.selected - 1, this.button_objects.length);
    for (var i = 0; i < this.button_objects.length; i++) {
      this.button_objects[i].unhover();
    }
    this.button_objects[this.selected].hover();
  },
  go: function () {
    this.button_objects[this.selected].trigger();
    for (var i = 0; i < this.button_objects.length; i++) {
      this.button_objects[i].unhover();
    }
    this.button_objects[this.selected].hover();
  },
  open: function () {
    this.player.locked = true;
    this.selected = 0;
    for (var i = 0; i < this.button_objects.length; i++) {
      this.button_objects[i].unhover();
    }
    this.button_objects[this.selected].hover();

    this.salvage.text = "$ " + this.player.salvage;
    
    for (var i = 0; i < this.layer.entities.length; i++) {
      this.layer.entities[i].lerp.goal = this.layer.entities[i].goal;
    }    var t = this;
    gameWorld.boss.store_open.alive = false;
    gameWorld.boss.store_open = undefined;    
    this.layer.entities[0].lerp.callback = function () {
      t.opened = true;
    }
    this.layer.active = true;
    /*for (var i = 0; i < gameWorld.scene.layers.length; i++) {
      gameWorld.scene.layers[i].paused = true;
    }*/
    gameWorld.scene.bg.paused = true;
    this.layer.paused = false;
  },
  close: function () {
    var t = this;
    this.opened = false;
    for (var i = 0; i < this.layer.entities.length; i++) {
      this.layer.entities[i].lerp.goal = this.layer.entities[i].original;
    }
    this.layer.entities[0].lerp.callback = function () {
      t.player.locked = false;
      this.callback = undefined;
      t.layer.active = false;
    }
    gameWorld.boss.boss.delay = 0;
  }
}