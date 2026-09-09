import json
import re

def update_english_links():
    file_path = 'src/data/BootcampProgram.js'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # We will replace all occurrences of 'Busuu' in titles with 'Anglais Altissia'
    content = re.sub(r'title:\s*"Busuu"', 'title: "Anglais Altissia FORCE-N"', content)
    
    # Replace Busuu links
    content = content.replace('https://www.busuu.com/', 'https://formation.force-n.sn/course/view.php?id=649')
    
    # Replace other english generic links with the new course? 
    # Or just leave them if they are varied activities (Scrabble, cartoons). 
    # The user specifically said "Anglais Altissia FORCE-N", which replaces Busuu (the main course).
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    update_english_links()
    print("Done updating english links!")
