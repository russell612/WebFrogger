import "./style.css";
import { interval, fromEvent, zip, from, onErrorResumeNext, Observable, pipe} from "rxjs";
import { map, filter, take, count, scan, takeWhile, merge } from "rxjs/operators";

function main() {
  /**
   * Inside this function you will use the classes and functions from rx.js
   * to add visuals to the svg element in pong.html, animate them, and make them interactive.
   *
   * Study and complete the tasks in observable examples first to get ideas.
   *
   * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
   *
   * You will be marked on your functional programming style
   * as well as the functionality that you implement.
   *
   * Document your code!
   */

  // initialises the types used for the game as well as state with its required values
  type key = "w" | "s" | "a" | "d" | "Enter";

  // Obstacle type with its corresponding attributes and types
  // For circle type obstacles, width and height === radius
  type Obstacle = Readonly<{
    id: string;
    pos: Vec;
    vel: Vec;
    type: string;
    width: number;
    height: number;
  }>;



  type Frog = Readonly<{
    id: string;
    pos: Vec;
    vel: Vec;
    radius: number;
  }>

  // state type that includes states needed to transfer between ticks
  type state = Readonly<{
    time: number ;
    gameOver: Boolean;
    objCount: number;
    obstacles: ReadonlyArray<Obstacle>;
    background: ReadonlyArray<Obstacle>;
    frog: Frog;
    score: number; 
    frogWins: number;
    frogWinPos: ReadonlyArray<Frog>;
    level: number; 
    rngSeed: number;
    lives: number;
    scoreOnLevel: number;
    highScore: number;
  }>

  // Constant Storage
  const Constants = {
    CanvasSize: 900,
    StartObstaclesCount: 10,
    ObstaclesPerRow: 3,
    MininumObstacleWidth: 100,
    Rows: 8
  } as const

  // Vector class that was referenced from the Asteroid game template. Helps in maintaining positioning of object that move 
  // around the map
  class Vec {
    constructor(public readonly x: number = 0, public readonly y: number = 0) {}
    add = (b:Vec) => new Vec(this.x + b.x, this.y + b.y);
    sub = (b:Vec) => this.add(b.scale(-1));
    len = ()=> Math.sqrt(this.x*this.x + this.y*this.y);
    scale = (s:number) => new Vec(this.x*s,this.y*s);
    static Zero = new Vec();
  }

  class Reset {}

  // adds the Move class and Tick class to ease in updating the state 
  class Move { constructor(public readonly x:number, public readonly y:number) {}};
  // tick function to initiate updates to obstacle positioning
  const tick = (s:state, elapsed: number) => {

    const 
    bodiesCollided = ([a,b]:[Frog, Obstacle]) => a.pos.sub(new Vec(b.pos.x + b.width/2, b.pos.y + b.height/2)).len() < a.radius + b.width/2,
    bodiesCollidedWater = ([a,b]:[Frog, Obstacle]) => a.pos.sub(new Vec(b.pos.x + b.width/2, b.pos.y + b.height/2)).len() < b.width/2,
    winCondition = (a: Frog) => a.pos.y < 100,
    wonSquare = s.obstacles.filter(r => r.pos.y === 0).filter(r => bodiesCollided([s.frog, r])),
    winConditionhandler = (a: Frog) => {
      const createWinFrogSVG = () => {
        const frog = document.createElementNS(svg.namespaceURI, "circle")
        frog.setAttribute("id", wonSquare[0].id + "frog");
        frog.setAttribute("cx", String(wonSquare[0].pos.x + wonSquare[0].width/2));
        frog.setAttribute("cy", String(wonSquare[0].pos.y + 50));
        frog.setAttribute("r", String(a.radius));
        frog.setAttribute("style", "fill: green");
        svg.appendChild(frog);
        return 900
      }
      const frogScore = document.getElementById(wonSquare[0].id + "frog") ?  -100 : createWinFrogSVG();
      return frogScore
    }

    const createWinFrog = () => {
      return <Frog>{
        id: wonSquare[0].id + "frog",
        pos: new Vec(wonSquare[0].pos.x + wonSquare[0].width/2, wonSquare[0].pos.y + 50),
        vel: Vec.Zero,
        radius: 30
      }
    },

    frogCollidedRiver = s.obstacles.filter(r=> r.type === "rect-river").filter(r=> (r.pos.y + r.height/2) === s.frog.pos.y).filter(r => bodiesCollidedWater([s.frog, r])).length == 0,
    frogCollidedGround = s.obstacles.filter(r=> r.type === "rect-ground").filter(r=> (r.pos.y + r.height/2) === s.frog.pos.y).filter(r => bodiesCollided([s.frog, r])).length > 0,
    frogRiver = s.obstacles.filter(r=> (r.pos.y + r.height/2) === s.frog.pos.y).map(x => x.type === "rect-river" ? true : false)[0] === true;
    if (s.frogWins == 5) {
      s.obstacles.forEach(b => {
        const v = document.getElementById(b.id);
        v?.remove();
      })
      s.background.forEach(b => {
        const v = document.getElementById(b.id);
        v?.remove();
      })
      s.frogWinPos.forEach(b => {
        const v = document.getElementById(b.id);
        v?.remove();
      })
      const frogUpdate = document.getElementById("frogUpdate")
      frogUpdate?.remove();
      return stateInit(s)
    }
    if (s.gameOver) {
      if (s.lives === 0) {
        const v = document.createElementNS(svg.namespaceURI, "text")!;
        v.setAttribute("x", "48%");
        v.setAttribute("y", String(Constants.CanvasSize/2 - 50));
        v.setAttribute("class", "gameover");
        v.setAttribute("id", "gameover")
        v.textContent = "Game Over";
        svg.appendChild(v);
        const v2 = document.createElementNS(svg.namespaceURI, "text")!;
        v2.setAttribute("x", "50%");
        v2.setAttribute("y", String(Constants.CanvasSize/2 + 50));
        v2.setAttribute("class", "restart");
        v2.setAttribute("id", "gameover2")
        v2.textContent = "Press Enter to Restart Game";
        svg.appendChild(v2);        
      }
      else {
        return <state> {
          ...s,
          lives: s.lives - 1,
          frog: createFrog(),
          gameOver: false,
          score: s.score - s.scoreOnLevel,
          scoreOnLevel: 0
        }
      }
    }
    return <state> {
      ...s,
      frog: {
        ...s.frog,
        pos: winCondition(s.frog) ? new Vec(450, Constants.CanvasSize - 50) : s.frog.pos
      },
      obstacles: s.gameOver ? s.obstacles: s.obstacles.map(moveObs),
      time: elapsed,
      gameOver: frogRiver ? frogCollidedRiver: frogCollidedGround,
      frogWins: winCondition(s.frog) ? document.getElementById(wonSquare[0].id + "frog") ? s.frogWins : s.frogWins + 1: s.frogWins,
      frogWinPos: winCondition(s.frog) ? document.getElementById(wonSquare[0].id + "frog") ?  s.frogWinPos : [createWinFrog()].concat(s.frogWinPos) : s.frogWinPos,
      score: winCondition(s.frog) ? s.score + winConditionhandler(s.frog) : s.score,
      scoreOnLevel: winCondition(s.frog) ? 0 : s.scoreOnLevel,
      highScore: s.score > s.highScore ? s.score : s.highScore
    }
  }
  class Tick { constructor(public readonly time: number) {}};



  // Initialises initial game state

  // Function to return the frog back to the opposite side of the canvas if it has passed through
  // the canvas boundaries
  const 
  torusWrap = ({x,y}:Vec) => { 
    const wrap = (v:number) => 
      v < 0 ? v + Constants.CanvasSize : v > Constants.CanvasSize ? v - Constants.CanvasSize : v;
    const wrapY = (v: number) =>
      v > Constants.CanvasSize ? 850 : v
    return new Vec(wrap(x),wrapY(y))
  };



  /* Function reduceState to update the state of the game, checks for whether it is just a tick update or if the frog has moved at the latest tick. 
  More features to be added soon that includes updating state to check collision etc.
  */
  function reduceState(s: state, e: Move|Tick|Reset): state {
     return e instanceof Move ? {...s,
      score: s.score - (torusWrap(s.frog.pos.add(new Vec(e.x, e.y))).y === 850 ? torusWrap(s.frog.pos.add(new Vec(e.x, e.y))).y - 850 : e.y),
      scoreOnLevel: s.scoreOnLevel - (torusWrap(s.frog.pos.add(new Vec(e.x, e.y))).y === 850 ? torusWrap(s.frog.pos.add(new Vec(e.x, e.y))).y - 850 : e.y),
      frog: {
        ...s.frog,
        pos: s.gameOver ? s.frog.pos : torusWrap(s.frog.pos.add(new Vec(e.x, e.y))),
      }
     } : e instanceof Reset ? 
    reset(s)
    :
     tick(s, e.time);
  }

  function reset(s:state) {
    s.obstacles.forEach(b => {
      const v = document.getElementById(b.id);
      v?.remove();
    })
    s.background.forEach(b => {
      const v = document.getElementById(b.id);
      v?.remove();
    })
    s.frogWinPos.forEach(b => {
      const v = document.getElementById(b.id);
      v?.remove();
    })
    const frogUpdate = document.getElementById("frogUpdate")
    frogUpdate?.remove();
    return stateInit({
      ...s, gameOver: false, objCount: 0, obstacles: [], background: [], frog: createFrog(), score: 0, frogWins: 0, level: 1, rngSeed: 80, frogWinPos: [], lives: 5, scoreOnLevel: 0, highScore: s.highScore
    })
  }
  // Function moveObs to move Obstacles
  const moveObs = (o: Obstacle) => <Obstacle>{
    ...o,
    pos: torusWrap(o.pos.sub(o.vel))
  }

  // Function to create obstacles or background
  const createObstacle = (type: "rect-ground" | "rect-river" | "river" | "ground" | "turtle" | "goal") => (id: number) => (width: number) => (height : number) => (pos: Vec) => (vel:Vec) =>
    <Obstacle> {
      pos: pos,
      vel: vel,
      type: type,
      id: type + id,
      width: width,
      height: height
    }

  class RNG {
      // LCG using GCC's constants
      m = 0x80000000; // 2**31
      a = 1103515245;
      c = 12345;
      state: number;
      constructor(seed: number) {
        this.state = seed ? seed : Math.floor(Math.random() * (this.m - 1));
      }
      nextInt() {
        this.state = (this.a * this.state + this.c) % this.m;
        return this.state;
      }
      nextFloat() {
        // returns in range [0,1]
        return this.nextInt() / (this.m - 1);
      }
    }


  // Adds random backgrounds into the mix for potential additional levels
  function createBackgrounds(s: state): state {
    const rng = new RNG(s.rngSeed * 2)
    const nextType = () => rng.nextFloat() > 0.6 ? "river" : "ground";
    const background = [...Array(Constants.Rows)]
      .map((_,i) => createObstacle(nextType())(i + 100)(Constants.CanvasSize)(100)(new Vec(0, i * 100))(new Vec(0,0)));

    return <state>{
      ...s,
      background: background
    }
  }




  const riverCollided = ([a,b]:[number,Obstacle]) => b.type === "river" && a > b.pos.y && a < b.pos.y + b.height  

  function createObstacles(s: state): state{

    const rng = new RNG(s.rngSeed); 

      
    const nextRandom = () => rng.nextFloat() * 50;

    const nextRandomX = () => rng.nextFloat() * 900;

    // pseudo-random distribution of river to ground background types
      const obstacleRow0 = [...Array(Constants.ObstaclesPerRow)]
        .map((_,i) => riverCollided([110, s.background[1]]) ? createObstacle("rect-river")(i + 10)(Constants.MininumObstacleWidth + nextRandom())(80)(new Vec(nextRandomX(), 110))(new Vec(-1.2, 0)): 
        createObstacle("rect-ground")(i + 10)(Constants.MininumObstacleWidth + nextRandom())(80)(new Vec(nextRandomX(), 110))(new Vec(-1.2 * s.level, 0)));
      const obstacleRow1 = [...Array(Constants.ObstaclesPerRow)]
      .map((_,i) => riverCollided([210, s.background[2]]) ? createObstacle("rect-river")(i + 20)(Constants.MininumObstacleWidth + nextRandom())(80)(new Vec(nextRandomX(), 210))(new Vec(1 * s.level, 0)): 
      createObstacle("rect-ground")(i + 20)(Constants.MininumObstacleWidth + nextRandom())(80)(new Vec(nextRandomX(), 210))(new Vec(1* s.level, 0)));
      const obstacleRow2 = [...Array(Constants.ObstaclesPerRow)]
      .map((_,i) => riverCollided([310, s.background[3]]) ? createObstacle("rect-river")(i + 30)(Constants.MininumObstacleWidth + nextRandom())(80)(new Vec(nextRandomX(), 310))(new Vec(-0.5 * s.level, 0)): 
      createObstacle("rect-ground")(i + 30)(Constants.MininumObstacleWidth + nextRandom())(80)(new Vec(nextRandomX(), 310))(new Vec(-0.5 * s.level, 0)));
      const obstacleRow3 = [...Array(Constants.ObstaclesPerRow)]
      .map((_,i) => riverCollided([510, s.background[5]]) ? createObstacle("rect-river")(i + 50)(Constants.MininumObstacleWidth + nextRandom())(80)(new Vec(nextRandomX(), 510))(new Vec(1.3 * s.level, 0)): 
      createObstacle("rect-ground")(i + 50)(Constants.MininumObstacleWidth + nextRandom())(80)(new Vec(nextRandomX(), 510))(new Vec(1.3 * s.level, 0)));
      const obstacleRow4 = [...Array(Constants.ObstaclesPerRow)]
      .map((_,i) => riverCollided([610, s.background[6]]) ? createObstacle("rect-river")(i + 60)(Constants.MininumObstacleWidth + nextRandom())(80)(new Vec(nextRandomX(), 610))(new Vec(-0.7 * s.level, 0)): 
      createObstacle("rect-ground")(i + 60)(Constants.MininumObstacleWidth + nextRandom())(80)(new Vec(nextRandomX(), 610))(new Vec(-0.7 * s.level, 0)));
      const obstacleRow5 = [...Array(Constants.CanvasSize/100)]
      .map((_,i) => createObstacle("goal")(i)(Constants.CanvasSize/5)(100)(new Vec(i * Constants.CanvasSize/5, 0))(new Vec(0, 0)));
      const obstacleRow6 = [...Array(Constants.ObstaclesPerRow)]
      .map((_,i) => riverCollided([710, s.background[7]]) ? createObstacle("rect-river")(i + 70)(Constants.MininumObstacleWidth + nextRandom())(80)(new Vec(nextRandomX(), 710))(new Vec(0.33 * s.level, 0)): 
      createObstacle("rect-ground")(i + 70)(Constants.MininumObstacleWidth + nextRandom())(80)(new Vec(nextRandomX(), 710))(new Vec(0.33 * s.level, 0)));


      // Concatenates all obstacles into one array
    const startingObstacles = obstacleRow1.concat(obstacleRow2, obstacleRow3, obstacleRow4, obstacleRow0, obstacleRow5, obstacleRow6);
    return <state> {
      ...s,
      obstacles: startingObstacles
    }
  }
    // Adds the obstacles to each row
  

  // Initialises the initial state with said obstacles
  function stateInit(s?: state): state {

    const initState: state = s ? {...s, obstacles: [], background: [], frog: createFrog(), frogWins: 0, level: s.level + 0.1, rngSeed: s.rngSeed + 120, frogWinPos: [], lives: s.lives, scoreOnLevel: 0, highScore: s.highScore} : {time: 0, gameOver: false, objCount: 0, obstacles: [], background: [], frog: createFrog(), score: 0, frogWins: 0, level: 1, rngSeed: 200, frogWinPos: [], lives: 5, scoreOnLevel: 0, highScore: 0};
    const stateWithBg: state = createBackgrounds(initState)
    const finalStartState: state = createObstacles(stateWithBg);

    return finalStartState
  }


  /*
  observeKey function 
  base template for processing input from keyboard/mouse and returns an observable of that particular
  input after its processing functions
  parameters: 
  eventName: a string that contains the eventName to be observed
  key: the key that contains the key to be observed
  result: a function that processes the key/eventName that is retrieved
  */
  const observeKey = <T>(eventName:string, k:key , result:() => T) =>
    fromEvent<KeyboardEvent>(document, eventName).pipe(filter(({key}) => key === k),
    map(result));
 
  // observables to monitor frog movement
  const moveLeft = observeKey('keydown', 'a', () => new Move(-20, 0));
  const moveRight = observeKey('keydown', 'd', () => new Move(20, 0));
  const moveUp = observeKey('keydown', 'w', () => new Move(0, -100));
  const moveDown = observeKey('keydown', 's', () => new Move(0, 100));        
  const enterCheck = observeKey("keydown", "Enter", () => new Reset);


  // updates the frogs position and adds in Obstacles if not initialized, else it will update the new positioning
  // of each obstacles per tick and makes sure that frog stays on top of everything
  function updateState(state:state): void {

    const gameOver = document.getElementById("gameover");
    const gameOver2 = document.getElementById("gameover2");
    gameOver?.remove();
    gameOver2?.remove();
    const svg = document.querySelector("#svgCanvas") as SVGElement & HTMLElement;
    const createFrogView = (f: Frog) => {
      const frog = document.createElementNS(svg.namespaceURI, "circle")
      frog.setAttribute("id", f.id);
      frog.setAttribute("cx", String(f.pos.x));
      frog.setAttribute("cy", String(f.pos.y));
      frog.setAttribute("r", String(f.radius));
      frog.setAttribute("style", "fill: green");
      svg.appendChild(frog);
      return frog;
    }
    const frog = document.getElementById("frog") || createFrogView(state.frog);
    frog.setAttribute("cx", `${state.frog.pos.x}`);
    frog.setAttribute("cy", `${state.frog.pos.y}`);
    state.background.forEach(b => {
      const createObstacleView = () => {
        const v = document.createElementNS(svg.namespaceURI, "rect")!;
        v.setAttribute("id", b.id);
        v.classList.add("background");
        v.setAttribute("width", String(b.width));
        v.setAttribute("height", String(b.height));
        v.setAttribute("x", String(b.pos.x));
        v.setAttribute("y", String(b.pos.y));
        b.pos.y === 400 ? v.setAttribute("style" , "fill: none") : b.type === "river" ? v.setAttribute("style", "fill: blue") : v.setAttribute("style", "fill: chocolate")
        svg.appendChild(v)
        return v;
      }
      const v = document.getElementById(b.id) || createObstacleView();
    })
    state.obstacles.forEach(b => {
      const createObstacleView = () => {
        const v = document.createElementNS(svg.namespaceURI, "rect")!;
        v.setAttribute("id", b.id);
        v.setAttribute("width", String(b.width));
        v.setAttribute("height", String(b.height));
        b.type === "goal" ? v.setAttribute("style", "stroke: white;") : b.type === "rect-river" ? v.setAttribute("style", "fill: orange") : v.setAttribute("style", "fill: purple");
        v.classList.add("obstacle");
        svg.appendChild(v)
        return v;
      }
      const v = document.getElementById(b.id) || createObstacleView();
      v.setAttribute("x", String(b.pos.x));
      v.setAttribute("y", String(b.pos.y));
    })
    const createUpdateFrog = () => {    
      const elem = document.createElementNS(svg.namespaceURI, "use");
      elem.setAttribute("href", "#frog");
      elem.setAttribute("id", "frogUpdate");
      svg.appendChild(elem);
    }

    const createScore = () => {
      const v = document.createElementNS(svg.namespaceURI, "text")!;
      v.setAttribute("id", "scoreValue")
      v.setAttribute("class", "score");
      v.setAttribute("x", "100");
      v.setAttribute("y", "870");
      v.setAttribute("style", "fill: white;");
      v.textContent = String(0);
      svg.appendChild(v);
      return v
    }

    const createLives = () => {
      const v = document.createElementNS(svg.namespaceURI, "text");
      v.setAttribute("id", "lifeValue")
      v.setAttribute("class", "lives");
      v.setAttribute("x", "230");
      v.setAttribute("y", "870");
      v.setAttribute("style", "fill: white;");
      v.textContent = String(0);
      svg.appendChild(v);
      return v
    }

    const createHighScore = () => {
      const v = document.createElementNS(svg.namespaceURI, "text");
      v.setAttribute("id", "highScore")
      v.setAttribute("class", "score");
      v.setAttribute("x", "100");
      v.setAttribute("y", "830");
      v.setAttribute("style", "fill: white;");
      v.textContent = String(0);
      svg.appendChild(v);
      return v
    }

    const highScore = document.getElementById("highScore") || createHighScore();
    highScore.textContent = String(state.highScore);
    const lives = document.getElementById("lifeValue") || createLives();
    lives.textContent = String(state.lives);
    const score = document.getElementById("scoreValue") || createScore();
    score.textContent = String(state.score);
    const update = document.getElementById("frogUpdate") || createUpdateFrog();
    console.log
  }


  /**
   * This is the view for your game to add and update your game elements.
   */
  const svg = document.querySelector("#svgCanvas") as SVGElement & HTMLElement;


  // Creates the Frog
  function createFrog(): Frog {
    return {
      id: 'frog',
      pos: new Vec(450, 850),
      vel: Vec.Zero,
      radius: 30
    }
  } 

    // Ticks every 10 ms to update game state and process any new input from the keyboard. Updates the game accordingly using updateState function
  const subscription = interval(10).pipe(map(elapsed => new Tick(elapsed)), merge(moveDown, moveLeft, moveRight, moveUp, enterCheck) ,scan(reduceState, stateInit()), filter(s=> s.gameOver === false)).subscribe(updateState);
}



// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}
