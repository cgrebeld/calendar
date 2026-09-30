---
name: create-character
description: Create cute animated characters for this calendar's Chore Quests, with only idle and celebrate states. Use for new or replacement quest companions, not for registering ChatGPT pets.
---

# Create Character

Adapt the ChatGPT pet creation ideas to this project: canonical identity, grounded animation strips, stable framing, transparency, and motion QA. Use only **idle** and **celebrate**, saved locally; no Pets upload, Library registration, or look-direction sheets.

## Generate

Inspect the current quest component before replacing its art. These characters are calendar pets. Preserve the requested animal and personality. Default to chunky 16-bit pixel art, a limited palette, stepped dark outlines, simple readable faces, and compact whole-body silhouettes. Avoid smooth 3D shading, realistic anatomy, and tiny decorative detail.

Use the built-in image generation tool for the base and every new pose. Inspect a canonical transparent base first, then attach it as the identity reference to each state strip. Do not substitute CSS movement of a still for generated character animation.

Generate each state separately as a horizontal strip of **four equal cells**, preferably 1536×512. Keep full bodies, camera, scale, cell centers, and resting ground line consistent across both strips. Leave generous transparent padding and jump headroom. No text, grids, shadows, scenery, motion trails, or detached sparkles.

- **Idle:** breathing, a blink, and subtle ear/tail motion. Feet planted; first and last poses close enough to loop.
- **Celebrate:** anticipation, joyful upward hop with raised paws/wings, happy landing, and return toward rest. Expression and attached-limb changes as well as vertical lift.

Require true alpha transparency. Repair strips with missing, unevenly spaced, clipped, or inconsistent poses using the base reference. After two failures of the same kind, simplify the pose or change the layout approach.

## Assemble and inspect

Keep base, source strips, and prompts in `docs/characters/<slug>/`. Final artwork goes in `app/public/characters/<slug>.png`.

Run the bundled helper with a Python runtime providing Pillow:

```sh
python3 .agents/skills/create-character/scripts/assemble.py --idle docs/characters/<slug>/idle.png --celebrate docs/characters/<slug>/celebrate.png --output app/public/characters/<slug>.png --preview-dir docs/characters/<slug>/previews --pixel-art
```

The local atlas is **768×416**, four 192×208 cells per row: idle first, celebrate second. The helper applies a common crop/scale, retaining authored registration and airborne motion, then writes a structural report and idle→celebrate→idle GIF. It does not judge artistic quality.

Inspect base, strips, atlas, and moving preview at UI size. Check consistent face/material/palette, attached limbs, four complete poses, stable scale/feet, visible idle variation, a joyful lift and return, clean state transitions, and transparency on light/dark backgrounds. Structural checks alone do not establish quality. Fix the smallest failed source or extraction step.

## Integrate

Reuse the existing completion/replay callback. Idle loops; celebrate plays on completion or replay then returns to idle. Restart on another tap. Preserve native button access and show a static idle pose for reduced motion. Keep instructions out of the widget.

Show motion previews, record prompts and honest visual observations with the assets, and link the final files. Follow root `AGENTS.md` for tests/builds, separate verified commits, and deployment. A skill-only commit needs no deployment. This smaller format is not a ChatGPT Pets atlas; do not claim Pets validation.
