"""Render the Memorate star into PWA and home screen icon sizes."""

import math
import shutil
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1] / "public" / "icons"
BACKGROUND = "#f2eae6"
CORAL = "#d96558"


def star_points(size: int, scale: float) -> list[tuple[float, float]]:
    vertices = []
    for index in range(10):
        angle = math.radians(-98 + index * 36)
        radius = 44 if index % 2 == 0 else 23
        vertices.append((50 + radius * math.cos(angle), 50 + radius * math.sin(angle)))

    points = []
    for index, vertex in enumerate(vertices):
        before = vertices[(index - 1) % 10]
        after = vertices[(index + 1) % 10]
        rounding = .18 if index % 2 == 0 else .14
        entry = tuple(vertex[i] + (before[i] - vertex[i]) * rounding for i in (0, 1))
        exit = tuple(vertex[i] + (after[i] - vertex[i]) * rounding for i in (0, 1))
        if not points:
            points.append(entry)
        for step in range(1, 17):
            t = step / 16
            points.append(tuple((1 - t) ** 2 * entry[i] + 2 * (1 - t) * t * vertex[i] + t ** 2 * exit[i] for i in (0, 1)))
        next_vertex = vertices[(index + 1) % 10]
        next_rounding = .18 if (index + 1) % 2 == 0 else .14
        next_entry = tuple(next_vertex[i] + (vertex[i] - next_vertex[i]) * next_rounding for i in (0, 1))
        points.append(next_entry)
    return [((x - 50) * scale * size / 100 + size / 2, (y - 50) * scale * size / 100 + size / 2) for x, y in points]


for name, size, scale in [
    ("icon-192.png", 192, .86),
    ("icon-512.png", 512, .86),
    ("icon-maskable-512.png", 512, .68),
    ("icon-maskable-192.png", 192, .68),
    ("apple-touch-icon-152.png", 152, .86),
    ("apple-touch-icon-167.png", 167, .86),
    ("apple-touch-icon.png", 180, .86),
]:
    canvas = Image.new("RGB", (size * 4, size * 4), BACKGROUND)
    ImageDraw.Draw(canvas).polygon(star_points(size * 4, scale), fill=CORAL)
    canvas.resize((size, size), Image.Resampling.LANCZOS).save(ROOT / name, optimize=True)

shutil.copyfile(ROOT / "apple-touch-icon.png", ROOT.parent / "apple-touch-icon.png")
