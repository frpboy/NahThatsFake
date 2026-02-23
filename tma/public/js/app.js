// Telegram Web App initialization
const tg = window.Telegram.WebApp;
let user = null;
let checks = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 10;

// Initialize the app
function initApp() {
    // Basic initialization
    tg.ready();
    
    // Request full screen if supported (Bot API 8.0+)
    if (tg.requestFullscreen && parseFloat(tg.version) >= 6.1) {
        tg.requestFullscreen();
    } else {
        tg.expand();
    }

    // Set header color
    if (tg.setHeaderColor) {
        tg.setHeaderColor(tg.themeParams.header_bg_color || tg.themeParams.bg_color || '#ffffff');
    }

    // Handle closing confirmation
    if (tg.enableClosingConfirmation) {
        tg.enableClosingConfirmation();
    }

    // Get user data
    // WARNING: initDataUnsafe is insecure for sensitive operations, 
    // but useful for immediate UI rendering before backend verification.
    user = tg.initDataUnsafe.user;

    if (user) {
        // We are inside Telegram
        loadUserData();
        loadChecks();
        checkAdmin();
        
        // Hide login widget if it was somehow visible
        const loginWidget = document.getElementById('login-widget');
        if (loginWidget) loginWidget.classList.add('hidden');
    } else {
        // We are outside Telegram (web browser)
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('login-widget').classList.remove('hidden');
        
        // Check for stored session or handle web login flow
        // For now, just show the widget
        
        // Show "Open in Telegram" button when outside Telegram
        const openTgBtn = document.getElementById('open-in-telegram-btn');
        if (openTgBtn) openTgBtn.classList.remove('hidden');
    }

    // Apply theme initially and listen for changes
    applyTheme();
    tg.onEvent('themeChanged', applyTheme);
    
    // Listen for viewport changes
    tg.onEvent('viewportChanged', () => {
        // Adjust layout if needed
        console.log('Viewport changed:', tg.viewportHeight);
    });
}

// Check if user is admin
async function checkAdmin() {
    try {
        // Send initData for verification instead of just ID
        const headers = {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': tg.initData // Send raw initData
        };

        // Fallback for dev/test without backend validation implemented yet
        // In production, backend MUST validate the hash
        const res = await fetch(`/api/user/role?userId=${user.id}`, { headers });
        
        if (!res.ok) throw new Error('Network response was not ok');
        
        const data = await res.json();
        
        if (data.role === 'owner' || data.role === 'admin') {
            document.getElementById('admin-dashboard').classList.remove('hidden');
            // If owner, show infinity symbol for credits
            if (data.role === 'owner') {
                const creditsEl = document.getElementById('credits-remaining');
                if (creditsEl) creditsEl.textContent = '∞';
            }
            loadAdminStats();
        }
    } catch (e) {
        console.error('Role check failed:', e);
    }
}

// Load admin stats
function loadAdminStats() {
    fetch('/api/admin/stats', {
        headers: { 'X-Telegram-Init-Data': tg.initData }
    })
    .then(r => r.json())
    .then(d => {
        if (d.error) return;
        document.getElementById('admin-users').textContent = d.users || '-';
        document.getElementById('admin-banned').textContent = d.banned || '-';
        document.getElementById('admin-checks').textContent = d.checks || '-';
        document.getElementById('admin-revenue-inr').textContent = '₹' + (d.revenue?.inr || 0);
        document.getElementById('admin-revenue-stars').textContent = d.revenue?.stars || 0;
    })
    .catch(e => console.error('Admin stats error:', e));
}

function adminBroadcast() {
    hapticFeedback('medium');
    tg.showPopup({
        title: 'Broadcast',
        message: 'To send a broadcast, use the /broadcast command in the bot.',
        buttons: [{type: 'ok'}]
    });
}

function adminViewLogs() {
    hapticFeedback('light');
    tg.showAlert('Audit logs viewer coming soon!');
}

