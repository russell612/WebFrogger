import "./style.css";
import { interval, fromEvent, zip, from, merge } from "rxjs";
import { map, filter, take, count, scan, last } from "rxjs/operators";

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

  type shape = "rect" | "circle"

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
  frog.setAttribute(
    "style",
    "fill: green; stroke: green; stroke-width: 1px;"
  );

  function createObstacle(x: string, y: string, type: shape) {
    if(type === "rect") {
      const obstacle = document.createElementNS(svg.namespaceURI, "rect");
      obstacle.setAttribute("width", "200");
      obstacle.setAttribute("height", "80");
      obstacle.setAttribute("x", x);
      obstacle.setAttribute("y", y);
      obstacle.setAttribute("style", "fill-opacity = 0");
      svg.appendChild(obstacle)
    }
    else {
      const obstacle = document.createElementNS(svg.namespaceURI, "circle");
      obstacle.setAttribute("r", "50");
      obstacle.setAttribute("cx", "100")
      obstacle.setAttribute("x", x);
      obstacle.setAttribute("y", y);
      obstacle.setAttribute("style", "fill-opacity = 0");
      svg.appendChild(obstacle)
    }
  }

  // appends each background element to the svgCanvas
  svg.appendChild(river);
  svg.appendChild(ground);
  svg.appendChild(ground2);
  svg.appendChild(frog);

  const kb = fromEvent<KeyboardEvent>(document, "keydown").pipe(map(({key})=> ({x: 0, y: 0, k: key})));

  const w = kb.pipe(filter(({k}) => k === "w" ), map(({y, x}) => ({y: y -= 100, x: 0})));
  const s = kb.pipe(filter(({k}) => k === "s" ), map(({y, x}) => ({y: y += 100, x: 0})));
  const a = kb.pipe(filter(({k}) => k === "a" ), map(({x, y}) => ({x: x -= 10, y: 0})));
  const d = kb.pipe(filter(({k}) => k === "d" ), map(({x, y}) => ({x: x += 10, y: 0})));
  const final = merge(w,s,a,d).subscribe(({x, y}) => x === 0 ? frog.setAttribute("cy", String(y + Number(frog.getAttribute("cy")))):frog.setAttribute("cx", String(x + Number(frog.getAttribute("cx")))));
}



// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}
