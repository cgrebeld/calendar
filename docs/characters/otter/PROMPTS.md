# otter — calendar pet

Created with built-in image generation, using the screenshot's left pet as the style reference.

## Base prompt

Use case: stylized-concept. Canonical calendar pet base, true transparent background. Create ONE cute full-body PET in chunky 16-bit console pixel art, like the LEFT creature in supplied screenshot: visible large square pixels, dark stepped outline, flat clustered shading, maximum 12 colors, NO antialiasing, NO gradients, NO 3D rendering, NO fur texture, NO glossy eyes. Logical sprite about 40x44 pixels enlarged with nearest-neighbor. Compact oversized head, tiny rectangular black eyes, friendly simple face, stubby limbs. Center with generous empty margin. No text, props, ground or shadow. Pebble, brown otter with cream muzzle and belly, round ears and curled tail.

## Animation prompts

Generate a horizontal 1536x512 transparent sprite strip of EXACTLY FOUR full-body copies of the reference pet in four equal 384x512 invisible cells. Centers x=192,576,960,1344; planted feet y=450, heads around y=170. All parts fully inside each cell with 30px margin. Preserve identity, chunky 16-bit pixel art, square pixel clusters, dark stepped outlines, flat limited palette (12 colors), no smooth shading, gradients or antialiasing. Same camera, size and ground line throughout. STATE. No text, guides, floor, shadows, effects or props. True alpha transparent gaps.

Idle STATE: Left to right: 1 relaxed smile eyes open paws at belly; 2 subtle breathing inhale with slight tail lift, feet planted; 3 blink eyes closed, feet planted; 4 relaxed eyes open close to first pose.

Celebrate STATE: Left to right: 1 anticipation crouch; 2 joyful hop with both paws raised and happy open mouth, entire body moves UP 55 pixels with feet above ground; 3 happy squashed landing eyes closed paws lower; 4 return to resting smile eyes open paws at belly. Change expression and limbs; no size growth.

Extra instruction: generous gutters, at most 75% cell width. Otter celebration was regenerated with 65% cell width and 55% height after a cell-boundary failure.

## Review

Base, strips, atlas and preview frames inspected. Eight complete poses with a blink, crouch, airborne hop and landing. Some generated squash and proportion variation remains between states. Assembly uses --pixel-art: resting-pose registration, 48×52 logical cells, shared 15-color RGB palette plus transparency, nearest-neighbor scaling. Structural checks pass for frame variation, binary alpha, palette and dimensions. Existing replay and reduced-motion behavior is unchanged. All 107 tests and production build passed; no hardware kiosk verification performed.

Final: app/public/characters/otter.png. Animation preview: previews/motion.gif.
