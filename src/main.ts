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
    width: number;
    height: number
  }>;

  // state type that includes states needed to transfer between ticks
  type state = Readonly<{pos: Vec; time: number ;gameOver: Boolean, objCount: number, obstacles: ReadonlyArray<Obstacle>}>;

  // Constant Storage
  const Constants = {
    CanvasSize: 600,
    StartObstaclesCount: 10,
    ObstaclesPerRow: 3,
    MininumObstacleWidth: 100
  } as const

  // adds the Move class and Tick class to ease in updating the state 
  class Move { constructor(public readonly x:number, public readonly y:number) {}};
  // tick function to initiate updates to obstacle positioning
  const tick = (s:state, elapsed: number) => {
    return <state> {
      ...s,
      obstacles: s.obstacles.map(moveObs),
      time: elapsed
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
      pos: torusWrap(s.pos.add(new Vec(e.x, e.y))),
     } :
     tick(s, e.time);
  }

  // Function moveObs to move Obstacles
  const moveObs = (o: Obstacle) => <Obstacle>{
    ...o,
    pos: torusWrap(o.pos.sub(o.vel))
  }

  // Function to create obstacle
  const createObstacle = (type: "rect") => (id: number) => (width: number) => (height : number) => (pos: Vec) => (vel:Vec) =>
    <Obstacle> {
      pos: pos,
      vel: vel,
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


  // Adds the obstacles to each row
  const obstacleRow0 = [...Array(Constants.ObstaclesPerRow)]
    .map((_,i) => createObstacle("rect")(i + 0)(Constants.MininumObstacleWidth + nextRandom())(80)(new Vec(nextRandomX(), 10))(new Vec(-1.2, 0)))
  const obstacleRow1 = [...Array(Constants.ObstaclesPerRow)]
    .map((_,i) => createObstacle("rect")(i + 10)(Constants.MininumObstacleWidth + nextRandom())(80)(new Vec(nextRandomX(), 110))(new Vec(2, 0)))
  const obstacleRow2 = [...Array(Constants.ObstaclesPerRow)]
    .map((_,i) => createObstacle("rect")(i + 20)(Constants.MininumObstacleWidth + nextRandom())(80)(new Vec(nextRandomX(), 210))(new Vec(0.5, 0)))
  const obstacleRow3 = [...Array(Constants.ObstaclesPerRow)]
    .map((_,i) => createObstacle("rect")(i + 30)(Constants.MininumObstacleWidth + nextRandom())(80)(new Vec(nextRandomX(), 310))(new Vec(-1, 0)))
  const obstacleRow4 = [...Array(Constants.ObstaclesPerRow)]
    .map((_,i) => createObstacle("rect")(i + 40)(Constants.MininumObstacleWidth + nextRandom())(80)(new Vec(nextRandomX(), 410))(new Vec(0.7, 0)))

  // Concatenates all obstacles into one array
  const startingObstacles = obstacleRow1.concat(obstacleRow2, obstacleRow3, obstacleRow4, obstacleRow0);
  // Initialises the initial state with said obstacles
  const initState: state = {pos: new Vec(100, 550), time: 0, gameOver: false, objCount: 0, obstacles: startingObstacles};


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
  // of each obstacles per tick
  function updateState(state:state): void {
    const svg = document.querySelector("#svgCanvas") as SVGElement & HTMLElement;
    const frog = document.getElementById("frog")!;
    frog.setAttribute("cx", `${state.pos.x}`);
    frog.setAttribute("cy", `${state.pos.y}`);
    state.gameOver ? alert("Game Over") : null;  
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
  }

  // Ticks every 10 ms to update game state and process any new input from the keyboard. Updates the game accordingly using updateState function
  interval(10).pipe(map(elapsed => new Tick(elapsed)), merge(moveDown, moveLeft, moveRight, moveUp) ,scan(reduceState, initState)).subscribe(updateState);

  /**
   * This is the view for your game to add and update your game elements.
   */
  const svg = document.querySelector("#svgCanvas") as SVGElement & HTMLElement;

  // Sets the attributes for the background which includes a river and 2 ground sections
  const river = document.createElementNS(svg.namespaceURI, "rect");
  river.setAttribute("width", "600");
  river.setAttribute("height", "100");
  river.setAttribute("x", "0");
  river.setAttribute("y", "200");
  river.setAttribute("style", "fill: blue;");

  const ground = document.createElementNS(svg.namespaceURI, "rect");
  ground.setAttribute("width", "600");
  ground.setAttribute("height", "200");
  ground.setAttribute("x", "0");
  ground.setAttribute("y", "0");
  ground.setAttribute("style", "fill: chocolate;");

  const ground2 = document.createElementNS(svg.namespaceURI, "rect");
  ground2.setAttribute("width", "600");
  ground2.setAttribute("height", "200");
  ground2.setAttribute("x", "0");
  ground2.setAttribute("y", "300");
  ground2.setAttribute("style", "fill: chocolate;");


  // Example on adding an element
  const frog = document.createElementNS(svg.namespaceURI, "circle");
  frog.setAttribute("r", "30");
  frog.setAttribute("cx", "100");
  frog.setAttribute("cy", "550");
  frog.setAttribute("id", "frog");
  frog.setAttribute(
    "style",
    "fill: green; stroke: green; stroke-width: 1px;"
  );
  
  // appends each background element to the svgCanvas
  svg.appendChild(river);
  svg.appendChild(ground);
  svg.appendChild(ground2);
  svg.appendChild(frog);

}



// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}
