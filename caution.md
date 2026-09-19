I have a MovieBox clone project that is currently working.

I want to prepare this EXACT current project for GitHub and later deployment to:

Frontend → Vercel
Backend → Render

IMPORTANT:
DO NOT redesign the project.
DO NOT modify working features.
DO NOT modify the video player unnecessarily.
DO NOT change the UI.
DO NOT change Watch History.
DO NOT change resume functionality.
DO NOT change search functionality.
DO NOT change movie/TV/anime playback logic except for the specific API configuration issue described below.

Your job is to thoroughly inspect the entire project first, then make ONLY the security/GitHub/deployment-preparation changes described below.

========================================================
PROJECT STRUCTURE
========================================================

The project has:

Moviebox-API/
    → FastAPI backend

moviebox-frontend/
    → React + Vite frontend

The current working functionality includes:

- Movies playback
- TV Shows playback
- Anime playback
- Backend video proxy
- Resume playback
- Watch History
- Quality switching
- Captions
- Fullscreen
- Video view/ratio options
- Play/Pause button
- Search
- Search suggestions
- Search history
- Responsive UI

PRESERVE ALL OF THESE.

========================================================
STEP 1 — INSPECT THE ENTIRE PROJECT
========================================================

Before changing anything:

1. Recursively inspect the complete project.
2. Exclude these directories from the security scan:

node_modules/
.venv/
venv/
dist/
.git/
__pycache__/

3. Identify:
   - API keys
   - access tokens
   - bearer tokens
   - passwords
   - database credentials
   - private keys
   - cookies
   - authentication credentials
   - SMTP credentials
   - GitHub tokens
   - AWS credentials
   - Google credentials
   - signed/private URLs
   - hard-coded secrets

Search for:

token
Bearer
Authorization
Cookie
password
passwd
secret
api_key
apikey
client_secret
access_token
refresh_token
private_key
credentials
mongodb://
mongodb+srv://

IMPORTANT:
Do NOT print any actual secret values in your report.

If you find a real secret, report only:

FILE:
LINE:
TYPE:
ACTION REQUIRED:

========================================================
STEP 2 — CHECK THE EXISTING GIT REPOSITORY
========================================================

IMPORTANT:

The project currently contains:

Moviebox-API/.git/

This is an OLD/NESTED Git repository.

I want ONE Git repository for the entire MovieBox project.

Therefore:

Moviebox-API/.git/

must NOT become a nested Git repository inside the new GitHub repository.

Before initializing the new repository, inspect it for:

- previously committed secrets
- .env files
- credentials
- API keys
- tokens
- private URLs
- accidentally committed generated files

If the old Git history contains secrets:

1. Tell me exactly what type of secret was exposed.
2. DO NOT print the secret itself.
3. Tell me that the credential should be revoked/rotated.
4. Explain what needs to be cleaned before the new GitHub push.

Do NOT simply assume deleting a secret from the current source removes it from Git history.

========================================================
STEP 3 — FILES/FOLDERS THAT MUST NOT BE COMMITTED
========================================================

The following must NOT be pushed to GitHub:

Moviebox-API/.venv/
Moviebox-API/venv/
Moviebox-API/__pycache__/

moviebox-frontend/node_modules/
moviebox-frontend/dist/

Any:

.env
.env.local
.env.development
.env.development.local
.env.test
.env.test.local
.env.production
.env.production.local

Also ignore:

*.log
*.pyc
*.pyo
*.pyd
.DS_Store
.vscode/
.idea/

Do NOT delete useful source code.

Only remove/ignore generated/local files that should not be committed.

========================================================
STEP 4 — CREATE/FIX .gitignore
========================================================

Create or update the appropriate .gitignore files.

DO NOT blindly overwrite useful existing .gitignore rules.

Merge the required rules.

Frontend:

moviebox-frontend/.gitignore

It should contain at least:

node_modules/
dist/
dist-ssr/
*.local
.env
.env.*
!.env.example
.vscode/
.idea/
.DS_Store
*.log

Backend:

Moviebox-API/.gitignore

It should contain at least:

.venv/
venv/
__pycache__/
*.py[cod]
*.pyo
*.log
.env
.env.*
!.env.example
.vscode/
.idea/
.DS_Store

========================================================
STEP 5 — DO NOT COMMIT DIST OR NODE_MODULES
========================================================

The current project contains generated files.

Do NOT commit:

moviebox-frontend/node_modules/

Do NOT commit:

moviebox-frontend/dist/

Vercel should build the frontend from source.

Keep:

package.json
package-lock.json
vite.config.js
src/
public/

Do NOT delete package-lock.json.

========================================================
STEP 6 — PYTHON VIRTUAL ENVIRONMENT
========================================================

The backend currently contains:

Moviebox-API/.venv/

DO NOT commit it.

Render will install the Python dependencies using:

requirements.txt

Inspect:

Moviebox-API/requirements.txt

Make sure it contains the dependencies required by api.py.

Do NOT randomly upgrade packages.

Do NOT randomly add packages.

Do NOT remove required packages.

========================================================
STEP 7 — FRONTEND API CONFIGURATION
========================================================

This is IMPORTANT.

