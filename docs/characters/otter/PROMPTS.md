# Pebble the otter

Created using the project Create Character skill and built-in image generation. Base and source strips are preserved here; final two-state atlas: `app/public/characters/otter.png`.

## Base prompt

Canonical base design for a small animated desktop companion, inspired by charming modern virtual pets. A cute baby river otter, warm cocoa-brown fur, cream muzzle and belly, tiny rounded ears, short whiskers, large glossy dark eyes, chubby cheeks, tiny paws resting on belly, visible thick rounded tail. Name: Pebble. Rounded squishy plush-toy proportions, oversized expressive head, compact pear-shaped body, soft matte material with delicate hand-painted shading, clean smooth silhouette, appealing simple face, cozy wholesome personality. Full body standing in a relaxed pose, three-quarter view very slightly facing right but engaging the viewer. NOT pixel art, NOT realistic anatomy, NOT intricate fantasy illustration. No props. True transparent background, no floor, no ground shadow, no glow, no loose effects, no text. Square canvas with generous transparent margin around the complete character.

## Idle prompt

Create a horizontal animation strip of EXACTLY FOUR complete copies of the attached otter character. Canvas 1536 wide by 512 tall, four equal invisible 384x512 cells. Center each body on x=192,576,960,1344 respectively; resting feet at y=450, top of head near y=150, body height about 300px. Keep head, feet, wings and tail INSIDE their own cell with at least 24px transparent margin. All four poses must be fully visible, separated by generous transparent gutters. Four poses from LEFT to RIGHT: 1 relaxed smiling rest with open eyes; 2 tiny breathing inhale, chest rises slightly, head and tail subtly follow; 3 peaceful blink with eyes closed, same smile and planted feet; 4 eyes reopen and breathe out, returning close to pose 1. Calm alive loop, NOT walking or waving. Copy the exact face, fur/skin, colors, plush proportions, tail and details from the base reference. One consistent camera slightly facing right, same lighting and scale. True transparent background throughout, including gaps; no text, numbers, dividers, guides, floor, shadows, glows, stars, trails, extra props or duplicate limbs. The output is ONE row of four equally spaced poses, not a scene and not a collage.

## Celebrate prompt

Create a horizontal animation strip of EXACTLY FOUR complete copies of the attached otter character. Canvas 1536 wide by 512 tall, four equal invisible 384x512 cells. Center each body on x=192,576,960,1344 respectively; resting feet at y=450, top of head near y=150, body height about 300px. Keep head, feet, wings and tail INSIDE their own cell with at least 24px transparent margin. All four poses must be fully visible, separated by generous transparent gutters. Four poses from LEFT to RIGHT: 1 small anticipation crouch with delighted smile; 2 joyful airborne hop, paws raised, open happy mouth, feet lifted 45 pixels above the common ground line, wings/ears following naturally; 3 happy landing, knees gently bent, eyes squeezed with delight, paws starting to lower; 4 relaxed smiling rest close to the canonical base, paws on belly. Same size all frames: airborne pose moves upward, not grows. No floating effects. Copy the exact face, fur/skin, colors, plush proportions, tail and details from the base reference. One consistent camera slightly facing right, same lighting and scale. True transparent background throughout, including gaps; no text, numbers, dividers, guides, floor, shadows, glows, stars, trails, extra props or duplicate limbs. The output is ONE row of four equally spaced poses, not a scene and not a collage.


## Review

- Base and both four-pose strips inspected; the face, palette, body parts, and material remain consistent.
- Final transparent atlas passes the assembler's eight-cell structural checks. Idle includes an open-eye rest, breathing variation, blink, and return; celebrate includes a crouch, raised-paw airborne pose, happy landing, and rest.
- Shared framing preserves jump height. Small pose squash and tail movement are visible; no cell clipping or neighboring-frame bleed at the quest display size.
- Browser verification passed: idle frame changes, completion celebration, repeated tap and Enter replay, return to idle, initial-load idle, and static first frame under reduced motion. Desktop/light and mobile/dark layouts inspected.
- `previews/motion.gif` shows idle → celebrate → idle from the final cells. This is the local two-state format, not a ChatGPT Pets upload.
