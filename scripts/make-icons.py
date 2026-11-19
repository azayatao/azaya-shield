#!/usr/bin/env python3
"""Generate ikon PNG (perisai + centang) tanpa dependensi eksternal."""
import math
import pathlib
import struct
import zlib

OUT = pathlib.Path(__file__).resolve().parent.parent / "icons"
SIZES = (16, 32, 48, 128)
SS = 4  # supersampling per sumbu (anti-aliasing)

TOP = (20, 184, 166)     # teal
BOTTOM = (14, 116, 144)  # biru kehijauan gelap
WHITE = (255, 255, 255)


def in_shield(x, y):
    if y < -0.9 or y > 0.95:
        return False
    if y <= 0.1:
        return abs(x) <= 0.8
    t = (y - 0.1) / 0.85
    return abs(x) <= 0.8 * math.sqrt(max(0.0, 1 - t * t))


def dist_segment(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    l2 = dx * dx + dy * dy
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / l2))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def in_check(x, y):
    w = 0.075
    return (
        dist_segment(x, y, -0.38, 0.05, -0.12, 0.35) <= w
        or dist_segment(x, y, -0.12, 0.35, 0.42, -0.38) <= w
    )


def lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def render(size):
    rows = []
    span = 2.1  # peta piksel ke [-1.05, 1.05]
    for py in range(size):
        row = bytearray([0])  # filter type 0
        for px in range(size):
            acc_a, acc_c = 0.0, [0.0, 0.0, 0.0]
            for sy in range(SS):
                for sx in range(SS):
                    x = ((px + (sx + 0.5) / SS) / size - 0.5) * span
                    y = ((py + (sy + 0.5) / SS) / size - 0.5) * span
                    if not in_shield(x, y):
                        continue
                    color = WHITE if in_check(x, y) else lerp(TOP, BOTTOM, (y + 0.9) / 1.85)
                    acc_a += 1
                    for i in range(3):
                        acc_c[i] += color[i]
            n = SS * SS
            if acc_a == 0:
                row += bytes([0, 0, 0, 0])
            else:
                row += bytes([round(c / acc_a) for c in acc_c] + [round(255 * acc_a / n)])
        rows.append(bytes(row))
    return b"".join(rows)


def chunk(tag, data):
    body = tag + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def write_png(path, size):
    raw = render(size)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for s in SIZES:
        write_png(OUT / f"icon{s}.png", s)
        print("icon", s)
