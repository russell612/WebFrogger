import "./style.css";
import { interval, fromEvent, zip, from} from "rxjs";
import { map, filter, take, count, scan, last, merge } from "rxjs/operators";

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
  type key = "w" | "s" | "a" | "d";

  // Obstacle type with its corresponding attributes and types
  type Obstacle = Readonly<{
    id: string;
    pos: Vec;
    vel: Vec;
    type: string;
    width: number;
    height: number
  }>;

  type Frog = Readonly<{
    id: string;
    pos: Vec;
    vel: Vec;
    radius: number;
  }>

  // state type that includes states needed to transfer between ticks
  type state = Readonly<{time: number ;gameOver: Boolean, objCount: number, obstacles: ReadonlyArray<Obstacle>, background: ReadonlyArray<Obstacle>, frog: Frog}>;

  // Constant Storage
  const Constants = {
    CanvasSize: 700,
    StartObstaclesCount: 10,
    ObstaclesPerRow: 3,
    MininumObstacleWidth: 100,
    Rows: 6
  } as const

  // adds the Move class and Tick class to ease in updating the state 
  class Move { constructor(public readonly x:number, public readonly y:number) {}};
  // tick function to initiate updates to obstacle positioning
  const tick = (s:state, elapsed: number) => {
    const not = <T>(f:(x:T)=> boolean) => (x:T) => !f(x),
    mergeMap = <T, U>(a: ReadonlyArray<T>, f:(a: T) => ReadonlyArray<U>) => Array.prototype.concat(...a.map(f)), 

    bodiesCollided = ([a,b]:[Frog,Obstacle]) => a.pos.sub(new Vec(b.pos.x + b.width/2, b.pos.y + b.height/2)).len() < a.radius + b.width/2,
    frogCollided = s.obstacles.filter(r=> (r.pos.y + r.height/2) === s.frog.pos.y).filter(r => bodiesCollided([s.frog, r])).length > 0;
    return <state> {
      ...s,
      obstacles: s.obstacles.map(moveObs),
      time: elapsed,
      gameOver: frogCollided
    }
  }
  class Tick { constructor(public readonly time: number) {}};

  // Vector class that was referenced from the Asteroid game template. Helps in maintaining positioning of object that move 
  // around the map
  class Vec {
    constructor(public readonly x: number = 0, public readonly y: number = 0) {}
    add = (b:Vec) => new Vec(this.x + b.x, this.y + b.y)
    sub = (b:Vec) => this.add(b.scale(-1))
    len = ()=> Math.sqrt(this.x*this.x + this.y*this.y)
    scale = (s:number) => new Vec(this.x*s,this.y*s)
    ortho = ()=> new Vec(this.y,-this.x)
    rotate = (deg:number) =>
              (rad =>(
                  (cos,sin,{x,y})=>new Vec(x*cos - y*sin, x*sin + y*cos)
                )(Math.cos(rad), Math.sin(rad), this)
              )(Math.PI * deg / 180)
  
    static unitVecInDirection = (deg: number) => new Vec(0,-1).rotate(deg)
    static Zero = new Vec();
  }

  // Initialises initial game state

  // Function to return the frog back to the opposite side of the canvas if it has passed through
  // the canvas boundaries
  const 
  torusWrap = ({x,y}:Vec) => { 
    const wrap = (v:number) => 
      v < 0 ? v + Constants.CanvasSize : v > Constants.CanvasSize ? v - Constants.CanvasSize : v;
    return new Vec(wrap(x),wrap(y))
  };

  /* Function reduceState to update the state of the game, checks for whether it is just a tick update or if the frog has moved at the latest tick. 
  More features to be added soon that includes updating state to check collision etc.
  */
  function reduceState(s: state, e: Move|Tick): state {
     return e instanceof Move ? {...s,
      frog: {
        ...s.frog,
        pos: torusWrap(s.frog.pos.add(new Vec(e.x, e.y))),
      }
     } :
     tick(s, e.time);
  }

  // Function moveObs to move Obstacles
  const moveObs = (o: Obstacle) => <Obstacle>{
    ...o,
    pos: torusWrap(o.pos.sub(o.vel))
  }

  // Function to create obstacles or background
  const createObstacle = (type: "rect" | "river" | "ground") => (id: number) => (width: number) => (height : number) => (pos: Vec) => (vel:Vec) =>
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

  const rng = new RNG(200);


  const nextRandom = () => rng.nextFloat() * 50;
  const nextRandomX = () => rng.nextFloat() * 600;

  // pseudo-random distribution of river to ground background types
  const nextType = () => rng.nextFloat() > 0.6 ? "river" : "ground";



  // Adds the obstacles to each row
  const obstacleRow0 = [...Array(Constants.ObstaclesPerRow)]
    .map((_,i) => createObstacle("rect")(i + 0)(Constants.MininumObstacleWidth + nextRandom())(80)(new Vec(nextRandomX(), 10))(new Vec(-1.2, 0)));
  const obstacleRow1 = [...Array(Constants.ObstaclesPerRow)]
    .map((_,i) => createObstacle("rect")(i + 10)(Constants.MininumObstacleWidth + nextRandom())(80)(new Vec(nextRandomX(), 110))(new Vec(2, 0)));
  const obstacleRow2 = [...Array(Constants.ObstaclesPerRow)]
    .map((_,i) => createObstacle("rect")(i + 20)(Constants.MininumObstacleWidth + nextRandom())(80)(new Vec(nextRandomX(), 210))(new Vec(0.5, 0)));
  const obstacleRow3 = [...Array(Constants.ObstaclesPerRow)]
    .map((_,i) => createObstacle("rect")(i + 30)(Constants.MininumObstacleWidth + nextRandom())(80)(new Vec(nextRandomX(), 310))(new Vec(-1, 0)));
  const obstacleRow4 = [...Array(Constants.ObstaclesPerRow)]
    .map((_,i) => createObstacle("rect")(i + 40)(Constants.MininumObstacleWidth + nextRandom())(80)(new Vec(nextRandomX(), 410))(new Vec(0.7, 0)));
  const obstacleRow5 = [...Array(Constants.ObstaclesPerRow)]
    .map((_,i) => createObstacle("rect")(i + 50)(Constants.MininumObstacleWidth + nextRandom())(80)(new Vec(nextRandomX(), 510))(new Vec(-0.5, 0)));

  // Adds random backgrounds into the mix for potential additional levels
  const background = [...Array(Constants.Rows)]
    .map((_,i) => createObstacle(nextType())(i + 100)(Constants.CanvasSize)(100)(new Vec(0, i * 100))(new Vec(0,0)));

  const rivers = background.filter(x => x.type === "river");
  const ground = background.filter(x => x.type === "ground");

  // Concatenates all obstacles into one array
  const startingObstacles = obstacleRow1.concat(obstacleRow2, obstacleRow3, obstacleRow4, obstacleRow0, obstacleRow5);
  // Initialises the initial state with said obstacles
  const initState: state = {time: 0, gameOver: false, objCount: 0, obstacles: startingObstacles, background: background, frog: createFrog() };


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
  const moveLeft = observeKey('keydown', 'a', () => new Move(-10, 0));
  const moveRight = observeKey('keydown', 'd', () => new Move(10, 0));
  const moveUp = observeKey('keydown', 'w', () => new Move(0, -100));
  const moveDown = observeKey('keydown', 's', () => new Move(0, 100));

  // updates the frogs position and adds in Obstacles if not initialized, else it will update the new positioning
  // of each obstacles per tick and makes sure that frog stays on top of everything
  function updateState(state:state): void {
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
        b.type === "river" ? v.setAttribute("style", "fill: blue") : v.setAttribute("style", "fill: chocolate");
        svg.appendChild(v)
        return v;
      }
      const v = document.getElementById(b.id) || createObstacleView();
      v.setAttribute("x", String(b.pos.x));
      v.setAttribute("y", String(b.pos.y));
    })
    state.obstacles.forEach(b => {
      const createObstacleView = () => {
        const v = document.createElementNS(svg.namespaceURI, "rect")!;
        v.setAttribute("id", b.id);
        v.classList.add("obstacle")
        svg.appendChild(v)
        return v;
      }
      const v = document.getElementById(b.id) || createObstacleView();
      v.setAttribute("x", String(b.pos.x));
      v.setAttribute("y", String(b.pos.y));
      v.setAttribute("width", String(b.width));
      v.setAttribute("height", String(b.height));
      v.setAttribute("style", "fill: purple");
    })
    const createUpdateFrog = () => {    
      const elem = document.createElementNS(svg.namespaceURI, "use");
      elem.setAttribute("href", "#frog");
      elem.setAttribute("id", "frogupdate");
      svg.appendChild(elem);
    }
    const update = document.getElementById("frogupdate") || createUpdateFrog();

    if (state.gameOver) {
      const v = document.createElementNS(svg.namespaceURI, "text")!;
      v.setAttribute("x", String(Constants.CanvasSize/7 + 25));
      v.setAttribute("y", String(Constants.CanvasSize/2));
      v.setAttribute("class", "gameover");
      v.textContent = "Game Over";
      svg.appendChild(v);
      subscription.unsubscribe();
    }
  }


  /**
   * This is the view for your game to add and update your game elements.
   */
  const svg = document.querySelector("#svgCanvas") as SVGElement & HTMLElement;


  // Creates the Frog
  function createFrog(): Frog {
    return {
      id: 'frog',
      pos: new Vec(350, 650),
      vel: Vec.Zero,
      radius: 30
    }
  } 
    // Ticks every 10 ms to update game state and process any new input from the keyboard. Updates the game accordingly using updateState function
  const subscription = interval(10).pipe(map(elapsed => new Tick(elapsed)), merge(moveDown, moveLeft, moveRight, moveUp) ,scan(reduceState, initState)).subscribe(updateState);
}



// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}
