import datetime
import hashlib
import re
import requests
from flask import Flask, jsonify, render_template, request
import feedparser
from bs4 import BeautifulSoup

app = Flask(__name__)

# Feed URL for BigQuery Release Notes
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

# Simple in-memory cache for parsed notes to avoid API rate limits/slowness
# Cache is valid for 10 minutes (600 seconds)
notes_cache = {
    "data": None,
    "last_fetched": None
}

def clean_html_text(html_content):
    """
    Extracts text content and replaces links with [Text](Url) or simplifies them
    for a cleaner representation when shared.
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Format hyperlinks as "Text (URL)" or just "Text" to keep it short
    for a in soup.find_all('a'):
        href = a.get('href', '')
        # If it's a relative link, prefix it with GCP base URL
        if href.startswith('/'):
            href = 'https://cloud.google.com' + href
        text = a.get_text()
        
        # Replace the link element with formatted text
        if text.strip() and href:
            # If the href matches the text, just keep the text
            if href.strip('/') == text.strip('/'):
                a.replace_with(text)
            else:
                a.replace_with(f"{text} ({href})")
        else:
            a.replace_with(text)
            
    # Get clean text
    text = soup.get_text()
    
    # Clean up whitespace and newlines
    text = re.sub(r'\n+', '\n', text)
    text = re.sub(r' +', ' ', text)
    return text.strip()

def fetch_and_parse_notes(force_refresh=False):
    """
    Fetches the Atom feed and parses it.
    Splits multi-item feed entries into individual release items.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    
    if not force_refresh and notes_cache["data"] and notes_cache["last_fetched"]:
        elapsed = (now - notes_cache["last_fetched"]).total_seconds()
        if elapsed < 600:
            return notes_cache["data"], None, False

    try:
        response = requests.get(FEED_URL, timeout=15, headers={
            'User-Agent': 'BigQuery-Release-Notes-Dashboard/1.0 (Flask Web App)'
        })
        response.raise_for_status()
        
        # Parse XML using feedparser
        feed = feedparser.parse(response.text)
        
        if not feed.entries:
            # Feedparser might fail or return empty if parsing errors occur
            # Let's try parsing directly with BeautifulSoup as a fallback
            soup_feed = BeautifulSoup(response.text, 'xml')
            entries = soup_feed.find_all('entry')
            raw_entries = []
            for entry in entries:
                title = entry.find('title').get_text() if entry.find('title') else 'Unknown Date'
                updated = entry.find('updated').get_text() if entry.find('updated') else ''
                link = entry.find('link').get('href') if entry.find('link') else ''
                content = entry.find('content').get_text() if entry.find('content') else ''
                raw_entries.append({
                    'title': title,
                    'updated': updated,
                    'link': link,
                    'content': content
                })
        else:
            raw_entries = []
            for entry in feed.entries:
                content_val = ""
                if 'content' in entry and len(entry.content) > 0:
                    content_val = entry.content[0].value
                elif 'summary' in entry:
                    content_val = entry.summary
                
                raw_entries.append({
                    'title': entry.get('title', 'Unknown Date'),
                    'updated': entry.get('updated', ''),
                    'link': entry.get('link', ''),
                    'content': content_val
                })

        parsed_items = []
        
        for entry in raw_entries:
            date_str = entry['title']
            link_str = entry['link']
            content_html = entry['content']
            
            if not content_html.strip():
                continue
                
            # Parse HTML content to extract multiple H3 updates
            soup = BeautifulSoup(content_html, 'html.parser')
            
            current_type = None
            current_elements = []
            
            def save_item(type_val, elements):
                if not elements:
                    return
                
                html_snippet = "".join(str(el) for el in elements).strip()
                if not html_snippet:
                    return
                
                # Extract clean text for tweeting
                plain_text = clean_html_text(html_snippet)
                
                # Generate unique ID
                hash_base = f"{date_str}_{type_val}_{html_snippet}"
                item_id = hashlib.md5(hash_base.encode('utf-8')).hexdigest()
                
                # Format type for presentation (standardize casing)
                type_display = type_val.capitalize() if type_val else "Update"
                
                parsed_items.append({
                    "id": item_id,
                    "date": date_str,
                    "type": type_display,
                    "content": html_snippet,
                    "text": plain_text,
                    "link": link_str
                })

            for child in soup.contents:
                if child.name == 'h3':
                    # Save the previous type content
                    if current_elements:
                        save_item(current_type, current_elements)
                    current_type = child.get_text().strip()
                    current_elements = []
                else:
                    current_elements.append(child)
            
            # Save the final one
            if current_elements:
                save_item(current_type, current_elements)
                
        # Cache results
        notes_cache["data"] = parsed_items
        notes_cache["last_fetched"] = now
        return parsed_items, None, True
        
    except Exception as e:
        # Fallback to cache if available
        if notes_cache["data"]:
            return notes_cache["data"], f"Error fetching updates: {str(e)}. Displaying cached data.", False
        return None, f"Failed to fetch release notes: {str(e)}", False

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def release_notes_api():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    items, error, refreshed = fetch_and_parse_notes(force_refresh)
    
    if items is None:
        return jsonify({
            "success": False,
            "error": error,
            "items": []
        }), 500
        
    return jsonify({
        "success": True,
        "items": items,
        "refreshed": refreshed,
        "error": error,
        "last_fetched": notes_cache["last_fetched"].isoformat() if notes_cache["last_fetched"] else None
    })

if __name__ == '__main__':
    # Running locally
    app.run(debug=True, port=5000)
