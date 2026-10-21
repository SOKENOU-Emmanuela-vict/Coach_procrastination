import glob
import re

files = sorted(glob.glob('src/ui/*.js'))
total = 0
print("=== DÉCOMPTE EXACT DES STYLES INLINE DANS src/ui/ ===")
for path in files:
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    count = 0
    for idx, line in enumerate(lines, 1):
        if 'style=' in line:
            count += 1
            if 'DesktopView' in path:
                print(f"Line {idx}: {line.strip()}")
    print(f"{path.replace('\\', '/')}: {count}")
    total += count

print("-----------------------------------------------------")
print(f"TOTAL RESTANT : {total}")
