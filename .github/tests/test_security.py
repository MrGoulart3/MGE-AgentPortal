"""Regressões para o bloqueio de segredos e a privacidade dos logs."""

import importlib.util
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location(
    "scanner", Path(__file__).resolve().parents[1] / "scripts/scan_sensitive.py"
)
SCANNER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SCANNER)


class SecurityTest(unittest.TestCase):
    def test_service_token_is_detected_without_leaking_value(self) -> None:
        token = "gh" + "p_" + "Ab9z" * 10
        found = SCANNER.findings("sample.txt", token)
        self.assertEqual("service-token", found[0]["rule"])
        self.assertNotIn(token, str(found))

    def test_email_and_home_are_detected(self) -> None:
        self.assertEqual(
            {"email", "home-path"},
            {item["rule"] for item in SCANNER.findings(
                "sample.txt", "contact" + "@private-domain.dev /home/" + "researcher"
            )},
        )

    def test_documentation_placeholders_are_accepted(self) -> None:
        self.assertEqual([], SCANNER.findings(
            "sample.txt", "user@example.org /home/user 000.000.000-00"
        ))

    def test_private_key_header_is_detected(self) -> None:
        value = "-----BEGIN " + "OPENSSH PRIVATE KEY-----"
        self.assertEqual("private-key", SCANNER.findings("sample", value)[0]["rule"])

    def test_credential_in_json_is_detected(self) -> None:
        value = '{"api_key": "' + "nonpublic-" + "AbCd9876" + '"}'
        self.assertEqual(
            "credential-literal", SCANNER.findings("config.json", value)[0]["rule"]
        )

    def test_credential_in_shell_assignment_is_detected(self) -> None:
        value = 'password="' + "nonpublic-" + "AbCd9876" + '"'
        self.assertEqual(
            "credential-literal", SCANNER.findings("config.env", value)[0]["rule"]
        )

    def test_fingerprint_is_scoped_to_the_file(self) -> None:
        value = "AK" + "IA" + "A1" * 8
        first = SCANNER.findings("one", value)[0]
        second = SCANNER.findings("two", value)[0]
        self.assertNotEqual(first["sha256"], second["sha256"])


if __name__ == "__main__":
    unittest.main()
