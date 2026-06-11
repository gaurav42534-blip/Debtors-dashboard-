from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        try:
            print("Navigating to http://localhost:3000/login...")
            page.goto('http://localhost:3000/login')
            page.wait_for_load_state('networkidle', timeout=5000)
            page.screenshot(path="screenshot.png")
            print("Screenshot saved to screenshot.png")
        except Exception as e:
            print(f"Navigation error: {e}")
            
        browser.close()

if __name__ == '__main__':
    run()
