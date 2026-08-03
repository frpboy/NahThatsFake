from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()

    # We need to inject the mock before the page script runs
    # In Playwright, add_init_script runs before the page's scripts.
    # The problem might be the telegram script redefining window.Telegram, so let's mock it after
    page.add_init_script('''
        Object.defineProperty(window, 'Telegram', {
            get: function() {
                return { WebApp: { expand: () => {}, initDataUnsafe: { user: { id: 123, first_name: "Test" } }, initData: "mock" } };
            },
            set: function(val) {}
        });
    ''')

    page.goto('file:///app/tma/public/premium.html')

    btn = page.locator('button.btn').first
    original_text = btn.inner_text()
    print(f"Original text: {original_text}")

    # Stub out fetch so it hangs, allowing us to see the loading state
    page.evaluate('window.fetch = () => new Promise(r => setTimeout(r, 10000));')

    # Listen to alert to make sure we aren't getting blocked
    page.on("dialog", lambda dialog: print(f"Alert: {dialog.message}") or dialog.accept())

    btn.click()
    page.wait_for_timeout(100) # Give it a tiny bit of time to update DOM
    loading_text = btn.inner_text()
    print(f"Loading text: {loading_text}")

    assert "Processing..." in loading_text
    browser.close()
