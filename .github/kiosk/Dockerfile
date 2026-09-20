# CI only: none of these browser-test tools are installed on the wall box.
FROM debian:13-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    labwc chromium chromium-driver python3-selenium fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home kiosk \
    && install -d -o kiosk -g kiosk -m 0700 /tmp/kiosk-runtime
COPY smoke.py /opt/kiosk-smoke.py
USER kiosk
ENV XDG_RUNTIME_DIR=/tmp/kiosk-runtime WLR_BACKENDS=headless WLR_RENDERER=pixman WLR_HEADLESS_OUTPUTS=1
CMD ["python3", "/opt/kiosk-smoke.py"]
