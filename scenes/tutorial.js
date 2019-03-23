var onStart =  function () {
  //Resources.music = Resources.menu;
  var player;
  var s = this;

  var start = undefined;
  this.enemies = [];

  this.step = 0;
  this.steps = [
    // ["message", function () { condition }];
    //[["", "move the mouse to turn"], function () { return player.angle !== 0; }, function () {}], // fix me: need to allow this to stay on screen for a time
    [["use the arrow keys to move", "swipe to move in a direction", "use l-stick to move", "click to move in a direction"], function () { return ((player.x != player_coordinates.x || player.y != player_coordinates.y) && player.stopped()); }, function () {}],
    [["hit objects to destroy them"],
      function () {
        return player.targets.filter( function (e) { return e.alive; }).length <= 0;
      },
      function () {
        for (var i = -1; i <= 2; i += 2) {
          var c = toGrid(player.x + TILESIZE * i, player.y);
          var a = s.fg.add(Object.create(Sprite).init(c.x, c.y, Resources.asteroid));
          s.enemies.push(a);
          a.setCollision(Polygon);
          a.z = 9;
          player.targets.push(a);
          a.collision.onHandle = function (object, other) {
            if (other.family == "player") {
              object.alive = false;
              gameWorld.playSound(Resources.hit_hard);
              for (var i = 0; i < 20; i++) {    
                var d = object.layer.add(Object.create(Sprite).init(object.x, object.y, Resources.dust));
                d.addBehavior(Velocity);
                var theta = Math.random() * PI2;
                var speed = randint(5, 30);
                d.velocity = {x: speed * Math.cos(theta), y: speed * Math.sin(theta)};
                d.behaviors[0].onEnd = function () {
                  this.entity.alive = false;
                };
              }
            }
          };
        }
      }
    ],
    [["avoid things that are blue!"],
      function () {
        return player.targets.filter( function (e) { return e.alive; }).length <= 0;
      },
      function () {
        for (var i = MIN.x; i < MAX.x; i += TILESIZE) {
          var c = toGrid(i, 0);
          var p = toGrid(player.x, player.y);
          if (c.x != ((p.x > (MIN.x + MAX.x) / 2) ? p.x - TILESIZE : p.x + TILESIZE )) {            
            var a = s.fg.add(Object.create(Sprite).init(c.x, c.y, Resources.projectile));
            s.enemies.push(a);
            a.color = "black";
            a.stroke = true;
            a.strokeColor = COLORS.primary;
            a.width = 2;
            a.radius = 4;

        //      var a = layer.add(Object.create(Entity).init(this.x, this.y, 2, 2));
            //a.animation = 5;
            a.setCollision(Polygon);
            a.setVertices(projectile_vertices);
            a.collision.onHandle = projectileHit;
            a.addBehavior(Velocity);
            a.family = "enemy";
            a.projectile = true;
            //;
            var theta = PI / 2;
            //if (this.target) console.log('target');
            a.velocity = {x: 80 * Math.cos(theta), y: 80 * Math.sin(theta)  };
            a.angle = theta;
            a.addBehavior(Trail, {interval: 0.06, maxlength: 10, record: []});
            s.player.targets.push(a);
          }
        }
      }
    ],
    [["you are now ready"], function () { return false; }, function () {
      var b = s.fg.add(Object.create(SpriteFont).init(gameWorld.width / 2, gameWorld.height / 2, Resources.expire_font, "start game!", {spacing: -3, align: "center"}));
      b.scale = 2;
      var button = s.fg.add(Object.create(Entity).init(gameWorld.width / 2, gameWorld.height / 2, gameWorld.width, 32));
      button.family = "button";
      button.color = COLORS.button;
      button.z = 1;
      b.z = 2;
      button.text = b;
      button.hover = function () { this.text.scale = 1.1;};
      button.unhover = function () { this.text.scale = 1; };
      button.trigger = function () {
        gameWorld.setScene(1, true);
      };
      start = button;
    }]
  ];
  this.condition = function () { return true; };

  var fg = this.addLayer(Object.create(Layer).init(gameWorld.width, gameWorld.height));
  fg.camera.addBehavior(Bound, {min: {x: 0, y:  0}, max: {x: WIDTH - gameWorld.width, y: HEIGHT - gameWorld.height}})


  this.message = fg.add(Object.create(SpriteFont).init(gameWorld.width / 2, gameWorld.height - 72, Resources.expire_font, this.steps[this.step][0], {spacing: -2, align: "center"}));
  this.message.z = 100;
  this.message.scale = 2;

  var bg = fg.add(Object.create(Entity).init(gameWorld.width / 2, gameWorld.height / 2, gameWorld.width, gameWorld.height));
  bg.color = "black";
  bg.z = -10;

  var grid = fg.add(Object.create(TiledBackground).init((MIN.x + MAX.x) / 2, (MIN.y + MAX.y) / 2, 2 * (MAX.x - MIN.x), 2 * (MAX.y - MIN.y), Resources.grid));
  grid.z = -9;
  this.grid = grid;

  var right = fg.add(Object.create(TiledBackground).init((WIDTH + MAX.x) / 2 + 8, HEIGHT / 2, WIDTH - MAX.x, HEIGHT, Resources.wall));
  right.z = 12;

  var left = fg.add(Object.create(TiledBackground).init(16, HEIGHT / 2, 32, HEIGHT, Resources.wall));
  left.z = 12;

  var ceiling = fg.add(Object.create(TiledBackground).init(WIDTH / 2, MIN.y / 2, WIDTH, 16, Resources.sky));
  ceiling.z = 15;
  var ceilingcover = fg.add(Object.create(Entity).init(WIDTH / 2, MIN.y / 2 - 4, WIDTH, MIN.y - 8));
  ceilingcover.z = 14;

  var skyline = fg.add(Object.create(TiledBackground).init(WIDTH / 2, MAX.y + 8, WIDTH, 16, Resources.skyline));
  skyline.z = 15;
  var skylinecover = fg.add(Object.create(Entity).init(WIDTH / 2, (HEIGHT + MAX.y) / 2 + 4, WIDTH, (HEIGHT - MAX.y) - 8));
  skylinecover.z = 14;

  var ground = fg.add(Object.create(TiledBackground).init(WIDTH / 2, MAX.y + 12, WIDTH, 8, Resources.ground));
  ground.z = 16;


  /*var title = fg.add(Object.create(SpriteFont).init(gameWorld.width / 2 + 6, gameWorld.height - 20, Resources.expire_font, "tutorial", {spacing: -2, align: "center"}));
  title.scale = 3;
  title.z = 10;*/

  /* player */
  var player_coordinates = toGrid(WIDTH / 2, HEIGHT / 2);
  player = fg.add(Object.create(Sprite).init(player_coordinates.x, player_coordinates.y, Resources.viper));
  player.cursor = fg.add(Object.create(Sprite).init(player.x, player.y, Resources.target));
  player.cursor.addBehavior(Follow, {target: player, offset: {x: 0, y: 0}});
  player.cursor.offset = {x: TILESIZE, y: 0};
  
  player.setCollision(Polygon);
  player.collision.onHandle = function (object, other) {
    if (other.projectile) {
      particles(other, 15, 3);
      object.layer.camera.addBehavior(Shake, {duration: 1, min: -60, max: 60});
      object.animation = 1;
      object.addBehavior(Delay, {duration: 0.5, callback: function () { this.entity.animation = 0; this.entity.removeBehavior(this); }}); 
    }
  }
  player.move = Movement.standard;
  player.speed = 6.5;
  player.targets = [];
  player.family = "player";
  player.z = 10;
  player.distance = TILESIZE;
  player.min = {x: 16, y: 16};
  player.max = {x: WIDTH - 16, y: HEIGHT - 16};
  player.stopped = function () {
    return !this.lerpx && !this.lerpy;
  };
  player.turn = function (angle) {
    this.angle = angle;
    player.cursor.offset = {x: TILESIZE * Math.cos(player.angle), y: TILESIZE * Math.sin(player.angle)};    
  };

  this.player = player;
  this.fg = fg;
  
  this.pause = function () {
    if (player.stopped()) {
      this.fg.paused = true;
      player.cursor.opacity = 1;
      console.log('what!');
    }
  };
  this.unpause = function () {
    this.fg.paused = false;
  };

  var down = function (e) {
    if (s.fg.active && s.fg.paused) {
      var b = s.fg.onButton(e.x, e.y);
      if (b) {
        b.trigger();
        return;
      }
    }
    if (s.player.stopped()) {
      s.player.turn(Math.round(angle(s.player.x - s.fg.camera.x, s.player.y - s.fg.camera.y, e.x, e.y) / (PI / 2)) * PI / 2);
      s.player.move(s);
    } else {
      s.player.buffer = Math.round(angle(s.player.x - s.fg.camera.x, s.player.y - s.fg.camera.y, e.x, e.y) / (PI / 2)) * PI / 2;
    }
  };
  var move = function (e) {
    if (s.fg.active) {
      var b = s.fg.onButton(e.x, e.y);
      if (b) {
        b.hover();
      }
      var buttons = s.fg.entities.filter( function (e) { return e.family == "button"; });
      for (var i = 0; i < buttons.length; i++) {
        if (buttons[i] != b && buttons[i].unhover) {
          buttons[i].unhover();
        }
      }
      //return;
    }
    if (s.player.stopped()) {
      //if (s.player.velocity.x === 0 && s.player.velocity.y === 0) {
        s.player.angle = Math.round(angle(s.player.x - s.fg.camera.x, s.player.y - s.fg.camera.y, e.x, e.y) / (PI / 2)) * PI / 2;
      //}
    }
  };
  
  var up = function (e) {
  };



  var menu_text = this.fg.add(Object.create(SpriteFont).init(gameWorld.width / 2 - 60, 12, Resources.expire_font, "menu", {align: "center", spacing: -2}));
  var menu_button = this.fg.add(Object.create(Entity).init(gameWorld.width / 2 - 60, 12, 120, 16));
  menu_button.family = "button";
  menu_text.scale = 2;
  menu_text.z = 1000;
  menu_button.opacity = 0;
  menu_button.text = menu_text;
  menu_button.trigger = function () {
    if (s.fg.paused) {
      gameWorld.setScene(0, true);
      gameWorld.saved = true;
      gameWorld.playSound(Resources.select);
    }
  };
  menu_button.hover = bracketHover;
  menu_button.unhover = bracketUnhover;
  
  var mute_text = this.fg.add(Object.create(SpriteFont).init(gameWorld.width / 2 + 60, 12, Resources.expire_font, "mute", {align: "center", spacing: -2}));
  var mute_button = this.fg.add(Object.create(Entity).init(gameWorld.width / 2 + 60, 12, 120, 16));
  mute_button.family = "button";
  mute_text.scale = 2;
  mute_text.z = 1000;
  mute_button.opacity = 0;
  mute_button.text = mute_text;
  if (gameWorld.muted) {
    mute_text.opacity = 0.8;
  }
  mute_button.trigger = function () {
    if (gameWorld.muted) {
      mute_text.opacity = 1;
      gameWorld.unmute();
    } else {
      mute_text.opacity = 0.8;
      gameWorld.mute();
    }
  };
  mute_button.hover = bracketHover;
  mute_button.unhover = bracketUnhover;

  if (MODE !== MODES.touch) {
    this.onMouseDown = down;
    this.onMouseMove = move;
  }

  // swipe controls
  this.touch = {x: 0, y: 0};  

  this.onTouchStart = function (e) {
    if (!fullscreen) {
      requestFullScreen();
    } else {
      s.touch = e.touch;
    }
  }
  this.onTouchEnd = function (e) {
    e.x = e.touch.x, e.y = e.touch.y;
    var layer = s.fg;  
    if (layer.active && s.fg.paused) {
      var b = layer.onButton(e.x, e.y);
      if (b) {
        b.trigger();
        return;
      }
    }
    if (s.player.stopped()) {
      s.player.turn(Math.round(angle(s.touch.x, s.touch.y, e.x, e.y) / (PI / 2)) * PI / 2);
      s.player.move(s);
    }
  };
  this.onTouchMove = function (e) {
    e.x = e.touch.x, e.y = e.touch.y;
    var layer = s.fg;
    if (layer.active) {
      var b = layer.onButton(e.x, e.y);
      if (b) {
        b.hover();
      }
      var buttons = layer.entities.filter( function (e) { return e.family == "button"; });
      for (var i = 0; i < buttons.length; i++) {
        if (buttons[i] != b && buttons[i].unhover) {
          buttons[i].unhover();
        }
      }
    }
    s.player.turn(Math.round(angle(s.touch.x, s.touch.y, e.x, e.y) / (PI / 2)) * PI / 2);
  };


  this.onKeyDown = function (e) {
    if ([37,38,39,40].indexOf(e.keyCode) !== -1 && s.player.stopped()) {
      s.player.turn(directions[e.keyCode]);
      s.player.move(s);
    } else if ([37,38,39,40].indexOf(e.keyCode) !== -1) {
      s.player.buffer = directions[e.keyCode];
    }
    switch (e.keyCode) {
      case 13:
        if (start) {
          start.trigger();
        }
        break;
      case 27:
        menu_button.trigger();
        break;
    }
  }


  this.pause();
};

var onUpdate = function () {

  if (this.condition && this.condition()) {
    this.message.text = this.steps[this.step][0][MODE % this.steps[this.step][0].length];
    this.condition = this.steps[this.step][1];
    this.steps[this.step][2]();
    this.step += 1;
  }
  this.player.checkCollisions(0, this.enemies);

  for (var i = this.enemies.length - 1; i >= 0; i--) {
    if (!between(this.enemies[i].x, MIN.x - 1, MAX.x + 1) || !between(this.enemies[i].y, MIN.y - 1, MAX.y + 1)) {
      if (this.enemies[i].projectile) {
          gameWorld.playSound(Resources.hit_small);
          projectileDie(this.enemies[i]);
      } else if (this.enemies[i].die) {
        this.enemies[i].die();
      } else {
        this.enemies[i].alive = false;
      }
    }
    if (!this.enemies[i].alive) {
      this.enemies.splice(i, 1);
    }
  }

  if (this.player.stopped() && this.player.buffer !== undefined) {
    this.player.turn(this.player.buffer);
    this.player.move(this);
    this.player.buffer = undefined;
  }
};