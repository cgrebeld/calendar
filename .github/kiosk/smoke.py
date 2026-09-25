"""Exercise Debian's actual Chromium through labwc, without physical display hardware."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.request import urlopen

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait


with subprocess.Popen(["labwc", "-s", "true"]) as compositor:
    try:
        runtime = Path(os.environ["XDG_RUNTIME_DIR"])
        for _ in range(100):
            sockets = [p for p in runtime.glob("wayland-*") if p.is_socket()]
            if sockets:
                break
            if compositor.poll() is not None:
                raise RuntimeError("labwc exited before creating its Wayland socket")
            time.sleep(0.1)
        else:
            raise RuntimeError("labwc did not create a Wayland socket")
        os.environ["WAYLAND_DISPLAY"] = sockets[0].name
        options = webdriver.ChromeOptions()
        options.binary_location = "/usr/bin/chromium"
        # Container-only concession; production Chromium keeps its sandbox enabled.
        for argument in ("--no-sandbox", "--ozone-platform=wayland", "--kiosk", "--no-first-run"):
            options.add_argument(argument)
        options.set_capability("goog:loggingPrefs", {"browser": "ALL"})
        with webdriver.Chrome(service=Service("/usr/bin/chromedriver", log_output=sys.stdout), options=options) as browser:
            browser.set_page_load_timeout(30)
            wait = WebDriverWait(browser, 30)
            browser.execute_cdp_cmd("Emulation.setDeviceMetricsOverride", {
                "width": 1920, "height": 1080, "deviceScaleFactor": 1, "mobile": False,
            })
            # Populate each date so navigation exercises both event rows and overflow.
            browser.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {"source": """
                const originalFetch = window.fetch;
                window.fetch = (input, options) => {
                    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
                    if (url.pathname === '/api/auth/status') return Promise.resolve(new Response(JSON.stringify({ connected: true })));
                    if (url.pathname !== '/api/calendar/events') return originalFetch(input, options);
                    const events = [];
                    const end = new Date(url.searchParams.get('timeMax'));
                    for (const day = new Date(url.searchParams.get('timeMin')); day < end; day.setDate(day.getDate() + 1)) {
                        const date = [day.getFullYear(), String(day.getMonth() + 1).padStart(2, '0'), String(day.getDate()).padStart(2, '0')].join('-');
                        for (let i = 0; i < 8; i++) events.push({
                            event: { id: `${date}-${i}`, summary: `Month regression ${i}`, start: { date }, end: { date } },
                            calendar: { id: 'test', summary: 'Test' }, tone: 0,
                        });
                    }
                    return Promise.resolve(new Response(JSON.stringify(events), { headers: { 'content-type': 'application/json' } }));
                };
            """})
            browser.get("http://calendar-web/")
            wait.until(lambda driver: driver.find_element(By.TAG_NAME, "h1").text)
            for label, layout in (("Month", ".month-grid"), ("2 weeks", ".two-week-grid"), ("Week", ".timeline"), ("Day", ".timeline")):
                browser.find_element(By.XPATH, f'//div[@aria-label="Calendar view"]/button[@aria-label="{label}"]').click()
                wait.until(lambda driver: driver.find_element(By.CSS_SELECTOR, ".mode-picker .active").get_attribute("aria-label") == label)
                wait.until(lambda driver: driver.find_element(By.CSS_SELECTOR, layout).is_displayed())
            browser.find_element(By.XPATH, '//div[@aria-label="Calendar view"]/button[@aria-label="Month"]').click()
            for direction in (None, "Next", "Next", "Previous"):
                if direction:
                    first = browser.find_element(By.CSS_SELECTOR, ".month-day").get_attribute("aria-label")
                    browser.find_element(By.CSS_SELECTOR, f'button[aria-label="{direction}"]').click()
                    wait.until(lambda driver: driver.find_element(By.CSS_SELECTOR, ".month-day").get_attribute("aria-label") != first)
                browser.execute_async_script("const done = arguments[0]; requestAnimationFrame(() => requestAnimationFrame(done));")
                wait.until(lambda driver: len(driver.find_elements(By.CSS_SELECTOR, ".month-day:first-of-type .month-events button:not(.more)")) > 0)
                assert browser.find_elements(By.CSS_SELECTOR, ".month-events .more"), "Expected overflow alongside visible events"
            browser.find_element(By.XPATH, '//div[@aria-label="Calendar view"]/button[@aria-label="Day"]').click()
            date = browser.find_element(By.CSS_SELECTOR, ".day-heading").get_attribute("aria-label")
            browser.find_element(By.CSS_SELECTOR, 'button[aria-label="Next"]').click()
            wait.until(lambda driver: driver.find_element(By.CSS_SELECTOR, ".day-heading").get_attribute("aria-label") != date)
            # Third-party weather/quote failures are allowed; uncaught JS errors are not.
            errors = [entry for entry in browser.get_log("browser") if entry.get("source") == "javascript" and entry["level"] == "SEVERE"]
            assert not errors, errors
            with urlopen("http://calendar-web/api/health", timeout=10) as response:
                assert json.load(response)["version"] == os.environ["VERSION"]
            assert compositor.poll() is None, "labwc exited during the smoke test"
            print("Debian 13 + labwc + Chromium: render, navigation and web/API version passed", flush=True)
    finally:
        compositor.terminate()
        compositor.wait(timeout=10)