The frontend already has:

moviebox-frontend/src/config.js

It contains an environment-variable-based API configuration similar to:

const browserHost = typeof window !== "undefined"
    ? window.location.hostname
    : "127.0.0.1";

export const API_URL =
    import.meta.env.VITE_API_URL ||
    `http://${browserHost}:8000`;

This configuration should be preserved.

The project also has:

moviebox-frontend/.env.example

which contains:

VITE_API_URL=http://127.0.0.1:8000

This is SAFE to commit because it is an example configuration.

KEEP .env.example.

DO NOT put real secrets in .env.example.

========================================================
STEP 8 — IMPORTANT Watch.jsx API ISSUE
========================================================

Inspect:

moviebox-frontend/src/pages/Watch.jsx

The current Watch.jsx contains a hard-coded API URL similar to:

const API_URL = "http://127.0.0.1:8000";

This is NOT suitable for deployment.

The rest of the project already has:

src/config.js

Therefore, use the existing configuration system consistently.

Instead of hard-coding:

const API_URL = "http://127.0.0.1:8000";

Watch.jsx should import the existing API_URL from config.js using the correct relative import path.

For example, if the import path is correct:

import { API_URL } from "../config";

Use the actual correct relative path based on the project's structure.

IMPORTANT:

DO NOT modify the actual video playback logic.

DO NOT modify:

- source selection
- proxy logic
- quality selection
- resume
- history
- player controls
- play/pause
- fullscreen
- captions
- view/ratio options

ONLY replace the hard-coded API configuration with the existing config.js value.

========================================================
STEP 9 — PRODUCTION API URL
========================================================

For local development:

VITE_API_URL=http://127.0.0.1:8000

For production on Vercel:

VITE_API_URL=https://YOUR-RENDER-BACKEND.onrender.com

DO NOT hard-code the Render URL into the source code.

Vercel will provide VITE_API_URL as an environment variable.

========================================================
STEP 10 — BACKEND api.py
========================================================

Inspect:

Moviebox-API/api.py

The backend contains upstream configuration such as:

BASE_URL = "https://moviebox.ph"

API_BASE = "https://h5-api.aoneroom.com/wefeed-h5api-bff"

These are URLs and are NOT automatically secrets.

DO NOT hide ordinary public API/upstream URLs unnecessarily.

The backend also has runtime bearer-token acquisition.

For example:

_bearer_token = None

and a function that obtains the bearer token dynamically.

DO NOT convert runtime token acquisition into a hard-coded token.

DO NOT put a bearer token into GitHub.

DO NOT log or print the actual bearer token.

If a real bearer token exists anywhere in the source or Git history:

DO NOT expose its value.

Tell me:

FILE:
LINE:
TYPE: bearer/access token
ACTION: revoke/rotate and remove from Git history

========================================================
STEP 11 — SIGNED VIDEO URLS
========================================================

The application dynamically works with video URLs that may contain things such as:

sign=
t=

These are signed URLs.

Do NOT hard-code a currently generated signed video URL into source code.

Do NOT commit cached signed URLs if they contain access credentials.

If they are dynamically generated at runtime, leave the functionality unchanged.

========================================================
STEP 12 — CORS
========================================================

Inspect the backend CORS configuration.

If it currently contains:

allow_origins=["*"]

DO NOT change it automatically.

The application needs to work locally first.

For production, I eventually want CORS restricted to my Vercel frontend domain.

But do NOT break local development during this cleanup.

Report the recommended production CORS configuration separately.

========================================================
STEP 13 — VERCEL DEPLOYMENT PREPARATION
========================================================

Frontend:

moviebox-frontend/

It is a Vite + React application.

Do NOT convert the project to another framework.

Do NOT change React/Vite versions.

Vercel should build the frontend from source.

The production environment variable will be:

VITE_API_URL=https://YOUR-RENDER-BACKEND.onrender.com

Do NOT put the real production URL into source code.

========================================================
STEP 14 — RENDER DEPLOYMENT PREPARATION
========================================================

Backend:

Moviebox-API/

Render should run FastAPI using:

uvicorn api:app --host 0.0.0.0 --port $PORT

Build command should be:

pip install -r requirements.txt

Do NOT use:

127.0.0.1

for the Render server binding.

The backend must listen on:

0.0.0.0

because Render needs external access.

========================================================
STEP 15 — DO NOT CHANGE WORKING FEATURES
========================================================

THIS IS VERY IMPORTANT.

Do NOT modify:

Watch.jsx player behavior
App.css
player controls
play/pause logic
video source logic
resume logic
watch history
quality switching
captions
fullscreen
aspect ratio/view options
movie playback
TV playback
anime playback
search
search suggestions
search history
navbar
responsive styling

UNLESS the specific change is required for deployment configuration.

The project is already working.

I am only preparing it for:

GitHub
Vercel
Render

========================================================
STEP 16 — CHECK FOR SECRET FILES
========================================================

After cleanup, recursively check tracked/project files again.

Search for:

.env
*.pem
*.key
credentials
secret
token
password
api_key
apikey
client_secret
access_token
refresh_token
private_key

Do NOT include:

