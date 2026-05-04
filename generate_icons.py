#!/usr/bin/env python3
"""Generate PNG icons for TalkwebSour Chrome Extension"""
import struct
import zlib
import math

def create_png(size):
    """Create a simple PNG with gradient background and lightning bolt"""
    # Create pixel data
    pixels = []
    for y in range(size):
        row = []
        for x in range(size):
            # Gradient from cyan to purple
            t = (x + y) / (size * 2)
            r = int(0 + t * 123)
            g = int(212 * (1 - t))
            b = int(255 * (1 - t * 0.5) + 255 * t)

            # Rounded corners
            cx, cy = x - size/2, y - size/2
            corner_r = size * 0.18
            in_corner = False
            corners = [(size*0.18, size*0.18), (size*0.82, size*0.18),
                      (size*0.18, size*0.82), (size*0.82, size*0.82)]
            for (qx, qy) in corners:
                if math.sqrt((x-qx)**2 + (y-qy)**2) < corner_r:
                    if x < qx and y < qy:
                        in_corner = True
                    elif x > qx and y < qy:
                        in_corner = True
                    elif x < qx and y > qy:
                        in_corner = True
                    elif x > qx and y > qy:
                        in_corner = True

            # Simple lightning bolt shape
            s = size
            in_bolt = False
            # Main diagonal stroke
            if abs((y - s*0.25) - (s*0.55 - x) * 0.8) < s * 0.08 and s*0.3 < x < s*0.65:
                in_bolt = True
            if abs((y - s*0.5) - (s*0.75 - x) * 0.8) < s * 0.08 and s*0.4 < x < s*0.72:
                in_bolt = True

            alpha = 255
            if in_bolt:
                row.extend([20, 20, 20, alpha])
            else:
                row.extend([r, g, b, alpha])
        pixels.append(row)

    # Build PNG
    def chunk(name, data):
        c = struct.pack('>I', len(data)) + name + data
        return c + struct.pack('>I', zlib.crc32(name + data) & 0xffffffff)

    raw = b''
    for row in pixels:
        raw += b'\x00' + bytes(row)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw))
    png += chunk(b'IEND', b'')
    return png

import os
os.makedirs('icons', exist_ok=True)
for size in [16, 48, 128]:
    png_data = create_png(size)
    with open(f'icons/icon{size}.png', 'wb') as f:
        f.write(png_data)
    print(f'✓ Generated icons/icon{size}.png ({size}x{size})')

print('Done! Icons generated.')
