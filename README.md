## Vibe Controller

Dark, nebula-themed landing page with a full-screen 3D galaxy particle system, controlled by hand gestures via webcam.

### Run locally

- **Install a simple static server** (if you don't already have one):

```bash
npm install -g serve
```

- **From this folder**:

```bash
serve .
```

Then open the printed `localhost` URL in your browser.

You can also use the included npm script:

```bash
npm install
npm run start
```

### Tuning the visuals

- **Core config** lives in `main.js` in the `VC_CONFIG` object:
  - **`galaxy`**: particle count, radius, branch count, spin, randomness, and the inside/outside colors.
  - **`background`**: base color and fog colors.
  - **`interaction`**: how sensitive the grab is and how strongly the galaxy reacts.

Designers can:

- Adjust color hex values in `VC_CONFIG.galaxy.insideColor` / `outsideColor`.
- Tweak `VC_CONFIG.interaction.grabThreshold` if grab detection feels too easy/hard.
- Change CSS gradients and glows in `style.css` to shift the overall vibe.


