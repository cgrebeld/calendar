from pathlib import Path
import ctypes
import struct
import tempfile

# Native Xcursor file: one transparent 1x1 image at nominal size 24.
cursor = struct.pack('<17I', 0x72756358, 16, 0x10000, 1,
                     0xfffd0002, 24, 28,
                     36, 0xfffd0002, 24, 1, 1, 1, 0, 0, 0, 0)
with tempfile.NamedTemporaryFile() as check:
    check.write(cursor)
    check.flush()
    lib = ctypes.CDLL('libXcursor.so.1')
    lib.XcursorFilenameLoadImage.argtypes = [ctypes.c_char_p, ctypes.c_int]
    lib.XcursorFilenameLoadImage.restype = ctypes.c_void_p
    lib.XcursorImageDestroy.argtypes = [ctypes.c_void_p]
    loaded = lib.XcursorFilenameLoadImage(check.name.encode(), 24)
    assert loaded, 'Invalid cursor file'
    lib.XcursorImageDestroy(loaded)

home = Path.home()
theme = home / '.icons/calendar-hidden'
cursors = theme / 'cursors'
cursors.mkdir(parents=True, exist_ok=True)
(theme / 'index.theme').write_text('[Icon Theme]\nName=Calendar hidden cursor\n')
names = {p.name for p in Path('/usr/share/icons').glob('*/cursors/*')}
names.update('default left_ptr arrow pointer hand2 text xterm wait watch progress crosshair move grab grabbing not-allowed none'.split())
for name in names:
    (cursors / name).write_bytes(cursor)
env = home / '.config/labwc/environment.d'
env.mkdir(parents=True, exist_ok=True)
(env / '99-calendar-cursor.env').write_text('XCURSOR_THEME=calendar-hidden\n')
print(f'Installed invisible cursor theme for {home}; restart the kiosk to apply.')
