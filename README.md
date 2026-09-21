# Visioball Speaker Layout Tool

A browser-based tool for designing and visualising a Visioball speaker layout.

## What it supports

- Visualises a balanced spherical speaker and LED layout.
- Takes mass balance into account when positioning components.
- Supports LED lighting on the edges around the speakers, including LED projection and colour controls.
- Allows passive radiators to be added to the sphere layout.
- Includes speaker placement, sphere sizing, shape suggestions, directivity, sound-range visualisation, layer toggles, rotation, zoom, and layout details.

## Technology

The tool is built with HTML, CSS, and JavaScript. It uses Three.js for the 3D visualisation and runs directly in a web browser without a build step.

## Mathematical basis

The layout is based on spherical geometry and mathematical polyhedra. It uses regular Platonic solids and semi-regular Archimedean solids, including tetrahedrons, cubes, octahedrons, icosahedrons, dodecahedrons, and truncated solids, to distribute components across the sphere.

## How to use

1. Open `speaker layout.html` in a modern browser.
2. Set the speaker count, passive-radiator count, sphere diameter, and shape.
3. Use **Suggest shape** for an automatic shape recommendation, then select **Apply layout**.
4. Use **Minimum** to calculate the smallest safe sphere diameter.
5. Adjust the directivity frequency and visual sound range as needed.
6. Toggle visualisation layers in the legend. Enable LED projection to use the LED colour controls.
7. Drag the model to rotate it and use the mouse wheel to zoom.
8. Use the `i` button for details and the arrow button to show or hide the settings panel.

The browser must support WebGL and modern JavaScript. Internet access is required because the tool loads Three.js from jsDelivr.
