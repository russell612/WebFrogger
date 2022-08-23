import "./style.css";
import {} from "rxjs";

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
