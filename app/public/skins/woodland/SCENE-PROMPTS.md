# Woodland scene prompts

Generated with the built-in imagegen tool. The day scene uses the user's woodland calendar concept as a visual reference; the night scene edits the selected day image. Cloud and star layers are generated separately by `skins/woodland-art.mjs`.

## Day — day.png

Use case: stylized-concept. Asset type: production background artwork for a full-screen pixel-art family calendar, landscape 16:9, ideally 2048x1152.
Input image: style and composition reference ONLY. Recreate and extend just the outdoor scenery visible behind the interface into a complete landscape. Remove ALL calendar UI, wooden frames, vines attached to frames, numbers, lettering, panels, buttons, dog, and other characters.
Match the reference's crisp detailed 16-bit pixel art: layered tall evergreen pine forest with dark teal shaded branches and sunlit moss green foliage along both left and right edges, distant blue-green conifers toward the center, a rocky grassy bank at roughly 72% of image height, bright blue lake spanning the lower quarter with short pixelated cyan water highlights, and a few foreground grey/tan boulders and grass tufts along the very bottom edge. Tall side trees reach from shoreline up to 15-25% of image height so the narrow exposed sides show rich forest. Clear blue sky in the top quarter and center above the trees.
IMPORTANT this is the base scenery for separate animated cloud sprites: absolutely NO CLOUDS anywhere, no sun disk, no stars, no moon. Do not draw an empty panel-shaped area in the center; make a complete coherent outdoor landscape. Detailed pixel clusters, stepped edges, distinct but natural palette, calm welcoming daylight, no blur, no photorealism, no UI/text/logos. Maintain the reference's forest-lake composition and rich game-background quality.

## Night — night.png

Use case: lighting-weather. Asset type: night variant of a pixel-art calendar background.
Edit target: the attached daytime forest-and-lake background. Change only lighting and palette to a peaceful clear night. Preserve EXACTLY the canvas aspect ratio, composition, tree silhouettes and branch shapes, mountain outlines, rocks, shoreline at the same height, foreground grass and every object's position. Keep the crisp detailed 16-bit pixel art style.
Use deep midnight blue sky, indigo mountains, dark teal forest with restrained cool moonlight on foliage and rock edges, and a deep blue lake with static muted blue pixel highlights. Keep enough contrast to read the forest and shore in the narrow margins of a UI. Absolutely no clouds, no stars, no moon disc: separate animated layers will supply sky details. No UI, text, frames, buildings, characters or dog. Do not crop or rearrange anything.