node_modules/
.venv/
dist/
.git/

in the scan.

Report anything suspicious.

Do NOT expose actual secret values.

========================================================
STEP 17 — PREPARE ONE CLEAN GIT REPOSITORY
========================================================

IMPORTANT:

The repository must be initialized from the ROOT MovieBox project folder.

The new repository structure should be:

moviebox-clone/
│
├── Moviebox-API/
│   ├── api.py
│   ├── requirements.txt
│   ├── .gitignore
│   └── ...
│
├── moviebox-frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   ├── .env.example
│   └── .gitignore
│
├── README.md
└── .gitignore (if needed)

There must NOT be:

Moviebox-API/.git/

inside the final repository.

========================================================
STEP 18 — GITHUB README
========================================================

Inspect the existing README.

If README.md does not exist at the root, create a simple professional README.

Do NOT include:

- API keys
- bearer tokens
- passwords
- signed URLs
- private credentials
- local absolute file paths
- personal/private information

The README should explain:

- MovieBox clone
- React/Vite frontend
- FastAPI backend
- how to run locally
- environment variable
- Vercel deployment
- Render deployment

Keep it concise and professional.

========================================================
STEP 19 — FINAL GIT CHECK
========================================================

Before pushing, run/check:

git status

Then verify that these are NOT staged:

node_modules
.venv
dist
.env
.git inside Moviebox-API
*.pyc
*.log

Also verify:

package-lock.json IS staged.

requirements.txt IS staged.

.env.example IS staged.

Source files ARE staged.

========================================================
STEP 20 — GITHUB REPOSITORY
========================================================

I want the GitHub repository:

https://github.com/iamVishnuP/moviebox-clone.git

The repository should be the single root repository for the complete project.

IMPORTANT:
Do NOT create a nested repository.

========================================================
STEP 21 — GITHUB COMMANDS
========================================================

After ALL security checks and cleanup are complete, use these commands from the ROOT project directory.

If the root project does not already have a .git directory:

git init

Then:

git add .

IMPORTANT:
Do NOT use:

git add README.md

alone.

I need the COMPLETE cleaned project committed, not only README.md.

Then verify:

git status

If everything looks correct:

git commit -m "first commit"

Then:

git branch -M main

Then:

git remote add origin https://github.com/iamVishnuP/moviebox-clone.git

Then:

git push -u origin main

========================================================
STEP 22 — IF A REMOTE ALREADY EXISTS
========================================================

Before running:

git remote add origin ...

check:

git remote -v

If origin already exists, DO NOT blindly run git remote add origin again.

Instead report the existing remote and tell me what command should be used.

Do not overwrite an existing remote without confirmation.

========================================================
STEP 23 — VERY IMPORTANT BEFORE PUSHING
========================================================

DO NOT push until the following are confirmed:

[ ] No .env files containing secrets
[ ] No API keys
[ ] No bearer tokens
[ ] No passwords
[ ] No private keys
[ ] No credentials
[ ] No signed URLs stored in source
[ ] No node_modules
[ ] No .venv
[ ] No dist
[ ] No __pycache__
[ ] No nested Moviebox-API/.git
[ ] No accidentally committed Git history containing secrets
[ ] Watch.jsx no longer hard-codes 127.0.0.1
[ ] Existing config.js is used
[ ] .env.example is present
[ ] package-lock.json is present
[ ] requirements.txt is present
[ ] README.md is present
[ ] Application functionality remains unchanged

========================================================
STEP 24 — FINAL REPORT
========================================================

After completing the inspection/cleanup, give me the result in this exact structure:

1. SECURITY STATUS
Safe / Issues found

2. SECRETS FOUND
List files and line numbers only.
NEVER print secret values.

3. FILES EXCLUDED FROM GITHUB
List them.

4. FILES CHANGED
List exact files and explain why.

5. WATCH.JSX API CHANGE
Give exact old line and new line.

6. GITIGNORE
List what was added.

7. NESTED GIT
Explain whether Moviebox-API/.git was removed/handled.

8. LOCAL RUN COMMANDS

Backend:

python -m uvicorn api:app --host 127.0.0.1 --port 8000 --reload

Frontend:

npm run dev

9. RENDER SETTINGS

Root directory:
Moviebox-API

Build command:

pip install -r requirements.txt

Start command:

uvicorn api:app --host 0.0.0.0 --port $PORT

10. VERCEL SETTINGS

Root directory:

moviebox-frontend

Environment variable:

VITE_API_URL=https://YOUR-RENDER-BACKEND.onrender.com

11. FINAL GITHUB COMMANDS

Show the exact commands:

git init
git add .
git status
git commit -m "first commit"
git branch -M main
git remote -v
git remote add origin https://github.com/iamVishnuP/moviebox-clone.git
git push -u origin main

IMPORTANT:
If git remote -v already shows origin, do NOT run git remote add origin again.
Explain the correct command instead.

12. FINAL VERIFICATION

Confirm that the project is ready for GitHub push.

DO NOT make unnecessary application changes.
DO NOT change the player.
DO NOT change UI.
DO NOT change existing functionality.
ONLY perform the requested GitHub/security/deployment preparation.