<p align="center">
  <img src="public/navispot.png" alt="NaviSpot Logo" width="200">
</p>

---

# NaviSpot

> Export Spotify playlists to your self-hosted Navidrome music server

[![Live Demo](https://img.shields.io/badge/Live%20Demo-navispot.gaga.pro.et-blue?style=flat&logo=vercel)](https://navispot.gaga.pro.et/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🤖 AI-Assisted Development Notice

> **This project has been developed with the assistance of various Large Language Models (LLMs) for planning and writing code.** All features and functionalities have been tested to meet the project's requirements and quality standards.

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [🚀 Quick Start](#-quick-start)
- [🎯 How It Works](#-how-it-works)
- [📸 Screenshots](#-screenshots)
- [⚙️ Setup](#%EF%B8%8F-setup)
- [📦 Deployment](#-deployment)
- [💝 Donations](#-donations)
- [🛠️ Tech Stack](#%EF%B8%8F-tech-stack)
- [📚 Documentation](#-documentation)
- [📝 License](#-license)

---

## ✨ Features

- **🌐 Public Playlist Import** – Paste any public Spotify playlist URL to export it to Navidrome, no Spotify login required
- **🔐 Two Auth Paths** – Connect your Spotify account for personal/private exports, or skip Spotify and use only Navidrome
- **🎯 Smart Matching** – ISRC, fuzzy, and strict matching strategies
- **📊 Batch Export** – Export multiple playlists at once (mix Spotify-owned and imported in one batch)
- **🔄 Differential Exporting** – Sync only new tracks (single browser session)
- **📤 JSON Export** – Export unmatched tracks as JSON
- **⚡ Real-time Progress** – Live export tracking with match statistics
- **👁️ Export Preview** – Review matches before committing
- **🧹 Clear Imported** – One-click button with confirmation modal to wipe all imported playlists

---

## 🚀 Quick Start

### Path A: With Spotify (full library access)

> **Requires a Spotify Premium account** if you're using the live demo linked above, since the deployed app is in Spotify's Development mode and Premium is required to authorize it. If you're self-hosting with your own dev-mode Spotify app, any account you add to the app's allowlist will work — but the user completing the OAuth flow still needs to be on the Premium tier to authorize.

1. **Connect Spotify** – Click "Connect Spotify" and authorize the app
2. **Enter Navidrome** – Fill in your Navidrome server URL, username, and password
3. **Select & Export** – Browse your playlists, check what to export, click Export

### Path B: Without Spotify (public playlists only)

> **No Spotify login, Premium, or API credentials required.** Public playlists are read from Spotify's public pages. Lists beyond the public embed's 100-track limit use the separate browser worker included in Docker Compose.

1. **Enter Navidrome** – Fill in your Navidrome server URL, username, and password
2. **Click "Continue without Spotify"** on the login page
3. **Paste a public Spotify playlist URL** into the search box on the dashboard
4. **Click Import** (the green button next to the search box)
5. **Select & Export** – The imported playlist is auto-selected; click Export

> **Tip:** The search field does double duty — type text to filter, or paste a Spotify URL and the import button enables automatically.

---

## 🎯 How It Works

### Matching Strategy Chain

1. **ISRC** → Exact match via unique recording code
2. **Fuzzy** → Similarity matching (80% threshold)
3. **Strict** → Normalized exact string match

Unmatched tracks can be exported as JSON for later addition to Navidrome.

---

## 📸 Screenshots

|              Login              |             Dashboard              |                    Export Progress                    |
| :-----------------------------: | :--------------------------------: | :---------------------------------------------------: |
| ![Login](public/login-page.png) | ![Dashboard](public/dashboard.png) | ![Progress](public/dashboard-exporting-playlists.png) |
| Connect to Spotify & Navidrome  |    Browse and select playlists     |              Real-time progress tracking              |

---

## ⚙️ Setup

### Prerequisites

- Node.js 20.9+
- Spotify Developer account and Spotify login only for personal/private Spotify playlists
- Running Navidrome instance

### Local Development

```bash
# Clone & install
git clone https://github.com/betsha1830/navispot.git
cd navispot
bun install

# Configure
cp .env.example .env.local
# Edit .env.local with your credentials

# Run
bun dev
```

For public playlists of 100 tracks or more during local development, start the separate `spotify-browser-worker` (see its package files) and set `SPOTIFY_BROWSER_WORKER_URL=http://127.0.0.1:8787` in `.env.local`. Docker Compose configures this automatically.

> **Note:** Spotify requires HTTPS for redirect URIs. If you're developing locally, use `bun dev --experimental-https` instead of `bun dev`. This generates a self-signed cert and serves your app over HTTPS at `https://localhost:3000`. You may also need to use your local network address (e.g., `https://192.168.x.x:3000`) and add it as a redirect URI in the Spotify Developer Dashboard.

**Spotify Setup:**

1. Create app at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Add one of the following as your Redirect URI. or to Redirect URIs. Spotify only allows the following loopback addresses: `http://127.0.0.1:PORT` or `http://[::1]:PORT`
  1. localhost: `http://127.0.0.1:3000/api/auth/callback`
  2. Remote host: `https://your-domain.com/api/auth/callback`
4. Copy Client ID & Secret to `.env.local`

---

## 📦 Deployment

### Docker (Recommended)

```bash
docker compose up -d
```

Compose runs a separate Playwright/Chromium worker for long public playlists. Its port is available only inside the Compose network; the main NaviSpot image does not include Chromium.

**Production Variables:**

```env
SPOTIFY_REDIRECT_URI=https://your-domain.com/api/auth/callback # localhost: http://127.0.0.1:3000/api/auth/callback
NEXT_PUBLIC_APP_URL=https://your-domain.com #localhost: http://127.0.0.1:3000
```

Update Spotify Dashboard with your production redirect URI.

---

## 💝 Donations

If NaviSpot helps you migrate your music library, consider supporting development:

| Coin           | Address                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------- |
| **BTC**        | `bc1q8madmx95n2ve8e7xr38d2fyldafxjg25ffeuts`                                                      |
| **ETH**        | `0xFee844879Bd716BE64580b8D2B8835ff76622671`                                                      |
| **BCH**        | `qqep38q5t9fm3kxe96pek4cr49xz3u4exsq0x9t4xe`                                                      |
| **TRX**        | `TM5evHNFfcy2WbrDbMpUMZdKotZw958WcG`                                                              |
| **SOL**        | `9tXhy1xhs1MkXVonNkozwxwYHHwH4iifjrFakeY5wS55`                                                    |
| **XNO (NANO)** | `nano_371m8ijecct9csm18eubojmfkf7rt1bxq4frs43bo5ybmsbpwxyywhqz9wh3`                               |
| **POL**        | `0xFee844879Bd716BE64580b8D2B8835ff76622671`                                                      |
| **LTC**        | `ltc1qaf5an5qultyw47xjees3d7uwnext2rszg93njj`                                                     |
| **XMR**        | `84euv4YWNe4WGBm8hrPWKV8PSQpGvRzsFB9jyWhSCs45Z13mfU8qAyARaiqjc9CPCcSspyprd4Qv1KfbSVaHwxH9HRNmTjC` |

**[❤️ Support on Patreon](https://www.patreon.com/667702/join)** · **[❤️ Support on Patreon with one-time donation](https://www.patreon.com/posts/one-time-support-153508783?utm_medium=clipboard_copy&utm_source=copyLink&utm_campaign=postshare_creator&utm_content=join_link)**

Your support helps maintain and improve this open-source project! 🙏

---

## 🐛 Bug Reports & Feature Requests

Found a bug or have a feature idea? We welcome your feedback!

### Reporting Bugs 🐞

Please [open an issue](../../issues/new?labels=bug) and include:

- **Error messages** (screenshots or console logs)
- **Spotify account type** (Free or Premium)
- **Navidrome setup** (Local or Remote server)
- **Browser** you're using to access NaviSpot
- **Steps to reproduce** the issue
- **Expected vs actual behavior**

### Requesting Features ✨

Please [open an issue](../../issues/new?labels=enhancement) and include:

- **Feature description** – What you'd like to see
- **Use case** – Why this would be helpful
- **Any examples** from other apps (if applicable)

We appreciate detailed reports that help us improve NaviSpot for everyone!

---

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **APIs:** Spotify Web API (authenticated features), Spotify public pages (public import), Navidrome Subsonic API
- **Public import:** Static embed metadata with an isolated browser-worker fallback for long playlists

### Spotify App Configuration Notes

- The app only requests three scopes: `playlist-read-private`, `playlist-read-collaborative`, `user-library-read`. No write scopes.
- In **Development Mode**, authenticated Spotify access remains limited by Spotify's app rules. Public playlist import does not use the app's OAuth or Client Credentials.

---

## 📚 Documentation

Feature docs available in `docs/`:

| Phase  | Features                                          |
| ------ | ------------------------------------------------- |
| **F1** | Setup, OAuth, API Clients, Auth                   |
| **F2** | Matching (ISRC, Fuzzy, Strict), Export, Favorites |
| **F3** | UI Components, Dashboard, Progress Tracking       |

See [full feature index](docs/) for details.

---

## 👥 Contributors

We appreciate all contributions to NaviSpot!

<a href="https://github.com/FaKiieZ"><img src="https://github.com/FaKiieZ.png" width="50" height="50" alt="FaKiieZ" style="border-radius: 50%; margin: 5px;"></a>
<a href="https://github.com/WB2024"><img src="https://github.com/WB2024.png" width="50" height="50" alt="WB2024" style="border-radius: 50%; margin: 5px;"></a>
<a href="https://github.com/drunkrhin0"><img src="https://github.com/drunkrhin0.png" width="50" height="50" alt="drunkrhin0" style="border-radius: 50%; margin: 5px;"></a>

Want to contribute? Check out our [issue tracker](../../issues) for ways to help!

---

## 📝 License

MIT License – Open Source

Copyright (c) 2026 NaviSpot

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
