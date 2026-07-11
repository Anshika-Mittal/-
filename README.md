# BigQuery Release Notes Radar

A modern, fast, and responsive web application to track Google Cloud BigQuery release notes in real-time, featuring a premium glassmorphism dark theme UI, automated RSS feed parsing/splitting, search/filter metrics, and an interactive Twitter/X composer with character-limit tracking and dynamic SVG progress indication.

---

## 🚀 Core Features

- **Granular Release Splitting**: Auto-splits daily release notes from the GCP feed into separate cards categorized by type (e.g., *Feature*, *Change*, *Deprecation*).
- **Interactive UI Dashboard**: Premium dark mode designed with Outfit/Inter typography, animated background glow orbs, and glassmorphic cards.
- **Smart Twitter/X Composer**: Slides in a composer drawer pre-drafting the tweet text, truncating details to fit X's 280-character limit alongside links and category hashtags.
- **In-Memory Caching**: Implements a 10-minute caching mechanism to keep pages fast and prevent hitting GCP rate limits, with a manual force-refresh spinner.
- **Dynamic Stats Summary**: Live counter cards mapping totals and category breakdown.

---

## 🛠️ Technology Stack

- **Backend**: Python 3.13+ with Flask
- **XML Parsing**: feedparser & BeautifulSoup (bs4)
- **Frontend**: Plain Vanilla HTML5, CSS3 (variables, transitions, backdrop-filter), and JavaScript (ES6+)

---

## 📂 Project Structure

- [app.py](file:///C:/Users/mitta/Desktop/SUB/AI/kaggle-5day-ai-agents/agy-cli-project/bg-release-notes/app.py): The Flask backend serving the index page, API endpoints, feed fetching, and HTML parsing/splitting logic.
- [templates/index.html](file:///C:/Users/mitta/Desktop/SUB/AI/kaggle-5day-ai-agents/agy-cli-project/bg-release-notes/templates/index.html): HTML structure defining the dashboard components and Twitter compose drawer.
- [static/css/style.css](file:///C:/Users/mitta/Desktop/SUB/AI/kaggle-5day-ai-agents/agy-cli-project/bg-release-notes/static/css/style.css): Custom stylesheet providing dark layout styling, category colors, and slide animations.
- [static/js/app.js](file:///C:/Users/mitta/Desktop/SUB/AI/kaggle-5day-ai-agents/agy-cli-project/bg-release-notes/static/js/app.js): Script handling frontend state, search filters, card selection, character limits, and Twitter Web Intent compose actions.
- [.gitignore](file:///C:/Users/mitta/Desktop/SUB/AI/kaggle-5day-ai-agents/agy-cli-project/bg-release-notes/.gitignore): Specifies files ignored by version control (virtual environments, pycaches).

---

## ⚡ Quick Start

### 1. Prerequisites
Ensure you have Python 3.13+ installed on your system.

### 2. Setup Virtual Environment & Install Dependencies
Navigate to the root of the project directory and run:

```powershell
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Windows (Command Prompt):
.\venv\Scripts\activate.bat
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install flask requests feedparser beautifulsoup4
```

### 3. Run the App
Start the Flask development server:
```bash
python app.py
```

Open your web browser and go to:
**[http://localhost:5000/](http://localhost:5000/)**

---

## 🐦 How the Tweet Composer Works

1. Click any release note card or the Twitter icon on the card.
2. The Twitter Draft Drawer slides up from the bottom of the screen.
3. The app auto-composes a tweet containing:
   - 🚀 Header & date
   - `#Category` tag
   - A truncated portion of the update description (capped so total length fits the limit)
   - Read More link pointing directly to that date on GCP release notes
4. An SVG circular progress ring shows you remaining space. It turns yellow when within 20 characters of the 280 limit, and turns red (disabling sharing) if you write too much.
5. Click **Share on X** to open a new tab containing X's Web Intent compose view, preloaded with your custom text.
