# Stub App

A starter application with configurable buttons. Each button has a placeholder click handler for you to implement. No installations required -- just open the page in a browser.

## Getting Started

Open `index.html` in any web browser. That's it.

## Configuration

### Changing the number of buttons

Open `config.js` and set `NUM_BUTTONS` to the desired count:

```js
const NUM_BUTTONS = 3; // change this value
```

### Changing button labels

Update the `BUTTON_LABELS` array in `config.js`:

```js
const BUTTON_LABELS = [
  "Submit",
  "Cancel",
  "Reset",
];
```

If you have more buttons than labels, extra buttons will default to "Button N".

## Adding Button Logic

Open `handlers.js`. Each button has a corresponding function:

```js
function onButton1Click() {
  // Replace this with your implementation
  console.log("Button 1 clicked -- implement me!");
}
```

If you increase `NUM_BUTTONS`, add matching handler functions (e.g. `onButton6Click` for a 6th button).

## File Overview

| File | Purpose |
|---|---|
| `index.html` | Page layout and styling |
| `config.js` | Number of buttons and their labels |
| `handlers.js` | Click handler functions (one per button) |
| `app.js` | Builds the buttons from config and wires up handlers |