// Apply Telegram theme
function applyTheme() {
    const themeParams = tg.themeParams;
    if (themeParams) {
        const root = document.documentElement;
        
        // Set CSS variables from theme params
        const setVar = (name, value) => {
            if (value) root.style.setProperty(name, value);
        };

        setVar('--tg-theme-bg-color', themeParams.bg_color);
        setVar('--tg-theme-text-color', themeParams.text_color);
        setVar('--tg-theme-hint-color', themeParams.hint_color);
        setVar('--tg-theme-link-color', themeParams.link_color);
        setVar('--tg-theme-button-color', themeParams.button_color);
        setVar('--tg-theme-button-text-color', themeParams.button_text_color);
        setVar('--tg-theme-secondary-bg-color', themeParams.secondary_bg_color);
        setVar('--tg-theme-header-bg-color', themeParams.header_bg_color);
        setVar('--tg-theme-section-bg-color', themeParams.section_bg_color);
        
        // Add dark mode class if needed
        if (themeParams.bg_color && isDarkColor(themeParams.bg_color)) {
            document.body.classList.add('dark');
        } else {
            document.body.classList.remove('dark');
        }
        
        // Update header color dynamically
        if (tg.setHeaderColor) {
            tg.setHeaderColor(themeParams.header_bg_color || themeParams.bg_color);
        }
        
        // Update bottom bar color if supported (Bot API 7.10+)
        if (tg.setBottomBarColor) {
            tg.setBottomBarColor(themeParams.bottom_bar_bg_color || themeParams.secondary_bg_color || themeParams.bg_color);
        }
    }
}

// Check if color is dark
function isDarkColor(color) {
    if (!color) return false;
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return brightness < 128;
}

// Load user data from Supabase
async function loadUserData() {
    try {
        const headers = { 'X-Telegram-Init-Data': tg.initData };
        // Fetch actual user data from backend
        const res = await fetch(`/api/user/profile?userId=${user.id}`, { headers });
        
        if (!res.ok) {
             // Mock data if API fails (for development/demo without full backend)
             console.warn('API failed, using mock data');
             updateUI({
                 username: user.username || user.first_name,
                 plan: 'free',
                 created_at: new Date().toISOString(),
                 daily_credits: 3,
                 permanent_credits: 0,
                 total_checks: 0
             });
             return;
        }

        const profile = await res.json();
        updateUI(profile);
        
    } catch (error) {
        console.error('Failed to load user data:', error);
        // Don't show error to user immediately, try to degrade gracefully
        updateUI({
            username: user.username || user.first_name,
            plan: 'unknown',
            created_at: new Date().toISOString(),
            daily_credits: '-',
            total_checks: '-'
        });
    }
}

function updateUI(profile) {
    if (profile) {
        const safeText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        safeText('user-username', profile.username || user.first_name);
        safeText('user-plan', formatPlanName(profile.plan));
        safeText('user-created', new Date(profile.created_at).toLocaleDateString());
        safeText('credits-remaining', profile.daily_credits);
        safeText('bonus-credits', profile.permanent_credits || 0);
        safeText('total-checks', profile.total_checks || 0);
    }
    
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('main-content').classList.remove('hidden');
}

function formatPlanName(plan) {
    const names = {
        'free': 'Free',
        'ind_weekly': 'Weekly Pass',
        'ind_monthly': 'Monthly Premium',
        'ind_annual': 'Annual Premium',
        'ind_lifetime': 'Lifetime',
        'grp_monthly': 'Group Monthly',
        'grp_annual': 'Group Annual'
    };
    return names[plan] || plan;
}

