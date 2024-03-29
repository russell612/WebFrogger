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
    status: string;
  }>;

  //Frog type with the required attributes
  type Frog = Readonly<{
    id: string;
    pos: Vec;
    vel: Vec;
    radius: number;
  }>

  // state type that includes statuses and objects needed to transfer between ticks
  type state = Readonly<{
    time: number ;
    gameOver: Boolean;
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
    reset: boolean;
    fly: ReadonlyArray<Obstacle>;
    flyEaten : boolean
  }>

  // Constant Storage
  const CONSTANTS = {
    CanvasSize: 900,
    StartObstaclesCount: 10,
    ObstaclesPerRow: 3,
    MininumObstacleWidth: 180,
    Rows: 8,
    ObstacleHeight: 80,
    BackgroundHeight: 100
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

  //Reset indicator Class
  class Reset {}

  // adds the Move class and Tick class to ease in updating the state 
  class Move { constructor(public readonly x:number, public readonly y:number) {}};
  // tick function to initiate updates on the game State
  const tick = (s:state, elapsed: number) => {

    const 
    //Checks if an Obstacle has collided with the frog
    bodiesCollided = ([a,b]:[Frog, Obstacle]) => a.pos.sub(new Vec(b.pos.x + b.width/2, b.pos.y + b.height/2)).len() < a.radius + b.width/2,
    //Different Collision Detection for river background
    bodiesCollidedWater = ([a,b]:[Frog, Obstacle]) => a.pos.sub(new Vec(b.pos.x + b.width/2, b.pos.y + b.height/2)).len() < b.width/2,
    //The win condition of the game
    winCondition = (a: Frog) => a.pos.y < 100,
    //wonSquare is using bodiesCollided to check which winning square has the frog entered
    wonSquare = s.obstacles.filter(r => r.pos.y === 0).filter(r=> r.type === "goal").filter(r => bodiesCollided([s.frog, r])),
    frogColliddedFly = s.fly.filter(r=>bodiesCollided([s.frog, r]))

    // Checks if the level is finished, it will return a state with the reset boolean true to indicate removing all svg elements to start a new level.
    if (s.frogWins === 5 && s.reset === false) {
      return <state>{
        ...s,
        reset:true,
        elapsed: elapsed
      }
    }
    // Function in creating a frog object to be displayed in the middle of the winning square

    // Boolean to check if the frog has hit the water in the river
    const frogCollidedRiver = s.obstacles.filter(r=> (r.pos.y + r.height/2) === s.frog.pos.y).filter(r=> r.pos.y !== 0 ).filter(r => bodiesCollidedWater([s.frog, r])).length == 0,
    // Special Boolean to check for Crocodiles, will register that the frog is on the crocodile if its status is "Clear", else it will act like it is not there and cause the player to lose
    frogCollidedCroc = s.obstacles.filter(r => (r.pos.y + r.height/2) === s.frog.pos.y).filter(r=> r.pos.y !== 0 ).filter(r => r.type === "croc").filter(r => bodiesCollided([s.frog, r])).filter(r => r.status === "Danger").length > 0,
    // Boolean to check if the frog has hit any obstacles on the ground
    frogCollidedGround = s.obstacles.filter(r=> (r.pos.y + r.height/2) === s.frog.pos.y).filter(r=> r.pos.y !== 0 ).filter(r => bodiesCollided([s.frog, r])).length > 0,
    // To check if the frog is on a river row
    frogRiver = s.obstacles.filter(r=> (r.pos.y + r.height/2) === s.frog.pos.y).map(x => x.type === "rect-river" ? true : false)[0] === true;
    // If the frog has hit river or obstacle on ground, gameOver will be true
    if (s.gameOver) { 
      return gameOverHandler(s)
    }
    if (s.reset === true) { 
      return stateInit(s)
    }

    if (winCondition(s.frog)) {
      return winConditionHandler(s, wonSquare, frogColliddedFly)
    }

    function handleObstacles(): ReadonlyArray<Obstacle> {
      if(s.gameOver) {
        // If game over, no need to update obstacles
        return s.obstacles
      }
      else {
        // Else if not, checks after a certain time period has passed to change the Crocodile's status
        return s.obstacles.map(x => x.type === "croc" ? s.time % 800 - (s.level*20) > 250 ? <Obstacle> {...x, status: "Clear"} : {...x,status: "Danger"}: {...x, status: "None"}).map(moveObs)
      }
    }

    //Function to handle the visibility of the fly
    function handleFly(): ReadonlyArray<Obstacle> {
      if (s.fly.length === 0) {
        return s.fly
      }
      else {
        return s.fly.map(x=> (s.time % 600 - (s.level*30)) <  250 ? <Obstacle>{...x, status: "non-hidden"} : {...x, status:"hidden"})
      }
    }


    return <state> { // Returns a general new tick to check for winCondition and collisions
      ...s,
      obstacles: handleObstacles(), // Function for ease of reading
      fly: handleFly(),
      time: elapsed,
      gameOver: frogRiver ? (frogCollidedRiver || frogCollidedCroc) : frogCollidedGround,
      highScore: s.score > s.highScore ? s.score : s.highScore,
      reset: s.frogWins === 5 ? true : false
    }
  }

  function winConditionHandler(s:state, wonSquare: Obstacle[], fly: Obstacle[]): state {

    // Creates a winning frog at the middle of the winning square
    const createWinFrog = () => {
      return <Frog>{
        id: wonSquare[0].id + "frog",
        pos: new Vec(wonSquare[0].pos.x + wonSquare[0].width/2, wonSquare[0].pos.y + 50),
        vel: Vec.Zero,
        radius: 30
      }
    }

    function scoreHandler(): number {
      if (s.frogWinPos.filter(x => x.id === wonSquare[0].id + "frog").length !== 0) {
        return s.score
      }
      else if (fly.length !== 0 && fly[0].status === "hidden") {
        return s.score + 900
      }
      else if (fly.length === 0) {
        return s.score + 900
      }
      else {
        return s.score + 1900
      }
    }
    // Returns state based on if the player has been to that winning square before or not
    return <state> {
      ...s,
      frog: {
        ...s.frog,
        pos: new Vec(450, CONSTANTS.CanvasSize - 50) //Resets frog back to original position
      },
      frogWins: s.frogWinPos.filter(x => x.id === wonSquare[0].id + "frog").length !== 0 ? s.frogWins : s.frogWins + 1, // Checks if the player has gotten this square before, will not add frogWins, score bonus and create a new Winning Frog if true.
      score: scoreHandler(),
      frogWinPos: s.frogWinPos.filter(x => x.id === wonSquare[0].id + "frog").length !== 0 ?  s.frogWinPos : [createWinFrog()].concat(s.frogWinPos),
      scoreOnLevel: 0,
      fly: fly.length !== 0 ? fly[0].status === "hidden" ? s.fly : [] : s.fly,
    }
  }


  function gameOverHandler(s:state): state {
    if(s.lives > 0) { //Checks if all lives is over
      return <state> { //There is still lives, frogs get reset with all previous earned score resetted.
        ...s,
        lives: s.lives - 1,
        frog: createFrog(),
        gameOver: false,
        score: s.score - s.scoreOnLevel,
        scoreOnLevel: 0,
      }
    }
    else {
      return <state> { //Ends the game, as gameOver remains true, proceeds to display Game Over message on screen
        ...s,
        lives: s.lives - 1 ,
        score: s.score - s.scoreOnLevel,
        scoreOnLevel: 0
      }
    }
  }


  //Tick indicator class
  class Tick { constructor(public readonly time: number) {}};


  // Function to return the frog back to the opposite side of the canvas if it has passed through
  // the canvas boundaries, won't work for y-axis to prevent cheating
  const 
  torusWrap = ({x,y}:Vec) => { 
    const wrap = (v:number) => 
      v < 0 ? v + CONSTANTS.CanvasSize : v > CONSTANTS.CanvasSize ? v - CONSTANTS.CanvasSize : v;
    const wrapY = (v: number) =>
      v > CONSTANTS.CanvasSize ? 850 : v
    return new Vec(wrap(x),wrapY(y))
  };



  /* 
  Function reduceState to update the state of the game, checks for whether it is just a tick update or if the frog has moved or if the state needs a reset. 
  */
  function reduceState(s: state, e: Move|Tick|Reset): state {
     return e instanceof Move ? {...s,
      score: s.gameOver ? s.score : s.frog.pos.y === CONSTANTS.CanvasSize - 50 && e.y > 0 ? s.score : s.score - e.y, // If Frog position is at the start and it tries to move downwards, change nothing on the score
      scoreOnLevel: s.gameOver ? s.scoreOnLevel : s.frog.pos.y === CONSTANTS.CanvasSize - 50 && e.y > 0 ? s.scoreOnLevel : s.scoreOnLevel - e.y, // scoreOnLevel to help resetting the score if player died in this level
      frog: {
        ...s.frog,
        pos: s.gameOver ? s.frog.pos : torusWrap(s.frog.pos.add(new Vec(e.x, e.y))), // changes the position of the frog
      }
     } : e instanceof Reset ? 
    reset(s)
    :
     tick(s, e.time);
  }

  // reset function to help in resetting back to first level
  function reset(s:state) {
    return <state>{
      ...s, gameOver: false, objCount: 0, score: 0, frogWins: 0, level: 0.9, rngSeed: 80, lives: 5, scoreOnLevel: 0, highScore: s.highScore, reset: true
    }
  }
  // Function moveObs to move Obstacles
  const moveObs = (o: Obstacle) => <Obstacle>{
    ...o,
    pos: torusWrap(o.pos.sub(o.vel))
  }

  type ObstacleType = "rect-ground" | "rect-river" | "croc" | "river" | "ground" | "goal" | "fly"
  // Function to create obstacles or background
  const createObstacle = (type: ObstacleType) => (id: number) => (width: number) => (height : number) => (pos: Vec) => (vel:Vec) => (status: string) =>
    <Obstacle> {
      pos: pos,
      vel: vel,
      type: type,
      id: type + id,
      width: width,
      height: height,
      status: status
    }


  // Adds backgrounds into the mix for additional levels and adds them into the background array of the game state
  function createBackgrounds(s: state): state {
    const nextType = (s:number) => s <= 3 ? "river" : "ground";
    const background = [...Array(CONSTANTS.Rows)]
      .map((_,i) => createObstacle(nextType(i))(i + 100)(CONSTANTS.CanvasSize)(CONSTANTS.BackgroundHeight)(new Vec(0, i * 100))(new Vec(0,0))("None"));

    return <state>{
      ...s,
      background: background
    }
  }

  //Function used to generate obstacles for an empty state 
  function createObstacles(s: state): state{

      const obstacleRow0 = [...Array(CONSTANTS.ObstaclesPerRow)]
        .map((_,i)  =>  i % 2 == 0 ? createObstacle("rect-river")(i + 10)(CONSTANTS.MininumObstacleWidth - s.level*20)(CONSTANTS.ObstacleHeight)(new Vec(i*300 + i*20, 110))(new Vec(-1.1, 0))("None"): 
        createObstacle("croc")(i + 10)(CONSTANTS.MininumObstacleWidth)(CONSTANTS.ObstacleHeight)(new Vec(i*300 + i*20, 110))(new Vec(-1.1, 0))("Danger"));
      const obstacleRow1 = [...Array(CONSTANTS.ObstaclesPerRow)]
      .map((_,i) =>  i % 2 == 0 ? createObstacle("rect-river")(i + 20)(CONSTANTS.MininumObstacleWidth - s.level*20)(CONSTANTS.ObstacleHeight)(new Vec(i*300 + i*20 + s.rngSeed*s.level, 210))(new Vec(1 * s.level, 0))("None"): 
      createObstacle("croc")(i + 20)(CONSTANTS.MininumObstacleWidth - s.level*10)(CONSTANTS.ObstacleHeight)(new Vec(i*300 + i*20 + s.rngSeed*s.level, 210))(new Vec(1 * s.level, 0))("Danger")); 

      const obstacleRow2 = [...Array(CONSTANTS.ObstaclesPerRow)]
      .map((_,i) => i % 2 == 0 ? createObstacle("rect-river")(i + 30)(CONSTANTS.MininumObstacleWidth - s.level*20)(CONSTANTS.ObstacleHeight)(new Vec(i*300 - i*20 + s.rngSeed*s.level, 310))(new Vec(-0.5 * s.level, 0))("None"):
      createObstacle("croc")(i + 30)(CONSTANTS.MininumObstacleWidth - s.level*20)(CONSTANTS.ObstacleHeight)(new Vec(i*300 - i*20 + s.rngSeed*s.level, 310))(new Vec(-0.5 * s.level, 0))("Danger")); 

      const obstacleRow3 = [...Array(CONSTANTS.ObstaclesPerRow)]
      .map((_,i) =>  
      createObstacle("rect-ground")(i + 50)(CONSTANTS.MininumObstacleWidth - 70 + s.level*5)(CONSTANTS.ObstacleHeight)(new Vec(i*300 + s.rngSeed*s.level, 510))(new Vec(1.3 * s.level, 0))("None"));
      const obstacleRow4 = [...Array(CONSTANTS.ObstaclesPerRow)]
      .map((_,i) =>  
      createObstacle("rect-ground")(i + 60)(CONSTANTS.MininumObstacleWidth - 70 + s.level*5)(CONSTANTS.ObstacleHeight)(new Vec(i*300 - i*20, 610))(new Vec(-0.7 * s.level, 0))("None"));
      const obstacleRow5 = [...Array(5)]
      .map((_,i) => createObstacle("goal")(i)(CONSTANTS.CanvasSize/5)(CONSTANTS.BackgroundHeight)(new Vec(i * CONSTANTS.CanvasSize/5, 0))(new Vec(0, 0))("None"));
      const obstacleRow6 = [...Array(CONSTANTS.ObstaclesPerRow)]
      .map((_,i) => 
      createObstacle("rect-ground")(i + 70)(CONSTANTS.MininumObstacleWidth - 70 + s.level*20)(CONSTANTS.ObstacleHeight)(new Vec(i*300 - i*20 + s.rngSeed*s.level, 710))(new Vec(0.33 * s.level, 0))("None"));

      const flyRow = [createObstacle("fly")(1000)(20)(20)(new Vec(440 + (CONSTANTS.CanvasSize/5)*Math.round((s.level - 1)*10)%CONSTANTS.CanvasSize, 40))(new Vec(0, 0))("hidden")]

      // Concatenates all obstacles into one array
    const startingObstacles = obstacleRow1.concat(obstacleRow2, obstacleRow3, obstacleRow4, obstacleRow0, obstacleRow5, obstacleRow6, flyRow);
    return <state> {
      ...s,
      obstacles: startingObstacles,
      fly: flyRow
    }
  }

  

  // Initialises the initial state with new obstacles and backgrounds
  function stateInit(s?: state): state {

    const initState: state = s ? {...s, obstacles: [], background: [], frog: createFrog(), frogWins: 0, level: s.level + 0.1, rngSeed: s.rngSeed + 120, frogWinPos: [], lives: s.lives, scoreOnLevel: 0, highScore: s.highScore, reset: false, fly: [], flyEaten: false} : {time: 0, gameOver: false, obstacles: [], background: [], frog: createFrog(), score: 0, frogWins: 0, level: 1, rngSeed: 200, frogWinPos: [], lives: 5, scoreOnLevel: 0, highScore: 0, reset: false, fly:[], flyEaten: false};
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
  const enterCheck = observeKey("keydown", "Enter", () => new Reset); //Pressing the enter key indicates a reset for the game state to process.


  // updates the frogs position and adds in Obstacles/Background/WinningFrogs if not initialized, else it will update the new positioning
  // of each obstacles per tick and makes sure that frog stays on top of everything
  function updateView(state:state): void {

    const svg = document.querySelector("#svgCanvas") as SVGElement & HTMLElement;

    // Creates the frog if not yet initialized
    const createFrogView = (f: Frog) => {
      const frog = document.createElementNS(svg.namespaceURI, "circle");
      frog.setAttribute("id", f.id);
      frog.setAttribute("cx", String(f.pos.x));
      frog.setAttribute("cy", String(f.pos.y));
      frog.setAttribute("r", String(f.radius));
      frog.setAttribute("style", "fill: green");
      svg.appendChild(frog);
      return frog;
    }



    // Updates the frog's position
    const frog = document.getElementById("frog") || createFrogView(state.frog);
    frog.setAttribute("cx", `${state.frog.pos.x}`);
    frog.setAttribute("cy", `${state.frog.pos.y}`);


    // Updates the background when needed
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


    // Used in moving obstacles and changing color based on status 
    state.obstacles.forEach(b => {
      const createObstacleView = () => {
        const v = document.createElementNS(svg.namespaceURI, "rect")!;
        v.setAttribute("id", b.id);
        v.setAttribute("width", String(b.width));
        v.setAttribute("height", String(b.height));
        b.type === "goal" ? v.setAttribute("style", "stroke: white;") : b.type === "rect-river" ? v.setAttribute("style", "fill: orange") : b.type === "croc" ? v.setAttribute("style", "fill: red") : v.setAttribute("style", "fill: purple");
        v.classList.add("obstacle");
        svg.appendChild(v)
        return v;
      }
      const v = document.getElementById(b.id) || createObstacleView();
      if (b.type === "croc" && b.status === "Danger"){
        v.setAttribute("style", "fill: red")
      }
      else if (b.type === "croc" && b.status === "Clear") {
        v.setAttribute("style", "fill: violet")
      }
      v.setAttribute("x", String(b.pos.x));
      v.setAttribute("y", String(b.pos.y));
    })

    // Used to make sure frog is on top of all obstacles
    const createUpdateFrog = () => {    
      const elem = document.createElementNS(svg.namespaceURI, "use");
      elem.setAttribute("href", "#frog");
      elem.setAttribute("id", "frogUpdate");
      svg.appendChild(elem);
    }

    // Function to create the Score text on the game
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

    // Function to create the Lives text on the game
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

    // Function to create the High Score text on the game
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

    // Function to create the Level text on the game
    const createLevelDisplay = () => {
      const v = document.createElementNS(svg.namespaceURI, "text");
      v.setAttribute("id", "level")
      v.setAttribute("class", "level");
      v.setAttribute("x", "200");
      v.setAttribute("y", "830");
      v.setAttribute("style", "fill: white;");
      v.textContent = String(0);
      svg.appendChild(v);
      return v
    }

    // Adds a new Winning Frog on the display if not yet added. 
    state.frogWinPos.forEach(b => {
      const createWinFrogSVG = () => {
        const frog = document.createElementNS(svg.namespaceURI, "circle")!;
        frog.setAttribute("id", b.id);
        frog.setAttribute("cx", String(b.pos.x));
        frog.setAttribute("cy", String(b.pos.y));
        frog.setAttribute("r", String(b.radius));
        frog.setAttribute("style", "fill: green");
        svg.appendChild(frog);
        return frog;
      }
      const v = document.getElementById(b.id) || createWinFrogSVG();
    })

    state.fly.forEach(b => {
      const createFly = () => {
        const fly = document.createElementNS(svg.namespaceURI, "rect")!;
        fly.setAttribute("id", b.id);
        fly.setAttribute("x", String(b.pos.x));
        fly.setAttribute("y", String(b.pos.y));
        fly.setAttribute("width", String(b.width));
        fly.setAttribute("height", String(b.height));
        return fly
      }
      const v = document.getElementById(b.id) || createFly();
      b.status === "hidden" ? v.setAttribute("class", "hidden") : v.removeAttribute("class")
    })


    //Creates Game Over Text for the user, and asks them to press Enter in order to continue playing
    if (state.gameOver === true && state.lives < 0) {
      const createText1 = () => {
        const v = document.createElementNS(svg.namespaceURI, "text")!;
        v.setAttribute("x", "48%");
        v.setAttribute("y", String(CONSTANTS.CanvasSize/2 - 50));
        v.setAttribute("class", "gameover");
        v.setAttribute("id", "gameover")
        v.textContent = "Game Over";
        svg.appendChild(v);   
      }
      const createText2 = () => {
        const v2 = document.createElementNS(svg.namespaceURI, "text")!;
        v2.setAttribute("x", "50%");
        v2.setAttribute("y", String(CONSTANTS.CanvasSize/2 + 50));
        v2.setAttribute("class", "restart");
        v2.setAttribute("id", "gameover2")
        v2.textContent = "Press Enter to Restart Game";
        svg.appendChild(v2);
      }
      const v = document.getElementById("gameover") || createText1();
      const v2 = document.getElementById("gameover2") || createText2();
  } 


    const highScore = document.getElementById("highScore") || createHighScore();
    highScore.textContent = String(state.highScore);
    const lives = document.getElementById("lifeValue") || createLives();
    lives.textContent = state.lives < 0 ? "0" : String(state.lives);
    const score = document.getElementById("scoreValue") || createScore();
    const level = document.getElementById("level") || createLevelDisplay();
    level.textContent = String(Math.round(((state.level - 1) * 10)+1));
    score.textContent = String(state.score);
    const update = document.getElementById("frogUpdate") || createUpdateFrog();


    //If state indicates a reset, removes all svg elements
    if (state.reset === true) {
      state.obstacles.forEach(b => {
        const v = document.getElementById(b.id);
        v?.remove();
      })
      state.background.forEach(b => {
        const v = document.getElementById(b.id);
        v?.remove();
      })
      state.frogWinPos.forEach(b => {
        const v = document.getElementById(b.id);
        v?.remove();
      })
      const frogUpdate = document.getElementById("frogUpdate")
      frogUpdate?.remove();
      const gameOver = document.getElementById("gameover");
      const gameOver2 = document.getElementById("gameover2");
      gameOver?.remove();
      gameOver2?.remove();
    }
  }



  // Creates a Frog Object at the starting position
  function createFrog(): Frog {
    return {
      id: 'frog',
      pos: new Vec(450, 850),
      vel: Vec.Zero,
      radius: 30
    }
  } 

  // Ticks every 10 ms to update game state and process any new input from the keyboard. Updates the game accordingly using updateState function
  const subscription = interval(10).pipe(map(elapsed => new Tick(elapsed)), 
    merge(moveDown, moveLeft, moveRight, moveUp, enterCheck) ,scan(reduceState, stateInit())).subscribe(updateView);
}



// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}


