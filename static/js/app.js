document.addEventListener('DOMContentLoaded', () => {
    // App State
    let releaseNotes = [];
    let currentFilter = 'all';
    let searchQuery = '';
    let selectedNoteId = null;

    // Elements
    const refreshBtn = document.getElementById('refresh-btn');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const retryBtn = document.getElementById('retry-btn');
    const searchInput = document.getElementById('search-input');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const statCards = document.querySelectorAll('.stat-card');
    
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    const emptyState = document.getElementById('empty-state');
    const notesGrid = document.getElementById('notes-grid');
    const lastUpdatedText = document.querySelector('#last-updated-badge .time-text');
    const statusIndicator = document.querySelector('#last-updated-badge .status-indicator');

    // Stats Elements
    const statTotal = document.getElementById('stat-total');
    const statFeatures = document.getElementById('stat-features');
    const statChanges = document.getElementById('stat-changes');
    const statDeprecations = document.getElementById('stat-deprecations');

    // Composer Drawer Elements
    const composerDrawer = document.getElementById('composer-drawer');
    const drawerOverlay = document.getElementById('drawer-overlay');
    const closeDrawerBtn = document.getElementById('close-drawer-btn');
    const previewType = document.getElementById('preview-type');
    const previewDate = document.getElementById('preview-date');
    const previewText = document.getElementById('preview-text');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCount = document.getElementById('char-count');
    const tweetActionBtn = document.getElementById('tweet-action-btn');
    const progressCircle = document.querySelector('.progress-ring__circle');

    // Setup Progress Ring Circumference
    let circumference = 0;
    if (progressCircle) {
        const radius = progressCircle.r.baseVal.value;
        circumference = radius * 2 * Math.PI;
        progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
        progressCircle.style.strokeDashoffset = circumference;
    }

    // Initialize Theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        if (themeToggleBtn) {
            const themeText = themeToggleBtn.querySelector('.theme-text');
            if (themeText) themeText.textContent = 'Dark Mode';
        }
    }

    // Initialize Notes
    fetchNotes(false);

    // Event Listeners
    refreshBtn.addEventListener('click', () => fetchNotes(true));
    exportCsvBtn.addEventListener('click', exportToCSV);
    
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isLight = document.body.classList.toggle('light-theme');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
            const themeText = themeToggleBtn.querySelector('.theme-text');
            if (themeText) {
                themeText.textContent = isLight ? 'Dark Mode' : 'Light Mode';
            }
            showToast(`Swapped to ${isLight ? 'Light' : 'Dark'} theme`);
        });
    }
    
    retryBtn.addEventListener('click', () => fetchNotes(true));
    
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderNotes();
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.type;
            renderNotes();
        });
    });

    statCards.forEach(card => {
        card.addEventListener('click', () => {
            const filterType = card.dataset.filter.toLowerCase();
            const matchingBtn = document.querySelector(`.filter-btn[data-type="${filterType === 'all' ? 'all' : filterType}"]`);
            if (matchingBtn) {
                matchingBtn.click();
            }
        });
    });

    // Drawer close events
    closeDrawerBtn.addEventListener('click', closeComposer);
    drawerOverlay.addEventListener('click', closeComposer);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeComposer();
    });

    // Textarea input character count
    tweetTextarea.addEventListener('input', updateCharCount);

    // Tweet action button click
    tweetActionBtn.addEventListener('click', publishTweet);

    // Fetch release notes from backend
    async function fetchNotes(forceRefresh = false) {
        showState('loading');
        if (forceRefresh) {
            refreshBtn.classList.add('spinning');
            refreshBtn.disabled = true;
        }

        try {
            const url = `/api/release-notes${forceRefresh ? '?refresh=true' : ''}`;
            const response = await fetch(url);
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Server returned an error.');
            }

            releaseNotes = data.items;
            
            // Update last updated timestamp
            if (data.last_fetched) {
                const date = new Date(data.last_fetched);
                lastUpdatedText.textContent = `Sync: ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                statusIndicator.classList.add('active');
            }

            updateStats();
            renderNotes();
            
            if (data.error) {
                // Non-fatal error (e.g. fetch failed but showing cache)
                console.warn(data.error);
                showToast(data.error);
            }
        } catch (error) {
            console.error('Fetch error:', error);
            errorMessage.textContent = error.message || 'Check your internet connection or the server status.';
            showState('error');
            statusIndicator.classList.remove('active');
            lastUpdatedText.textContent = 'Offline';
        } finally {
            if (forceRefresh) {
                refreshBtn.classList.remove('spinning');
                refreshBtn.disabled = false;
            }
        }
    }

    // Render release notes based on search & filters
    function renderNotes() {
        const filtered = releaseNotes.filter(note => {
            const matchesType = currentFilter === 'all' || note.type.toLowerCase() === currentFilter;
            const matchesSearch = !searchQuery || 
                note.type.toLowerCase().includes(searchQuery) ||
                note.date.toLowerCase().includes(searchQuery) ||
                note.text.toLowerCase().includes(searchQuery);
            return matchesType && matchesSearch;
        });

        notesGrid.innerHTML = '';

        if (filtered.length === 0) {
            showState('empty');
            return;
        }

        filtered.forEach(note => {
            const card = createCardElement(note);
            notesGrid.appendChild(card);
        });

        showState('grid');
    }

    // Create a release note card element
    function createCardElement(note) {
        const card = document.createElement('article');
        const typeClass = note.type.toLowerCase();
        card.className = `note-card type-${typeClass}`;
        if (selectedNoteId === note.id) {
            card.classList.add('selected');
        }

        // Get safe class for badge styling
        let badgeClass = 'badge-update';
        if (typeClass === 'feature') badgeClass = 'badge-feature';
        else if (typeClass === 'change') badgeClass = 'badge-change';
        else if (typeClass === 'deprecation') badgeClass = 'badge-deprecation';

        card.innerHTML = `
            <div class="card-header">
                <span class="badge ${badgeClass}">${note.type}</span>
                <span class="card-date">${note.date}</span>
            </div>
            <div class="card-body">
                ${note.content}
            </div>
            <div class="card-actions">
                <a href="${note.link}" target="_blank" rel="noopener noreferrer" class="card-link" onclick="event.stopPropagation();">
                    <span>Source Feed</span>
                    <svg viewBox="0 0 24 24" width="12" height="12">
                        <path fill="currentColor" d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                    </svg>
                </a>
                <div class="card-buttons">
                    <button class="card-copy-btn" aria-label="Copy note to clipboard" title="Copy to Clipboard" onclick="event.stopPropagation();">
                        <svg viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                        </svg>
                    </button>
                    <button class="card-tweet-btn" aria-label="Tweet this note" title="Tweet Release Note" onclick="event.stopPropagation();">
                        <svg viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        // Handle Card Selection (select card and open composer)
        card.addEventListener('click', () => {
            selectNote(note);
        });

        // Handle Copy Button inside Card directly
        const copyBtn = card.querySelector('.card-copy-btn');
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(note.text)
                .then(() => showToast("Copied note to clipboard!"))
                .catch(err => {
                    console.error('Clipboard copy failed:', err);
                    showToast("Copy failed");
                });
        });

        // Handle Tweet Button inside Card directly
        const tweetBtn = card.querySelector('.card-tweet-btn');
        tweetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            selectNote(note);
        });

        return card;
    }

    // Select note and prepare composer drawer
    function selectNote(note) {
        selectedNoteId = note.id;
        
        // Update selected class in DOM
        document.querySelectorAll('.note-card').forEach(c => c.classList.remove('selected'));
        const selectedCard = document.querySelector(`.note-card[class*="type-"][class*="selected"]`) || 
                             Array.from(document.querySelectorAll('.note-card')).find(c => c.innerHTML.includes(note.id));
        
        // Rerender notes to reflect selection or just add class locally
        renderNotes(); // Safe & keeps DOM in sync

        // Open Drawer
        openComposer(note);
    }

    // Open the Tweet Composer
    function openComposer(note) {
        // Set Preview Details
        previewType.textContent = note.type;
        previewType.className = `badge badge-${note.type.toLowerCase()}`;
        previewDate.textContent = note.date;
        previewText.textContent = note.text;

        // Draft Tweet text initial composition
        // Max characters: 280.
        // We need to keep room for link and tags.
        // Let's create a beautiful structured tweet.
        const header = `🚀 BigQuery Release Update (${note.date})\n`;
        const badge = `Category: #${note.type}\n\n`;
        const footer = `\n\nRead more: ${note.link}`;
        
        // Compute remaining length for the description
        const overhead = header.length + badge.length + footer.length;
        const maxDescLen = 280 - overhead - 4; // safety offset

        let descText = note.text;
        if (descText.length > maxDescLen) {
            descText = descText.substring(0, maxDescLen - 3) + '...';
        }

        const draftText = `${header}${badge}"${descText}"${footer}`;
        
        tweetTextarea.value = draftText;
        composerDrawer.classList.add('open');
        document.body.style.overflow = 'hidden'; // Lock main scroll
        
        updateCharCount();
        tweetTextarea.focus();
    }

    // Close the Tweet Composer
    function closeComposer() {
        composerDrawer.classList.remove('open');
        document.body.style.overflow = ''; // Unlock main scroll
    }

    // Update characters remaining and SVG progress ring
    function updateCharCount() {
        const textLen = tweetTextarea.value.length;
        const limit = 280;
        const remaining = limit - textLen;
        
        charCount.textContent = remaining;

        // Progress ring calculations
        if (progressCircle && circumference > 0) {
            const percent = Math.min((textLen / limit) * 100, 100);
            const offset = circumference - (percent / 100 * circumference);
            progressCircle.style.strokeDashoffset = offset;

            // Change progress bar color based on length
            if (remaining < 0) {
                progressCircle.style.stroke = 'var(--color-deprecation)';
                charCount.style.color = 'var(--color-deprecation)';
                tweetActionBtn.disabled = true;
                tweetActionBtn.style.opacity = '0.5';
                tweetActionBtn.style.pointerEvents = 'none';
            } else if (remaining <= 20) {
                progressCircle.style.stroke = '#ffad1f'; // Warning yellow
                charCount.style.color = '#ffad1f';
                tweetActionBtn.disabled = false;
                tweetActionBtn.style.opacity = '1';
                tweetActionBtn.style.pointerEvents = 'auto';
            } else {
                progressCircle.style.stroke = '#1da1f2'; // standard blue
                charCount.style.color = 'var(--text-secondary)';
                tweetActionBtn.disabled = false;
                tweetActionBtn.style.opacity = '1';
                tweetActionBtn.style.pointerEvents = 'auto';
            }
        }
    }

    // Trigger Twitter Intent URL in new tab
    function publishTweet() {
        const text = tweetTextarea.value;
        if (text.length > 280) {
            showToast("Draft exceeds 280 characters.");
            return;
        }

        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
        closeComposer();
        showToast("Opened draft in Twitter!");
    }

    // Update Counts
    function updateStats() {
        const total = releaseNotes.length;
        const features = releaseNotes.filter(n => n.type.toLowerCase() === 'feature').length;
        const changes = releaseNotes.filter(n => n.type.toLowerCase() === 'change').length;
        const deprecations = releaseNotes.filter(n => n.type.toLowerCase() === 'deprecation').length;

        statTotal.textContent = total;
        statFeatures.textContent = features;
        statChanges.textContent = changes;
        statDeprecations.textContent = deprecations;
    }

    // Toggle showing sections
    function showState(state) {
        loadingState.classList.add('hidden');
        errorState.classList.add('hidden');
        emptyState.classList.add('hidden');
        notesGrid.classList.add('hidden');

        if (state === 'loading') {
            loadingState.classList.remove('hidden');
        } else if (state === 'error') {
            errorState.classList.remove('hidden');
        } else if (state === 'empty') {
            emptyState.classList.remove('hidden');
        } else if (state === 'grid') {
            notesGrid.classList.remove('hidden');
        }
    }

    // Export currently filtered items to CSV
    function exportToCSV() {
        if (releaseNotes.length === 0) {
            showToast("No data to export");
            return;
        }

        // Get currently filtered items using the same logic as renderNotes
        const filtered = releaseNotes.filter(note => {
            const matchesType = currentFilter === 'all' || note.type.toLowerCase() === currentFilter;
            const matchesSearch = !searchQuery || 
                note.type.toLowerCase().includes(searchQuery) ||
                note.date.toLowerCase().includes(searchQuery) ||
                note.text.toLowerCase().includes(searchQuery);
            return matchesType && matchesSearch;
        });

        if (filtered.length === 0) {
            showToast("No filtered data to export");
            return;
        }

        const csvRows = [];
        // Header row
        csvRows.push(['Date', 'Type', 'Description', 'Link'].map(val => `"${val.replace(/"/g, '""')}"`).join(','));

        // Content rows
        filtered.forEach(note => {
            const row = [
                note.date,
                note.type,
                note.text,
                note.link
            ];
            csvRows.push(row.map(val => `"${val.replace(/"/g, '""')}"`).join(','));
        });

        // Download Blob
        const blob = new Blob([csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        
        // Formulate filename
        const filterStr = currentFilter !== 'all' ? `_${currentFilter}` : '';
        const searchStr = searchQuery ? `_search` : '';
        const dateStr = new Date().toISOString().slice(0, 10);
        link.setAttribute("download", `bigquery_release_notes_${dateStr}${filterStr}${searchStr}.csv`);
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`Exported ${filtered.length} notes to CSV`);
    }

    // Simple toast helper
    function showToast(message) {
        // Create toast element
        const toast = document.createElement('div');
        toast.style.position = 'fixed';
        toast.style.bottom = '24px';
        toast.style.right = '24px';
        toast.style.background = 'rgba(15, 23, 42, 0.95)';
        toast.style.color = 'var(--text-primary)';
        toast.style.border = '1px solid var(--border-color)';
        toast.style.padding = '12px 24px';
        toast.style.borderRadius = '8px';
        toast.style.zIndex = '9999';
        toast.style.fontFamily = "'Inter', sans-serif";
        toast.style.fontSize = '0.9rem';
        toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
        toast.style.backdropFilter = 'blur(8px)';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';

        toast.textContent = message;
        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        }, 10);

        // Animate out and remove
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 4000);
    }
});
