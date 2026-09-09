import os, glob

def fix():
    files = glob.glob('src/ui/**/*.js', recursive=True)
    files.append('src/engines/AIGeneratorEngine.js')
    
    for f in files:
        if not os.path.exists(f): continue
        with open(f, 'r', encoding='utf-8') as file:
            content = file.read()
        
        if r'\`' in content or r'\${' in content:
            print(f"Fixing {f}")
            content = content.replace(r'\`', '`').replace(r'\${', '${')
            with open(f, 'w', encoding='utf-8') as file:
                file.write(content)

if __name__ == '__main__':
    fix()
