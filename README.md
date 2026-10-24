> [!IMPORTANT]
> ## 📁 Submission Documents & Templates
> **All required submission templates are in the Google Drive folder below. Download them before you start.**
>
> ### 👉 [**OPEN THE GOOGLE DRIVE FOLDER**](https://drive.google.com/drive/folders/1xw7c2aN8N-at8hPEULzkcU76e_FFb0Ef) 👈

---

# FindMyCareer

> An AI-assisted career guidance web app helping jobseekers, graduates, and career switchers explore job matches, identify skill gaps, and find learning opportunities.

---

## Team Information

| Field                  | Details                                     |
| ---------------------- | ------------------------------------------- |
| **Team Name**          | The Solution 500                              |
| **Team Domain**        | Domain 1 — Aiversecity Future-Ready Workforce          |
| **SDG Track (1–17)**   | SDGs 4, 5, 8, 9, 10 |
| **Team Leader**        | Daniel Wilson Gunawan                                 |
| **University**         | Xiamen University Malaysia                          |
| **Number of Members**  | 4                                      |

## Links

| Resource          | Link                                           |
| ----------------- | ---------------------------------------------- |
| GitHub Repository | https://github.com/Wilson232/SDC_Hackathon_Solution500  |
| Live Demo         | https://findmycareer.replit.app                |
| RunPod Endpoint   | Not used (N/A)      |
| Slide Deck        | https://docs.google.com/presentation/d/13j79Ut8sPvdAuliBRA8zdP_7oK8V6_aNL2sjDHeOf3c/edit?usp=sharing |
| Demo Video        | https://youtu.be/yuiXrEaLkm4?si=AGQMCWx0SVMod9Bj                 |

---

## Overview

### Problem

AI is reshaping job requirements faster than many workers and graduates can adapt. Jobseekers, career switchers, and people at risk of displacement may struggle to identify relevant roles and the skills needed to qualify. Employers and educators also need clearer evidence of changing workforce needs.

### Solution

FindMyCareer combines profile information with collected JobStreet job listings and Skool course information to support career matching and learning recommendations. Apify helps collect source data, Replit hosts the web application, and Botpress provides in-app career coaching. Recommendations support user decisions rather than replace human judgment; job and course information is based on collected snapshots and may become outdated.

### Key Features

- **Profile and CV intake** — Users can enter their education, experience, skills, preferences, and CV details.
- **Career matching** — Matches user profiles with career opportunities and displays match information.
- **Malaysia match heatmap** — Visualises location-based matching results.
- **Course discovery** — Uses collected Skool course information to support skill development.
- **AI career coach** — Botpress webchat answers career-related questions.
- **SDG alignment and future-readiness** — Project goals align with SDGs 4, 5, 8, 9, and 10; confirm which mappings and forecasts are implemented in the deployed app.

### Tech Stack

| Layer         | Technology                   |
| ------------- | ---------------------------- |
| Frontend      | React 18.3.1, TypeScript / JavaScript, HTML, CSS, Lucide React |
| Backend       | Node.js 24, Express 5, TypeScript (`tsx`) |
| Database      | PostgreSQL 16 (`pg`), browser localStorage for selected client-side state |
| Authentication | Clerk |
| Build / UI    | Vite 7, Tailwind CSS (CDN), Babel |
| CV Processing | PDF.js, Mammoth |
| Data Sources  | JobStreet and Skool CSV snapshots collected with Apify |
| AI / Coaching | Botpress Webchat; optional Gemini API described in technical declaration (live calls unverified) |
| Storage       | Replit App Storage for certificate uploads |
| Hosting / Dev | Replit; OpenAI Codex and Replit AI for development |
---

## Project Structure

```
.
├── app.tsx                  # Main React application
├── client/                  # Client entry point and certificate workflow
├── server/                  # Express API, Clerk auth, PostgreSQL, certificates
│   ├── index.ts             # Application server entry point
│   └── schema.sql           # Database schema
├── scripts/                 # Build, setup and verification utilities
├── tests/                   # Node.js automated tests
├── attached_assets/         # UI assets
├── jobstreet-data.csv       # Job listing snapshot
├── skool-course-data.csv    # Course catalogue snapshot
├── cv-parser.mjs            # CV parsing utilities
├── package.json             # Node.js scripts and dependencies
├── package-lock.json        # Dependency lockfile
├── vite.config.mjs          # Vite configuration
├── submission/              # Required hackathon documents (add to repository)
│   ├── SDC2026_The Solution 500_Preliminary.pdf
│   ├── SDC2026_The Solution 500_TechDeclaration.pdf
│   └── SDC2026_The Solution 500_Replit_POU.pdf
├── .env.example             # Placeholder variables only (create if needed)
├── .gitignore
├── .replit                  # Replit Node.js run/deploy configuration
├── LICENSE                  # Submission repository license (if included)
└── README.md
```

### Architecture

