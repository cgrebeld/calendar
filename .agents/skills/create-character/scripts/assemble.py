"""Assemble generated four-pose strips; requires Pillow, does not draw characters."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageChops


def assemble(idle, celebrate, output, preview_dir, pixel_art=False):
    resampling = Image.Resampling.NEAREST if pixel_art else Image.Resampling.LANCZOS
    frames = []
    for source in (idle, celebrate):
        strip = Image.open(source).convert("RGBA")
        if strip.width % 4:
            raise ValueError(f"{source}: width must divide into four cells")
        for index in range(4):
            frame = strip.crop((index * strip.width // 4, 0, (index + 1) * strip.width // 4, strip.height))
            frame = frame.resize((384, 512), resampling)
            bounds = frame.getchannel("A").point(lambda a: 255 if a > 24 else 0).getbbox()
            if not bounds:
                raise ValueError(f"{source}: blank frame {index}")
            if bounds[0] == 0 or bounds[1] == 0 or bounds[2] == 384 or bounds[3] == 512:
                raise ValueError(f"{source}: frame {index} touches its edge; check clipping/background")
            frames.append(frame)
    if pixel_art:
        # Register both strips using their resting final pose, preserving hop height.
        for start in (0, 4):
            rest = frames[start + 3].getchannel("A").getbbox()
            factor = 300 / (rest[3] - rest[1])
            for index in range(start, start + 4):
                registered = Image.new("RGBA", (384, 512))
                registered.alpha_composite(frames[index].resize((round(384 * factor), round(512 * factor)), resampling),
                                           (round(192 - (rest[0] + rest[2]) / 2 * factor), round(450 - rest[3] * factor)))
                frames[index] = registered
    bounds = [f.getchannel("A").getbbox() for f in frames]
    shared = (min(b[0] for b in bounds), min(b[1] for b in bounds), max(b[2] for b in bounds), max(b[3] for b in bounds))
    scale = min(176 / (shared[2] - shared[0]), 192 / (shared[3] - shared[1]))
    size = (round((shared[2] - shared[0]) * scale), round((shared[3] - shared[1]) * scale))
    cells = []
    for frame in frames:
        cell = Image.new("RGBA", (192, 208))
        cell.alpha_composite(frame.crop(shared).resize(size, resampling), ((192 - size[0]) // 2, 200 - size[1]))
        cells.append(cell)
    atlas = Image.new("RGBA", (768, 416))
    for index, cell in enumerate(cells):
        atlas.alpha_composite(cell, (index % 4 * 192, index // 4 * 208))
    output.parent.mkdir(parents=True, exist_ok=True)
    if pixel_art:
        atlas = atlas.resize((192, 104), Image.Resampling.NEAREST)
        alpha = atlas.getchannel("A").point(lambda a: 255 if a >= 128 else 0)
        atlas = atlas.convert("RGB").quantize(colors=15, dither=Image.Dither.NONE).convert("RGBA")
        atlas.putalpha(alpha)
        atlas.paste((0, 0, 0, 0), mask=alpha.point(lambda a: 255 - a))
        atlas = atlas.resize((768, 416), Image.Resampling.NEAREST)
        cells = [atlas.crop((i % 4 * 192, i // 4 * 208, (i % 4 + 1) * 192, (i // 4 + 1) * 208)) for i in range(8)]
        assert len(atlas.getcolors(17) or []) in range(1, 17)
        assert {value for count, value in atlas.getchannel("A").getcolors()} <= {0, 255}
    atlas.save(output)
    decoded = Image.open(output).convert("RGBA")
    assert decoded.size == (768, 416)
    for row in range(2):
        row_frames = [decoded.crop((i * 192, row * 208, (i + 1) * 192, (row + 1) * 208)) for i in range(4)]
        assert all(f.getchannel("A").getbbox() for f in row_frames)
        assert any(ImageChops.difference(row_frames[0], f).convert("RGB").getbbox() for f in row_frames[1:]), "State has no visual variation"
    preview_dir.mkdir(parents=True, exist_ok=True)
    preview = []
    sequence = list(range(4)) * 2 + list(range(4, 8)) * 2 + list(range(4)) * 2
    for index in sequence:
        background = Image.new("RGBA", (192, 208), "#e6efdc")
        background.alpha_composite(cells[index])
        preview.append(background.convert("RGB"))
    preview[0].save(preview_dir / "motion.gif", save_all=True, append_images=preview[1:], duration=[350 if i < 4 else 180 for i in sequence], loop=0, disposal=2)
    report = {"dimensions": list(decoded.size), "frames": 8, "states": ["idle", "celebrate"], "structural_checks": "passed", "visual_review": "required"}
    (preview_dir / "validation.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pixel-art", action="store_true", help="Use a 48×52 logical cell and a shared 16-color palette")
    for name in ("idle", "celebrate", "output", "preview-dir"):
        parser.add_argument("--" + name, type=Path, required=True)
    args = parser.parse_args()
    assemble(args.idle, args.celebrate, args.output, args.preview_dir, args.pixel_art)
