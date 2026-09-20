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
            browser.get("http://calendar-web/")
            wait.until(lambda driver: driver.find_element(By.TAG_NAME, "h1").text)
            for label, layout in (("Month", ".month-grid"), ("2 weeks", ".two-week-grid"), ("Week", ".timeline"), ("Day", ".timeline")):
                browser.find_element(By.XPATH, f'//div[@aria-label="Calendar view"]/button[text()="{label}"]').click()
                wait.until(lambda driver: driver.find_element(By.CSS_SELECTOR, ".mode-picker .active").text == label)
                wait.until(lambda driver: driver.find_element(By.CSS_SELECTOR, layout).is_displayed())
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