```
User ──► React UI on Replit ──► Express API ──► PostgreSQL / App Storage
                  │                 │
                  ├──► JobStreet / Skool CSV snapshots (collected with Apify)
                  ├──► Career matching / CV parsing
                  └──► Botpress Webchat (career coaching)
```

The supplied export contains snapshot CSV files; a scheduled live refresh from Apify is not verified. The optional Gemini API integration is not confirmed to be active.
---

## How to Run

### Option 1 — Run on Replit (Recommended)

1. Open the [Live Demo](https://findmycareer.replit.app), or import the [GitHub repository](https://github.com/Wilson232/SDC_Hackathon_Solution500) into Replit.
2. Set up the project's Clerk application, PostgreSQL database and private Replit App Storage bucket. Configure the environment variables described below using Replit Secrets, not committed files.
3. Run `npm ci` to install dependencies. Initialize the development database with `bash scripts/post-merge.sh` when setting up a fresh development environment.
4. Click **Run** or execute `npm start`. The actual `.replit` runs `npm start`, serving the application on port 5000.

### Option 2 — Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/Wilson232/SDC_Hackathon_Solution500.git
cd SDC_Hackathon_Solution500

# 2. Install Node.js 24 and dependencies
npm ci

# 3. Configure the required environment variables (use real values privately)
# CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY, VITE_CLERK_PUBLISHABLE_KEY
# DATABASE_URL, ADMIN_EMAILS, CERTIFICATE_BUCKET_ID

# 4. Initialize the development PostgreSQL schema (once)
bash scripts/post-merge.sh

# 5. Start the app
npm start
```

A working local deployment also requires a configured Clerk instance, PostgreSQL database and storage bucket. The export does not contain hosted database contents or credentials. Production deployment uses `npm run build` followed by `NODE_ENV=production npm start`, with production database migrations configured separately.

### Run Tests

```bash
npm test
```
---

## How We Use Replit *(Required)*

- **Development:** Replit was used to develop, run, test and debug the React and Express application, with Replit AI assistance.
- **Hosting:** The app is deployed at the Live Demo link above. The `.replit` file specifies `npm start`, an autoscale deployment target and a Vite build.
- **Services:** The exported project uses PostgreSQL, Clerk authentication and Replit App Storage for its certificate workflow.
- **Secrets:** Credentials must be configured privately using Replit Secrets or an equivalent secret manager; they are not included in the exported source.

📄 Proof of use: [`submission/SDC2026_The Solution 500_Replit_POU.pdf`](submission/SDC2026_The%20Solution%20500_Replit_POU.pdf)

## How We Use RunPod *(Required)*

RunPod was **not used** for FindMyCareer. The project instead uses Replit for hosting and computation, and Botpress for its embedded career coaching. No RunPod endpoint or RunPod proof-of-use document is available. Confirm with the organizers whether RunPod is mandatory for eligibility.

Example request:

```bash
# RunPod: not applicable to this project.
# Start the actual Node.js application with: npm start
```

📄 Proof of use: Not applicable (RunPod not used).
---

## Challenges & Learnings

- **Data freshness:** JobStreet and Skool data is collected as snapshots; updating and validating source data remains important.
- **Reliable recommendations:** Career matches and course suggestions must be checked for relevance and should not be treated as guaranteed predictions.
- **Responsible development:** We learned to disclose third-party tools, protect credentials, and use sample profiles rather than sensitive personal data during demos.

## Future Improvements

- [ ] Automate refreshes and display the source and collection date for job-market and course data.
- [ ] Improve transparent match scoring, skills-gap explanations, and ordered reskilling plans.
- [ ] Add or strengthen moderate-versus-fast AI disruption scenarios and meaningful SDG mappings.
- [ ] Improve authentication, privacy controls, and validation of recommendations.

## Team

| Name        | Role                | GitHub                                   |
| ----------- | ------------------- | ---------------------------------------- |
| Daniel Wilson Gunawan | Team Lead; AI-assisted coding, frontend, backend, documentation | [@Wilson232](https://github.com/Wilson232) |
| Nathanael Suryaputra | Design, pitching, ideation, documentation | Not provided |
| Kathallia Jennitta Setiadi | Design, pitching, ideation, documentation | Not provided |
| Halleya Givetha Lysander | AI-assisted coding, frontend, backend | Not provided |
---

## Submission Checklist

- [x] Team name, domain (Domain 1) and SDG track filled in
- [x] Slide deck link added
- [ ] Demo video link added (pending)
- [ ] Replit used; add and verify proof of use in `submission/`
- [x] RunPod not used; marked as not applicable
- [x] Preliminary proposal document prepared (`SDC2026_The Solution 500_Preliminary.pdf`)
- [x] Technology declaration document prepared (`SDC2026_The Solution 500_TechDeclaration.pdf`)
- [ ] Verify submission files are placed in `submission/` with the correct required filenames
- [ ] "How to Run" steps based on source export; fresh setup not independently tested
- [ ] No API keys or secrets committed to the repository

## License

The submission template references the [Apache License 2.0](LICENSE). Confirm that the repository contains this LICENSE file and that the team intends to use it.