// Load recent checks
async function loadChecks() {
    try {
        const headers = { 'X-Telegram-Init-Data': tg.initData };
        const res = await fetch(`/api/user/checks?userId=${user.id}&page=${currentPage}&limit=${ITEMS_PER_PAGE}`, { headers });
        
        if (!res.ok) throw new Error('Failed to fetch checks');
        
        const data = await res.json();
        const newChecks = data.checks || [];
        
        if (currentPage === 1) {
            checks = newChecks;
        } else {
            checks = [...checks, ...newChecks];
        }
        
        renderChecks();
        
        // Hide "Load More" if no more checks
        if (newChecks.length < ITEMS_PER_PAGE) {
            document.getElementById('load-more-btn').classList.add('hidden');
        } else {
            document.getElementById('load-more-btn').classList.remove('hidden');
        }

    } catch (error) {
        console.error('Failed to load checks:', error);
        if (currentPage === 1) {
            document.getElementById('recent-checks').innerHTML = '<div class="loading">No checks found</div>';
        }
    }
}

// Render checks in the UI
function renderChecks() {
    const container = document.getElementById('recent-checks');
    
    if (checks.length === 0) {
        container.innerHTML = '<div class="loading">No checks yet</div>';
        return;
    }

    const html = checks.map(check => {
        const icon = check.check_type === 'image' ? '🖼️' : '🔗';
        const riskClass = `risk-${(check.risk_level || 'low').toLowerCase()}`;
        const scorePercent = check.score ? Math.round(check.score * 100) : 0;
        const date = new Date(check.created_at).toLocaleDateString();

        return `
            <div class="check-item" onclick="viewCheckDetails('${check.id}')">
                <div class="check-icon ${check.check_type}">${icon}</div>
                <div class="check-details">
                    <div class="check-type">${check.check_type === 'image' ? 'Image Analysis' : 'Link Analysis'}</div>
                    <div class="check-date">${date}</div>
                </div>
                <div class="check-result">
                    <div class="risk-badge ${riskClass}">${check.risk_level || 'UNKNOWN'}</div>
                    <div style="font-size: 12px; color: var(--tg-theme-hint-color); margin-top: 4px;">${scorePercent}% Risk</div>
                </div>
            </div>
        `;
    }).join('');

    if (currentPage === 1) {
        container.innerHTML = html;
    } else {
        container.insertAdjacentHTML('beforeend', html);
    }
}

function viewCheckDetails(checkId) {
    hapticFeedback('light');
    // Future: Show detailed modal or navigate to detail view
    console.log('View details for', checkId);
}

// Load more checks
function loadMoreChecks() {
    hapticFeedback('light');
    currentPage++;
    loadChecks();
}

// Share referral link
function shareReferral() {
    hapticFeedback('medium');
    const referralLink = `https://t.me/NahThatsFakeBot?start=${user.id}`;
    const shareText = `🎁 Get 2 free credits for fake detection! Join Nah That's Fake: ${referralLink}`;
    
    // Use Telegram native sharing if available (Bot API 8.0+)
    if (tg.shareMessage) {
        // Need a prepared message ID for shareMessage, so we might fall back to openTelegramLink or clipboard
        // Simpler: use openTelegramLink with share url
        const url = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`;
        tg.openTelegramLink(url);
    } else if (navigator.share) {
        navigator.share({
            title: 'Nah That\'s Fake - Referral',
            text: shareText
        });
    } else {
        navigator.clipboard.writeText(shareText);
        tg.showAlert('Referral link copied to clipboard!');
    }
}

// Upgrade to premium
function upgradePremium() {
    hapticFeedback('light');
    // Use openInvoice if we have a direct invoice link, or navigate to a premium page
    // For now, open the bot with /premium command
    tg.openTelegramLink(`https://t.me/NahThatsFakeBot?start=premium`);
}

// Open bot
function openBot() {
    hapticFeedback('light');
    tg.openTelegramLink('https://t.me/NahThatsFakeBot');
}

// Helper for haptic feedback
function hapticFeedback(style) {
    if (tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred(style);
    }
}

// Show error message
function showError(message) {
    document.getElementById('loading').classList.add('hidden');
    const errorEl = document.getElementById('error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }
}

// Close app
function closeApp() {
    tg.close();
}

// Initialize when DOM is ready
document.addEvent