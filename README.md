# Web Frogger Game/Project
This game utilizes typescript with declarative programming to run.

# Overview
From the code base, the main subscription observable, which has an observable stream of
numbers which emits every 10 milliseconds, here we use each number to create a new Tick
instance class, which is then merged with the 5 keyboard inputs that are used to check if the
user has entered the “wasd” keys for movement, or the enter key for Restarting the game. Each
new object in the stream is passed through the reduceState function to create a new game state
based on the latest event in the observable using the scan function.
The game state is a Readonly type to indicate that each state is a constant and cannot be
changed to retain purity by maintaining immutability of objects. This design decision follows into
each of the state’s attributes, with ReadonlyArrays for obstacles, background and winning frog
positions (frogWinPos).

The observeKey is a function that is based of the fromEvent function retrieved from rxjs that
includes 3 parameters, first to indicate the eventName to observe, then the next being the key
that should be observed (we would only want to process the keys that we need) and after that a
result function that maps the function to each instance of the Observable’s objects. This is done
using parametric polymorphism because we can make sure that data is consistent and stable
that maintains the DRY (Don’t repeat yourself) principle.
For the movement keys, we have set each of these functions to return a new Move class while
pressing the enter key initiates a new Reset class, indicating a reset back to level 1 while
retaining previous high scores. All of this will be processed accordingly in the reduceState
function.

Using the Model-View-Controller (MVC) Architecture, we start off with the game state, which
includes all required attributes needed to run the game. This includes the frog, obstacles,
background, score and so on. Players can manipulate this game state using a stream of
observables that observe the player’s input of “wasd” keys or the enter key. Which through the
reduceState function helps in identifying what will be changed in the game state. The game
state gets passed through into a subscription with the function updateView, which for every Tick,
updates the obstacle’s position, game score, frog position (if moved), and more. In which it will
be displayed onto the screen for the user to act accordingly. All side effects (updating svg
elements on the screen) is done through the updateView function in order to make sure that
there are no impure elements in other functions except the main subscription.

## reduceState

The reduceState is a function that helps process what should be changed in the game state, is it
going to change the Frogs position? To reset the game? Or just a general tick which will handle
collision detection and win condition.
The move event will move the frog in the game state and update the score based on how the
frog moved.

The reset event will call the reset function, which will return a new state with the initial value,
seed for background and obstacle generation, back to the first level.
Otherwise, it will be a Tick event, which we will move it into the tick function to process
accordingly.

This helps in modularizing code to help in the debugging process because each event has its
own function. It helped me in identifying when the move function is not working properly without
modifying other code that is not responsible for the problem.
Tick function

The tick function accepts the current state with the elapsed number indicating the nth tick and its
corresponding handling of collisions and win conditions. With each new tick it will check if the
frog is currently in a water or ground row as well as if it is at the final row which is the end/win
condition.

The frogCollidedRiver and frogCollidedGround are booleans to check if the frog has lost. With
the only difference being that in the River the frog must be colliding with one of the obstacles,
which is the exact opposite of what we want in frogCollidedGround. The frogRiver boolean
checks whether the frog is on a river row by checking if the obstacles around it have the
“rect-river” type.

The tick also helps in checking several conditions, such as win condition and gameOver in the
states, it will then direct it to the corresponding function to return a new state with the new
attributes.

We maintained purity by creating a new state for each new tick instead of modifying existing
states to maintain referential transparency. We also have created granular functions that serve
only their purpose based on if the condition has been met to prevent overcomplicating one
single function. This helps in making the code more readable and testable as we can easily
pinpoint the function that is not working as intended.

## WinConditionHandler Function

One thing to note here is checking if the player has entered the winning square before. My initial
implementation was to find if the array frogWinPos has a frog with the specific id. However that
would introduce looping which is impure. Instead I changed it into using the filter function that
passes through the winning square id that we need to find, to check if it has entered that
winning square. This maintains purity of our program by not introducing side effects (counter in
a loop) and maintaining immutability by not changing the actual frogWinPos array itself.

## Creating New Levels
I have created a function that facilitates the creation of new backgrounds and obstacles based
on the level and rngSeed that is provided through the game state. It is called in the stateInit
function. In which it is called with a state as an optional parameter. Having no states passed in
would initiate everything in level one. While if we call it with a state, it will refresh all frogWins,
obstacles and backgrounds with an updated seed for the next level for new background
generation and harder difficulty. I decided on this method to ensure an easy reset process when
moving on to a new level as well as streamlining the restart process back to level one. The reset
function basically returns a game state similar to the one created in stateInit if a state was not
passed in but preserving the high score between games.

The helper functions createBackgrounds and createObstacles help populate the new level with
the required backgrounds and obstacles for updateView to process. Each of these functions
populate each row with new svg elements based on the createObstacles function which is
mapped onto each array row to create the obstacles from the given array length. It is a curried
function that returns a new state with the new array of obstacles/background to be displayed in
the updateView function. This eliminates the usage of loops which helps in reducing the amount
of bugs.

This allows modularity and reusability of the code for updating the scene with a new level or
reverting to an old one. It also adds a difficulty factor. Each obstacle, based on whether they are
ground or river obstacles, will expand or shrink based on a factor of the state’s level. The
Crocodiles also turn Unsafe faster as the game continues. Same goes for the fly, which appears
less often at higher levels. Players also need to be exactly on where the fly is to get the bonus
points and does not have an automatic “Lock” as it did with the winning squares to promote
challenging gameplay.

## Development

There are two ways to run the code:

1. Build the code and then open the web page

- Run `npm install`
- Run `npm run build`
- Open the html file dist/index.html (NOT src/index.html)

2. Use the development server

- Run `npm install`
- Run `npm run dev`, this will automatically open a web page at localhost:4000
- Open localhost:4000 in your browser if it didn't already

The development server will have some additional features that help with the
development process, but are not essential.
