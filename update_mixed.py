import json
import re

def update_mixed():
    file_path = 'src/data/BootcampProgram.js'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Update missions string
    content = content.replace(
        '"🇬🇧 Finir au moins 5 modules sur Busuu et réaliser 3 heures d\'éloquence en français."',
        '"🇬🇧 Pratiquer sur Busuu, Altissia FORCE-N et BBC Learning, et réaliser 3 heures d\'éloquence en français."'
    )

    # Let's replace ONLY the first occurrence of Busuu in Day 1 with Altissia.
    # The first occurrence is around line 17.
    # Day 1: Busuu
    day1_busuu = '{ block: "🇬🇧 Anglais", title: "Busuu", skillId: "english_speaking", expectedDuration: 30, startTime: "05:40", endTime: "06:10", objective: "Pratiquer le vocabulaire et la grammaire de base", expectedResult: "Compléter une leçon Busuu sans erreur", proof: "Capture d\'écran Busuu", difficulty: "🟢", xp: 30, resourceLink: "https://www.busuu.com/" }'
    
    day1_altissia = '{ block: "🇬🇧 Anglais", title: "Anglais Altissia FORCE-N", skillId: "english_speaking", expectedDuration: 30, startTime: "05:40", endTime: "06:10", objective: "Pratiquer le vocabulaire sur la plateforme FORCE-N", expectedResult: "Compléter un module Altissia", proof: "Capture d\'écran Altissia", difficulty: "🟢", xp: 30, resourceLink: "https://formation.force-n.sn/course/view.php?id=649" }'

    # Try to replace exactly the day1_busuu string if it matches (it might have different formatting).
    # Better approach: split by title: "Busuu" and only replace the first one.
    
    parts = content.split('title: "Busuu"')
    if len(parts) > 1:
        # Reconstruct with the first one replaced by Altissia
        new_content = parts[0] + 'title: "Anglais Altissia FORCE-N"' + parts[1]
        
        # Now fix the link in that first section
        # We need to replace the next "https://www.busuu.com/" with Altissia link
        # We split new_content at 'title: "Anglais Altissia FORCE-N"'
        sub_parts = new_content.split('title: "Anglais Altissia FORCE-N"')
        # Replace the first busuu link in the second part
        sub_parts[1] = sub_parts[1].replace('https://www.busuu.com/', 'https://formation.force-n.sn/course/view.php?id=649', 1)
        # Also replace "Compléter une leçon Busuu sans erreur" in that part
        sub_parts[1] = sub_parts[1].replace('Compléter une leçon Busuu sans erreur', 'Compléter un module Altissia sans erreur', 1)
        sub_parts[1] = sub_parts[1].replace('Capture d\\\'écran Busuu', 'Capture d\\\'écran Altissia', 1)
        
        # Rejoin everything back with 'title: "Busuu"' for the other parts
        final_content = sub_parts[0] + 'title: "Anglais Altissia FORCE-N"' + sub_parts[1]
        for i in range(2, len(parts)):
            final_content += 'title: "Busuu"' + parts[i]
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(final_content)
        print("Success: Mixed Altissia + Busuu.")
    else:
        print("Error: Could not find Busuu.")

if __name__ == "__main__":
    update_mixed()
