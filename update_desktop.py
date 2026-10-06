import re
import sys

file_path = 'src/ui/DesktopView.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Profile button
content = content.replace(
    '<div style="width:40px; height:40px; border-radius:50%; background:var(--accent-primary); display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:18px;">\n                    ${userName.charAt(0)}\n                </div>',
    '<div id="btn-profile" style="width:40px; height:40px; border-radius:50%; background:var(--accent-primary); display:flex; align-items:center; justify-content:center; color:white; font-weight:bold; font-size:18px; cursor:pointer; transition: transform 0.2s;" onmouseover="this.style.transform=\'scale(1.1)\'" onmouseout="this.style.transform=\'scale(1)\'">\n                    ${userName.charAt(0)}\n                </div>'
)

# 2. Update Continuer -> Voir le cours
content = content.replace(
    '<button id="btn-desktop-course" style="background:white; color:var(--accent-primary); border:none; padding:10px 20px; border-radius:8px; font-weight:bold; cursor:pointer; flex-grow:1;">\n                                Continuer\n                            </button>',
    '<button id="btn-desktop-course" style="background:white; color:var(--accent-primary); border:none; padding:10px 20px; border-radius:8px; font-weight:bold; cursor:pointer; flex-grow:1;">\n                                Voir le cours\n                            </button>'
)

# 3. Add Event Listeners
target_listener = """        const btnCourse = this.container.querySelector('#btn-desktop-course');
        if (btnCourse) {
            btnCourse.addEventListener('click', () => {
                // Pour la maquette : La session est "Anglais", on redirige vers l'espace Langues
                if (this.app.router) {
                    this.app.renderView('languages');
                }
            });
        }
    }
}"""

new_listener = """        const btnCourse = this.container.querySelector('#btn-desktop-course');
        if (btnCourse) {
            btnCourse.addEventListener('click', () => {
                // Pour la maquette : La session est "Anglais", on redirige vers l'espace Langues
                if (this.app.renderView) {
                    this.app.renderView('languages');
                } else if (this.app.router) {
                    this.app.router.render('languages', this.app.state);
                }
            });
        }

        const btnProfile = this.container.querySelector('#btn-profile');
        if (btnProfile) {
            btnProfile.addEventListener('click', () => {
                if (this.app.renderView) {
                    this.app.renderView('portfolio');
                } else if (this.app.router) {
                    this.app.router.render('portfolio', this.app.state);
                }
            });
        }
    }
}"""

content = content.replace(target_listener, new_listener)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
