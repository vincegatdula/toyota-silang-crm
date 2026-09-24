#!/usr/bin/env python3
"""Generate Toyota CRM app icons (red rounded square + white T) as PNG.
Pure standard library (zlib + struct)."""
import struct, zlib, os

RED = (235, 10, 30, 255)
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)

def rounded(x, y, s, r):
    if r <= 0:
        return True
    if x < r and y < r:
        return (x - r) ** 2 + (y - r) ** 2 <= r * r
    if x >= s - r and y < r:
        return (x - (s - 1 - r)) ** 2 + (y - r) ** 2 <= r * r
    if x < r and y >= s - r:
        return (x - r) ** 2 + (y - (s - 1 - r)) ** 2 <= r * r
    if x >= s - r and y >= s - r:
        return (x - (s - 1 - r)) ** 2 + (y - (s - 1 - r)) ** 2 <= r * r
    return True

def in_T(x, y, s):
    # horizontal bar: y 26%..40%, x 16%..84%
    hb_y0 = int(s * 0.26); hb_y1 = int(s * 0.40)
    hb_x0 = int(s * 0.16); hb_x1 = int(s * 0.84)
    # stem: x 42%..58%, y 40%..80%
    st_x0 = int(s * 0.42); st_x1 = int(s * 0.58)
    st_y0 = int(s * 0.40); st_y1 = int(s * 0.80)
    in_hbar = hb_x0 <= x <= hb_x1 and hb_y0 <= y <= hb_y1
    in_stem = st_x0 <= x <= st_x1 and st_y0 <= y <= st_y1
    return in_hbar or in_stem

def make(s):
    r = int(s * 0.22)
    rows = []
    for y in range(s):
        row = bytearray()
        for x in range(s):
            if not rounded(x, y, s, r):
                row += bytes(CLEAR)
            elif in_T(x, y, s):
                row += bytes(WHITE)
            else:
                row += bytes(RED)
        rows.append(bytes(row))
    raw = b''.join(b'\x00' + r for r in rows)
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        c += struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
        return c
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', s, s, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    return png

os.makedirs('assets/icons', exist_ok=True)
for s in (192, 512):
    with open('assets/icons/icon-%d.png' % s, 'wb') as f:
        f.write(make(s))
    print('wrote icon-%d.png' % s)