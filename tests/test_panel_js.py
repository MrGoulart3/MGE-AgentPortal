"""Exercises real panel rendering and escaping under a minimal DOM adapter."""
from pathlib import Path
import shutil
import subprocess
import unittest


class PanelJavaScriptTest(unittest.TestCase):
    @unittest.skipUnless(shutil.which('node'), 'Node.js optional UI check is unavailable')
    def test_configured_uploads_and_context(self):
        result = subprocess.run(['node', str(Path(__file__).with_name('spaces_js_check.js'))],
                                capture_output=True, text=True, timeout=5)
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn('context rendering: OK', result.stdout)

    @unittest.skipUnless(shutil.which('node'), 'Node.js optional UI check is unavailable')
    def test_language_switching_and_escaping(self):
        result = subprocess.run(['node', str(Path(__file__).with_name('panel_js_check.js'))],
                                capture_output=True, text=True, timeout=5)
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn('escaping: OK', result.stdout)
