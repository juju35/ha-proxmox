"""Every translation file has the English keys, for the config flow and for the panel."""

import json
import re
from pathlib import Path

BASE = Path(__file__).parent.parent / "custom_components" / "proxmox_panel"
LANGS = {
    "en",
    "fr",
    "de",
    "es",
    "sr",
    "sr-Latn",
    "it",
    "nl",
    "pt",
    "pl",
    "ro",
    "da",
    "sv",
    "bg",
    "ru",
    "uk",
    "hu",
    "sk",
    "cs",
    "sl",
    "lv",
    "el",
}


def _paths(d, prefix=""):
    for k, v in d.items():
        yield from _paths(v, f"{prefix}{k}.") if isinstance(v, dict) else [f"{prefix}{k}"]


def test_config_flow_strings_in_every_language():
    files = {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in (BASE / "translations").glob("*.json")}
    assert set(files) == LANGS
    ref = sorted(_paths(files["en"]))
    for lang, data in files.items():
        assert sorted(_paths(data)) == ref, lang


def test_panel_languages_have_every_key_and_placeholder():
    source = (BASE / "frontend" / "proxmox-panel.js").read_text(encoding="utf-8")
    block = re.search(r"const PROXMOX_PANEL_EN = \{(.*?)\n\};", source, re.DOTALL).group(1)
    english = dict(re.findall(r'^\s+(\w+): "((?:[^"\\]|\\.)*)",$', block, re.MULTILINE))
    files = {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in (BASE / "frontend" / "i18n").glob("*.json")}
    assert set(files) == LANGS - {"en"}
    for lang, data in files.items():
        assert set(data) == set(english), lang
        for key, text in data.items():
            assert text.strip(), f"{lang}.{key}"
            assert sorted(re.findall(r"\{\w+\}", text)) == sorted(re.findall(r"\{\w+\}", english[key])), f"{lang}.{key}"
