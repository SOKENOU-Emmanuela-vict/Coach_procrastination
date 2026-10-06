import os
import re

for file in os.listdir('.'):
    if file.startswith('test_') and (file.endswith('.mjs') or file.endswith('.js')):
        with open(file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Fix assert functions
        content = re.sub(
            r'console\.error\(`(❌\s*FAIL:|FAIL:)([^`]+)`\);(?!\s*process\.exitCode)',
            r'console.error(`\1\2`); process.exitCode = 1;',
            content
        )

        # Fix catch(console.error)
        content = re.sub(
            r'\.catch\(console\.error\);',
            r'.catch(e => { console.error(e); process.exitCode = 1; });',
            content
        )
        
        # Fix catch(e => { console.error(e); }) at the very end of files
        content = re.sub(
            r'\.catch\(e\s*=>\s*\{\s*console\.error\(e\);\s*\}\);',
            r'.catch(e => { console.error(e); process.exitCode = 1; });',
            content
        )

        # Fix other variants of main runners
        content = re.sub(
            r'\.catch\(e\s*=>\s*\{\s*console\.error\(e\);\s*process\.exit\(1\);\s*\}\);',
            r'.catch(e => { console.error(e); process.exitCode = 1; });',
            content
        )

        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)

print("Tests updated to set process.exitCode = 1 on failure or unhandled exception.")
