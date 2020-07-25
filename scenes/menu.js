var onStart =  function () {
  
  this.nullaries = [];
  this.negatives = [];
  this.primaries = [];
  this.secondaries = [];
  this.tertiaries = [];
  var s = this;

  Resources.music = Resources.soundtrack;
  //if (gameWorld.soundtrack) gameWorld.soundtrack.stop()
  if (!gameWorld.soundtrack) {
    if (AudioContext) {
      //gameWorld.filter = gameWorld.audioContext.createBiquadFilter();
      //gameWorld.filter.connect(gameWorld.audioContext.destination);
      //gameWorld.filter.type = 'lowpass'; // Low-pass filter. See BiquadFilterNode docs
      //gameWorld.filter.frequency.value = 24000; // Set cutoff to 440 HZ
    }

    gameWorld.musicLoop = function () {
      gameWorld.soundtrack = gameWorld.playSound(Resources.music, 1);
      //gameWorld.soundtrack.connect(gameWorld.filter);
      gameWorld.soundtrack.onended = gameWorld.musicLoop;
    }
    gameWorld.musicLoop();
  }

  var colorize = this.addLayer(Object.create(Layer).init(1000, 1000));
  
  var c = colorize.add(Object.create(Entity).init(gameWorld.width / 2, gameWorld.height / 2, gameWorld.width, gameWorld.height));
  c.color = COLORS.negative;
  this.negatives.push(c);
  
  this.bg = this.addLayer(Object.create(Layer).init(gameWorld.width, gameWorld.height));
  this.bg.active = true;
  
  var back = this.bg.add(Object.create(Entity).init(gameWorld.width / 2, gameWorld.height / 2, gameWorld.width, gameWorld.height));
  back.color = "black";
  back.z = 0;
  this.nullaries.push(back);
/*
  var test = this.bg.add(Object.create(Sprite).init(gameWorld.width / 2, gameWorld.height - 100, Resources.saucer));
  test.addBehavior(KeyFrame, {loop: true, ease: "easeOutQuad", frames: [
    {time: 0, state: {x: test.x + 25, y: test.y}},
    {time: 1, state: {x: test.x + 25, y: test.y + 50}},
    {time: 2, state: {x: test.x - 25, y: test.y + 50}},
    {time: 2.5, state: {x: test.x - 25, y: test.y}},
    {time: 3, state: {x: test.x + 25, y: test.y}}
  ]});
  debug = test;*/
  
  //var grid = this.bg.add(Object.create(TiledBackground).init(MIN.x, MIN.y, 2 * Math.ceil(WIDTH / TILESIZE) * TILESIZE, 2 * Math.ceil(HEIGHT / TILESIZE) * TILESIZE, Resources.grid));
  //grid.z = 1;

  //var title = this.bg.add(Object.create(SpriteFont).init(gameWorld.width / 2, gameWorld.height - 56, Resources.expire_font, "BASTILLE DAY", {spacing: 0, align: "center"}));
  //title.addBehavior(Oscillate, {field: "y", object: title, initial: gameWorld.height / 2, rate: 1, constant: 24});
  //title.blend = "destination-out";
  //title.z = 10;

/*  var boss = this.bg.add(Object.create(Sprite).init(gameWorld.width / 2, gameWorld.height - 64, Resources.boss));
  boss.scale = 2;
  boss.z = 9;*/
  
  var ground = this.bg.add(Object.create(TiledBackground).init(gameWorld.width / 2, gameWorld.height - 16, gameWorld.width, 16, Resources.skyline));
  ground.scale = 2;
  //ground.blend = "destination-out";
  ground.z = 10;

  var title = this.bg.add(Object.create(SpriteFont).init(8, ground.y - 28, Resources.expire_font, "Salvage", {spacing: -2, align: "left"}));
  title.scale = 2;
  title.z = 11;

  var version = this.bg.add(Object.create(SpriteFont).init(gameWorld.width + 16, ground.y - 28, Resources.expire_font, VERSION, {spacing: -2, align: "right"}));
  version.scale = 2;
  version.z = 11;

  /*
  var bubble = this.bg.add(Object.create(TileMap).init(gameWorld.width / 2, gameWorld.height / 2, Resources.bubble, [
    [{x: 0, y: 0}, {x: 0, y: 2}],
    [{x: 1, y: 0}, {x: 1, y: 2}],
    [{x: 1, y: 0}, {x: 1, y: 2}],
    [{x: 1, y: 0}, {x: 1, y: 2}],
    [{x: 1, y: 0}, {x: 1, y: 2}],
    [{x: 1, y: 0}, {x: 1, y: 2}],
    [{x: 2, y: 0}, {x: 2, y: 2}]
  ]));
  bubble.scale = 2;

  for (var i = 0; i < 3; i++) {
    var b = this.bg.add(Object.create(Sprite).init(gameWorld.width / 2, gameWorld.height / 2 + 32 * (i + 1) + 16, Resources.bubble));
    b.frame = i;
    b.animation = 3;
    b.scale = 2;
    b.behaviors = [];
  }*/

/*
  var wall = this.bg.add(Object.create(TiledBackground).init(gameWorld.width * 3 / 4, gameWorld.height / 2, gameWorld.height, 8, Resources.wall));
  wall.angle = PI / 2;
  wall.z = 13;
  var wall2 = this.bg.add(Object.create(TiledBackground).init(gameWorld.width * 3 / 4 - 8, gameWorld.height / 2, gameWorld.height, 8, Resources.wall));
  wall2.angle = -PI / 2;
  wall2.z = 13;
*/

  var buttons = [
    ["new game", function () {
      gameWorld.wave = 1;
      gameWorld.setScene(1, true);
    }],
    ["tutorial", function () {
      gameWorld.setScene(3, true);
    }],
    ["mute", function () {
      if (!gameWorld.muted) {
        this.text.opacity = 0.5;
        gameWorld.mute();
      } else {
        this.text.opacity = 1;
        gameWorld.unmute();
      }
    }],
    ["follow me!", function () {
      window.open("https://twitter.com/e1sif", "_blank");
    }]
  ];
  var button_objects = [];
  var selected = 0;
  var mute_button_text;
  for (var i = 0; i < buttons.length; i++) {
    var b = this.bg.add(Object.create(SpriteFont).init((2 * i + 1) * gameWorld.width / 8, 16, Resources.expire_font, buttons[i][0], {spacing: -3, align: "center"}));
    var button = this.bg.add(Object.create(Entity).init((2 * i + 1) * gameWorld.width / 8, 16, gameWorld.width / 4, 32));
    button.family = "button";
    b.z = 2;
    button.z = 1;
    b.scale = 2;
    //b.blend = "destination-out";
    button.opacity = 0;
    button.text = b;
    if (buttons[i][0] === "mute") { mute_button_text = b; }

    button.hover = bracketHover;
    button.unhover = bracketUnhover;

    button.trigger = buttons[i][1];
    button_objects.push(button);
  }
  if (gameWorld.saved) {
    var b = this.bg.add(Object.create(SpriteFont).init(gameWorld.width / 2, gameWorld.height / 3, Resources.expire_font, "resume current game", {spacing: -3, align: "center"}));
    var button = this.bg.add(Object.create(Entity).init(gameWorld.width / 2, gameWorld.height / 3, gameWorld.width, 32));
    button.family = "button";
    b.z = 2;
    b.scale = 2;
    button.z = 1;
    //b.blend = "destination-out";
    button.opacity = 0;
    button.text = b;
    
    button.hover = bracketHover;
    button.unhover = bracketUnhover;

    button.trigger = function () {
      gameWorld.setScene(1, false);
    };
    button_objects.unshift(button);
  }


  try {    
    if (localStorage && localStorage.salvageMuted == "true") {
      localStorage.salvageMuted = true;
      gameWorld.muted = true;
      window.muted = true;
      mute_button_text.opacity = 0.5;
      if (gameWorld.audioContext && gameWorld.audioContext.suspend)
        gameWorld.audioContext.suspend();
    }
  } catch(err) {
    console.warn("Local Storage could not be accessed.  Make sure cross-domain cookies are permitted.")
  }
  
  var ship = this.bg.add(Object.create(Sprite).init(0, gameWorld.height - 128, Resources.viper));
  ship.addBehavior(Velocity);
  ship.scale = 2;
  ship.velocity = {x: 120, y: 0};
  ship.addBehavior(Wrap, {min: {x: 0, y: 0}, max: {x: gameWorld.width, y: gameWorld.height}});
  ship.z = 12;
  ship.addBehavior(Periodic, {period: 0.8, callback: function () {
    var d = this.entity.layer.add(Object.create(Sprite).init(this.entity.x, this.entity.y, Resources.dust));
    d.z = this.entity.z - 1;
    d.scale = 2;
    d.behaviors[0].onEnd = function () {
      this.entity.alive = false;
    };
    d.addBehavior(Velocity);
    d.velocity = {x: - this.entity.velocity.x, y: 0};
  }});
  //ship.blend = "destination-out";

  var up = function () {
    selected = modulo(selected - 1, button_objects.length);
    for (var i = 0; i < button_objects.length; i++) {
      button_objects[i].unhover();
    }
    button_objects[selected].hover();
  };

  var down = function () {
    selected = modulo(selected + 1, button_objects.length);
    for (var i = 0; i < button_objects.length; i++) {
      button_objects[i].unhover();
    }
    button_objects[selected].hover();
  };

  var go = function () {
    gameWorld.playSound(Resources.select);
    button_objects[selected].trigger();
  };

  var move = function (e) {
    //var buttons = s.bg.entities.filter(function (e) { return e.family === "button"; });
    var b = s.bg.onButton(e.x, e.y);
    if (b) {    
      for (var i = 0; i < button_objects.length; i++) {
        if (b == button_objects[i]) { 
          selected = i;
          b.hover();
        }
        else button_objects[i].unhover();
      }
    }
  }

  if (MODE !== MODES.touch) {    
    this.onMouseDown = function (e) {
      if (MODE === undefined) MODE = MODES.mouse;
      var b = s.bg.onButton(e.x, e.y);
      if (b) {
        b.trigger();
        gameWorld.playSound(Resources.select);
      }
    };
    this.onMouseMove = function (e) {
      move(e);
    };
  }
  this.onTouchStart = function (e) {
    if (fullscreen) {
      e.x = e.touch.x; e.y = e.touch.y;
      move(e);      
    }
  };
  this.onTouchMove = function (e) {
    if (fullscreen) {
      e.x = e.touch.x; e.y = e.touch.y;
      move(e);      
    }
  };
  this.onTouchEnd = function (e) {
    if (!fullscreen) {
      if (MODE === undefined) MODE = MODES.touch;
      requestFullScreen();
      return;
    } else {
      e.x = e.touch.x; e.y = e.touch.y;
      var b = s.bg.onButton(e.x, e.y);
      if (b) {
        b.trigger();
        gameWorld.playSound(Resources.select);
      }
    }
  };
  this.onKeyDown = function (e) {
    if (MODE === undefined) MODE = MODES.keyboard;
    switch (e.keyCode) {
      case 38:
        up();
        break;
      case 40:
        down();
        break;
      case 37:
        up();
        break;
      case 39:
        down();
        break;
      case 13:
        go();
        break;
    }
  };

  for (var i = 0; i < button_objects.length; i++) {
    button_objects[i].unhover();
  }
  button_objects[selected].hover();
}

var onUpdate = function (dt) {
};