from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Capture console logs
        page.on("console", lambda msg: print(f"Browser Console: {msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Browser Error: {err.message}"))
        
        try:
            print("Navigating to http://localhost:3000...")
            page.goto('http://localhost:3000')
            page.wait_for_load_state('networkidle', timeout=5000)
        except Exception as e:
            print(f"Navigation error: {e}")
            
        browser.close()

if __name__ == '__main__':
    run()
