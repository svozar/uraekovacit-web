#!/usr/bin/env python3
"""Zero-dependency unit and integrity test suite for uraekovacit.com.

Runs with Python 3 standard library + either Node.js (`node`) on Linux/CI
or Apple WebKit JavaScriptCore (`jsc`) on macOS.
"""

from __future__ import annotations

from html.parser import HTMLParser
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET

REPO_ROOT = Path(__file__).resolve().parent.parent
INDEX_HTML = REPO_ROOT / "index.html"
STYLES_CSS = REPO_ROOT / "css" / "styles.css"
MAIN_JS = REPO_ROOT / "js" / "main.js"
TRANSLATIONS_JS = REPO_ROOT / "js" / "translations.js"

VOID_HTML_TAGS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
}

EXPECTED_EEA_UK_CH_REGIONS = {
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE",
    "GR", "HU", "IS", "IE", "IT", "LV", "LI", "LT", "LU", "MT", "NL",
    "NO", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "GB", "CH",
}


def find_js_engine() -> str:
    node = shutil.which("node")
    if node:
        return node
    mac_jsc = Path(
        "/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc"
    )
    if mac_jsc.exists():
        return str(mac_jsc)
    raise RuntimeError("No JS engine found (expected `node` or macOS `jsc`).")


def run_js_with_site_modules(test_js_body: str) -> str:
    """Execute JS assertions against translations.js and main.js in a clean sandbox."""
    engine = find_js_engine()
    translations_src = TRANSLATIONS_JS.read_text(encoding="utf-8").replace(
        "export const translations =", "const translations ="
    )
    main_src = (
        MAIN_JS.read_text(encoding="utf-8")
        .replace("import { translations } from './translations.js';", "")
        .replace("export function detectPreferredLanguage", "function detectPreferredLanguage")
        .replace(
            "export function shouldShowConsentBannerByRegion",
            "function shouldShowConsentBannerByRegion",
        )
    )

    preamble = """
const __storage = new Map();
const __gtagCalls = [];
const __domById = new Map();
const __translatables = [];
const __langOptions = [];
const __whatsappLinks = [];

if (typeof URLSearchParams === "undefined") {
    globalThis.URLSearchParams = class URLSearchParams {
        constructor(init = "") {
            this._map = new Map();
            const clean = String(init || "").replace(/^\\?/, "");
            if (clean) {
                for (const part of clean.split("&")) {
                    if (!part) continue;
                    const idx = part.indexOf("=");
                    const k = idx >= 0 ? decodeURIComponent(part.slice(0, idx)) : decodeURIComponent(part);
                    const v = idx >= 0 ? decodeURIComponent(part.slice(idx + 1)) : "";
                    this._map.set(k, v);
                }
            }
        }
        get(k) { return this._map.has(k) ? this._map.get(k) : null; }
        set(k, v) { this._map.set(String(k), String(v)); }
        toString() {
            const out = [];
            this._map.forEach((v, k) => out.push(encodeURIComponent(k) + "=" + encodeURIComponent(v)));
            return out.join("&");
        }
    };
}

const localStorage = {
    getItem(k) { return __storage.has(k) ? __storage.get(k) : null; },
    setItem(k, v) { __storage.set(k, String(v)); },
    removeItem(k) { __storage.delete(k); },
    clear() { __storage.clear(); }
};

const window = {
    location: { search: "", hash: "", pathname: "/" },
    history: {
        lastUrl: "/",
        replaceState(_state, _title, url) { this.lastUrl = url; }
    },
    gtag(...args) { __gtagCalls.push(args); },
    setTimeout() { return 1; },
    clearTimeout() {}
};

const document = {
    readyState: "loading",
    documentElement: { lang: "en" },
    body: { style: {} },
    addEventListener() {},
    createElement(tag) {
        return {
            tagName: tag.toUpperCase(),
            id: "",
            src: "",
            async: false,
            dataset: {},
            childNodes: [],
            appendChild(child) { this.childNodes.push(child); return child; }
        };
    },
    getElementById(id) { return __domById.get(id) || null; },
    querySelector() { return null; },
    querySelectorAll(sel) {
        if (sel === "[data-translate]") return __translatables;
        if (sel === ".lang-option") return __langOptions;
        if (sel === "a[data-whatsapp-intent]") return __whatsappLinks;
        return [];
    }
};

function assertEq(actual, expected, msg) {
    if (actual !== expected) {
        throw new Error((msg || "Assertion failed") + ": expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual));
    }
}

function assertDeepEq(actual, expected, msg) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) {
        throw new Error((msg || "Deep assertion failed") + ": expected " + b + ", got " + a);
    }
}
"""
    script = f"{preamble}\n{translations_src}\n{main_src}\n(function() {{\n{test_js_body}\n}})();\n"

    with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8", delete=False) as tmp:
        tmp.write(script)
        tmp_path = Path(tmp.name)

    try:
        proc = subprocess.run(
            [engine, str(tmp_path)],
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
        if proc.returncode != 0:
            combined = (proc.stdout + "\n" + proc.stderr).strip()
            raise AssertionError(f"JS test failed (exit {proc.returncode}):\n{combined}")
        return proc.stdout.strip()
    finally:
        tmp_path.unlink(missing_ok=True)


class DOMInspector(HTMLParser):
    """Strict HTML tag balancer and attribute/script collector."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.stack: list[tuple[str, int, dict[str, str | None]]] = []
        self.errors: list[str] = []
        self.ids: set[str] = set()
        self.elements: list[dict] = []
        self.translate_stack_depths: list[tuple[str, int]] = []
        self.translate_with_child_tags: list[tuple[str, str]] = []
        self.json_ld_blocks: list[str] = []
        self.inline_head_scripts: list[str] = []
        self._in_head = False
        self._current_script_attrs: dict[str, str | None] | None = None
        self._script_buf: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        line, _ = self.getpos()
        attr_map = dict(attrs)

        if self.translate_stack_depths:
            parent_key, _ = self.translate_stack_depths[-1]
            self.translate_with_child_tags.append((parent_key, tag))

        if not self.stack and tag != "html":
            self.errors.append(f"Line {line}: <{tag}> found outside <html>")
        elif len(self.stack) == 1 and self.stack[0][0] == "html" and tag not in {"head", "body"}:
            self.errors.append(
                f"Line {line}: <{tag}> placed directly inside <html> outside <head>/<body>"
            )

        el_id = attr_map.get("id")
        if el_id:
            if el_id in self.ids:
                self.errors.append(f"Line {line}: duplicate id='{el_id}'")
            self.ids.add(el_id)

        self.elements.append({"tag": tag, "line": line, "attrs": attr_map})

        if tag == "head":
            self._in_head = True
        if tag == "script":
            self._current_script_attrs = attr_map
            self._script_buf = []

        if tag not in VOID_HTML_TAGS:
            self.stack.append((tag, line, attr_map))
            if "data-translate" in attr_map and attr_map["data-translate"]:
                self.translate_stack_depths.append((attr_map["data-translate"], len(self.stack)))

    def handle_data(self, data: str) -> None:
        if self._current_script_attrs is not None:
            self._script_buf.append(data)

    def handle_endtag(self, tag: str) -> None:
        line, _ = self.getpos()
        if tag in VOID_HTML_TAGS:
            return

        if tag == "script" and self._current_script_attrs is not None:
            raw_script = "".join(self._script_buf)
            if self._current_script_attrs.get("type") == "application/ld+json":
                self.json_ld_blocks.append(raw_script)
            elif self._in_head and not self._current_script_attrs.get("src"):
                self.inline_head_scripts.append(raw_script)
            self._current_script_attrs = None
            self._script_buf = []

        if tag == "head":
            self._in_head = False

        if not self.stack:
            self.errors.append(f"Line {line}: unexpected closing </{tag}> with empty stack")
            return

        open_tag, open_line, _ = self.stack[-1]
        if open_tag != tag:
            self.errors.append(
                f"Line {line}: closing </{tag}> mismatches <{open_tag}> opened on line {open_line}"
            )
            return

        if self.translate_stack_depths and self.translate_stack_depths[-1][1] == len(self.stack):
            self.translate_stack_depths.pop()

        self.stack.pop()


def parse_index_html() -> DOMInspector:
    inspector = DOMInspector()
    inspector.feed(INDEX_HTML.read_text(encoding="utf-8"))
    for tag, line, _ in inspector.stack:
        inspector.errors.append(f"Line {line}: unclosed <{tag}> at end of file")
    return inspector


class TestProductionGuardrails(unittest.TestCase):
    def test_cname_domain_locked(self) -> None:
        cname_path = REPO_ROOT / "CNAME"
        self.assertTrue(cname_path.exists(), "CNAME file is missing!")
        self.assertEqual(
            cname_path.read_text(encoding="utf-8").strip(),
            "uraekovacit.com",
            "CNAME must remain strictly uraekovacit.com",
        )

    def test_robots_and_sitemap_valid(self) -> None:
        robots = (REPO_ROOT / "robots.txt").read_text(encoding="utf-8")
        self.assertIn("Sitemap: https://uraekovacit.com/sitemap.xml", robots)

        tree = ET.parse(REPO_ROOT / "sitemap.xml")
        locs = [el.text for el in tree.getroot().iter() if el.tag.endswith("loc")]
        self.assertIn("https://uraekovacit.com/", locs)

    def test_directory_listing_guards_exist(self) -> None:
        self.assertTrue((REPO_ROOT / "img" / "index.html").exists())
        self.assertTrue((REPO_ROOT / "docs" / "index.html").exists())

    def test_canonical_url_present_in_head(self) -> None:
        dom = parse_index_html()
        canonicals = [
            el["attrs"].get("href")
            for el in dom.elements
            if el["tag"] == "link" and el["attrs"].get("rel") == "canonical"
        ]
        self.assertEqual(
            canonicals,
            ["https://uraekovacit.com/"],
            "index.html <head> must declare exactly one canonical URL https://uraekovacit.com/",
        )

    def test_custom_404_page_seo_and_root_relative_paths(self) -> None:
        not_found_path = REPO_ROOT / "404.html"
        self.assertTrue(not_found_path.is_file(), "404.html missing")
        raw_404 = not_found_path.read_text(encoding="utf-8")

        inspector = DOMInspector()
        inspector.feed(raw_404)
        for tag, line, _ in inspector.stack:
            inspector.errors.append(f"404.html line {line}: unclosed <{tag}>")
        self.assertEqual(inspector.errors, [], "\n".join(inspector.errors))

        # Must carry noindex and NEVER auto-redirect (which triggers Search Console Soft 404s)
        robots_metas = [
            el["attrs"].get("content", "")
            for el in inspector.elements
            if el["tag"] == "meta" and (el["attrs"].get("name") or "").lower() == "robots"
        ]
        self.assertTrue(
            any("noindex" in r.lower() for r in robots_metas),
            "404.html must include <meta name='robots' content='noindex'>",
        )
        self.assertNotIn("http-equiv=\"refresh\"", raw_404.lower())
        self.assertNotRegex(raw_404, r"location\.(?:replace|assign|href)\s*=")

        # Local assets in 404.html must use root-relative /... paths so nested 404 URLs work
        for el in inspector.elements:
            for attr_name in ("src", "href"):
                val = el["attrs"].get(attr_name)
                if not val or val.startswith(("http://", "https://", "mailto:", "tel:")):
                    continue
                self.assertTrue(
                    val.startswith("/"),
                    f"404.html {attr_name}='{val}' must be root-relative ('/...') for nested 404 paths",
                )
                clean_rel = val.lstrip("/").split("#")[0].split("?")[0]
                if clean_rel:
                    self.assertTrue(
                        (REPO_ROOT / clean_rel).is_file(),
                        f"404.html references missing local file: {val}",
                    )


class TestHtmlAndAssets(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.dom = parse_index_html()
        cls.raw_html = INDEX_HTML.read_text(encoding="utf-8")

    def test_html_balanced_and_no_dead_icon_fonts(self) -> None:
        self.assertEqual(self.dom.errors, [], "\n".join(self.dom.errors))
        self.assertNotRegex(
            self.raw_html,
            r'\bclass="[^"]*\bfa[sbr]\s+fa-',
            "Found legacy Font Awesome classes without stylesheet; use inline SVGs",
        )

    def test_all_local_assets_and_anchors_resolve(self) -> None:
        missing_files: list[str] = []
        broken_anchors: list[str] = []

        for el in self.dom.elements:
            attrs = el["attrs"]
            line = el["line"]

            for attr_name in ("src", "href"):
                val = attrs.get(attr_name)
                if not val:
                    continue
                if val.startswith("#"):
                    if len(val) > 1 and val[1:] not in self.dom.ids:
                        broken_anchors.append(f"Line {line}: href='{val}' has no matching id")
                    continue
                if val.startswith(("http://", "https://", "mailto:", "tel:", "javascript:")):
                    continue
                clean_rel = val.split("?")[0].split("#")[0]
                target = REPO_ROOT / clean_rel
                if not target.is_file() or target.stat().st_size == 0:
                    missing_files.append(f"Line {line}: {attr_name}='{val}' missing or empty")

            gallery = attrs.get("data-gallery")
            if gallery:
                for item in [p.strip() for p in gallery.split(",") if p.strip()]:
                    target = REPO_ROOT / item
                    if not target.is_file() or target.stat().st_size == 0:
                        missing_files.append(
                            f"Line {line}: data-gallery item '{item}' missing or empty"
                        )

        self.assertEqual(missing_files, [], "\n".join(missing_files))
        self.assertEqual(broken_anchors, [], "\n".join(broken_anchors))

    def test_hero_lcp_and_lazy_gallery_thumbnails(self) -> None:
        imgs = [el for el in self.dom.elements if el["tag"] == "img"]
        hero_imgs = [el for el in imgs if el["attrs"].get("src") == "img/hero-aerial.jpg"]
        self.assertTrue(hero_imgs, "Hero image img/hero-aerial.jpg not found")
        self.assertEqual(hero_imgs[0]["attrs"].get("fetchpriority"), "high")

        room_thumbs = [
            el for el in imgs if "room-thumb" in (el["attrs"].get("class") or "").split()
        ]
        self.assertGreaterEqual(len(room_thumbs), 7)
        for thumb in room_thumbs:
            self.assertEqual(
                thumb["attrs"].get("loading"),
                "lazy",
                f"Line {thumb['line']}: .room-thumb missing loading='lazy'",
            )


class TestStructuredDataJsonLd(unittest.TestCase):
    def test_json_ld_valid_and_complete(self) -> None:
        dom = parse_index_html()
        self.assertGreaterEqual(len(dom.json_ld_blocks), 1, "Missing JSON-LD block in index.html")

        for idx, raw in enumerate(dom.json_ld_blocks):
            data = json.loads(raw)
            graph = data.get("@graph", [data])
            types = {node.get("@type") for node in graph if isinstance(node, dict)}
            self.assertTrue(
                {"Hotel", "Restaurant", "DaySpa", "FAQPage"}.issubset(types),
                f"JSON-LD block {idx} missing expected @graph entities; found {types}",
            )

            # Every local uraekovacit.com/img or /docs asset URL in JSON-LD must exist on disk
            for match in re.findall(r"https://uraekovacit\.com/((?:img|docs)/[^\"'\s]+)", raw):
                asset = REPO_ROOT / match
                self.assertTrue(
                    asset.is_file(), f"JSON-LD asset URL points to missing file: {match}"
                )

            hotel = next(n for n in graph if n.get("@type") == "Hotel")
            self.assertEqual(hotel["address"]["postalCode"], "7029")
            self.assertEqual(hotel["telephone"], "+355689098589")


class TestLocalizationIntegrity(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.dom = parse_index_html()
        cls.translate_keys = sorted(
            {
                el["attrs"]["data-translate"]
                for el in cls.dom.elements
                if el["attrs"].get("data-translate")
            }
        )
        cls.dropdown_langs = [
            el["attrs"]["data-lang"]
            for el in cls.dom.elements
            if "lang-option" in (el["attrs"].get("class") or "").split()
            and el["attrs"].get("data-lang")
        ]
        cls.whatsapp_intents = sorted(
            {
                el["attrs"]["data-whatsapp-intent"]
                for el in cls.dom.elements
                if el["attrs"].get("data-whatsapp-intent")
            }
        )

    def test_no_data_translate_clobbers_nested_tags(self) -> None:
        self.assertEqual(
            self.dom.translate_with_child_tags,
            [],
            f"[data-translate] elements must not wrap child HTML tags (innerHTML swap clobbers icons/links): {self.dom.translate_with_child_tags}",
        )

    def test_all_html_keys_translated_and_dropdown_synced(self) -> None:
        keys_json = json.dumps(self.translate_keys)
        dropdown_json = json.dumps(self.dropdown_langs)
        intents_json = json.dumps(self.whatsapp_intents)

        run_js_with_site_modules(
            f"""
            const htmlKeys = {keys_json};
            const dropdownLangs = {dropdown_json};
            const whatsappIntents = {intents_json};

            assertDeepEq(dropdownLangs, supportedLangs, "Header language dropdown mismatch with supportedLangs");

            const missing = [];
            for (const lang of Object.keys(translations)) {{
                const dict = translations[lang];
                for (const key of htmlKeys) {{
                    const val = dict[key];
                    if (typeof val !== "string" || !val.trim()) {{
                        missing.push(lang + "." + key);
                    }}
                }}
            }}
            if (missing.length > 0) {{
                throw new Error("Missing or empty translations: " + missing.join(", "));
            }}

            for (const lang of supportedLangs) {{
                const msgDict = WHATSAPP_MESSAGES[lang];
                if (!msgDict) {{
                    throw new Error("WHATSAPP_MESSAGES missing language: " + lang);
                }}
                for (const intent of whatsappIntents) {{
                    if (typeof msgDict[intent] !== "string" || !msgDict[intent].trim()) {{
                        throw new Error("WHATSAPP_MESSAGES missing " + lang + "." + intent);
                    }}
                }}
            }}
            """
        )


class TestAnalyticsConsentAndCssGuards(unittest.TestCase):
    def test_consent_mode_v2_tag_order_and_regions(self) -> None:
        html = INDEX_HTML.read_text(encoding="utf-8")
        consent_pos = html.find("gtag('consent', 'default'")
        gtag_loader_pos = html.find("googletagmanager.com/gtag/js?id=G-2TWLF5K1JD")
        gtag_config_pos = html.find("gtag('config', 'G-2TWLF5K1JD')")

        self.assertGreater(consent_pos, 0, "Consent default script missing")
        self.assertLess(
            consent_pos,
            gtag_loader_pos,
            "Consent Mode default MUST execute before gtag.js loads",
        )
        self.assertLess(gtag_loader_pos, gtag_config_pos)

        region_match = re.search(r"'region'\s*:\s*\[([^\]]+)\]", html)
        self.assertIsNotNone(region_match, "Regional Consent Mode ISO array missing")
        codes = set(re.findall(r"'([A-Z]{2})'", region_match.group(1)))
        self.assertEqual(codes, EXPECTED_EEA_UK_CH_REGIONS)
        self.assertNotIn("AL", codes, "Albania (AL) must track by default")
        self.assertNotIn("US", codes, "United States (US) must track by default")

        # Ad signals must never be granted
        self.assertNotRegex(html, r"'ad_(?:storage|user_data|personalization)'\s*:\s*'granted'")
        main_js = MAIN_JS.read_text(encoding="utf-8")
        self.assertNotRegex(main_js, r"ad_(?:storage|user_data|personalization)\s*:\s*'granted'")

    def test_css_specificity_guards(self) -> None:
        css = STYLES_CSS.read_text(encoding="utf-8")
        self.assertRegex(
            css,
            r"@media\s*\(\s*min-width:\s*(?:768|1024)px\s*\)\s*\{\s*\.mobile-action-bar\s*\{\s*display:\s*none",
            "Missing desktop media query hiding .mobile-action-bar against Tailwind CDN specificity",
        )
        self.assertIn(
            "#hb-search-widget .hb-sw-btn",
            css,
            "Missing HotelBee button override protecting against Tailwind Preflight transparent reset",
        )


class TestJavaScriptUnitBehavior(unittest.TestCase):
    def test_detect_preferred_language_matrix(self) -> None:
        run_js_with_site_modules(
            """
            const cases = [
                // 1. Explicit URL parameter wins over everything
                [{ urlLang: "de", savedLang: "sq", browserLocales: ["en-AL"], timeZone: "Europe/Tirane" }, "de"],
                [{ urlLang: "it", savedLang: "en", browserLocales: ["en-US"], timeZone: "America/New_York" }, "it"],
                // 2. Saved manual preference wins over browser/timezone
                [{ urlLang: null, savedLang: "en", browserLocales: ["en-AL"], timeZone: "Europe/Tirane" }, "en"],
                [{ urlLang: null, savedLang: "fr", browserLocales: ["en-US"], timeZone: "America/New_York" }, "fr"],
                // 3. Invalid URL / saved values fall through safely
                [{ urlLang: "xx", savedLang: "yy", browserLocales: ["el-GR"], timeZone: "Europe/Athens" }, "el"],
                // 4. Albanian iPhones (en-AL, en-XK, Europe/Tirane en-US, bilingual ["en-US", "sq-AL"])
                [{ urlLang: null, savedLang: null, browserLocales: ["en-AL", "en-US"], timeZone: "America/New_York" }, "sq"],
                [{ urlLang: null, savedLang: null, browserLocales: ["en-XK"], timeZone: "Europe/Belgrade" }, "sq"],
                [{ urlLang: null, savedLang: null, browserLocales: ["en-US"], timeZone: "Europe/Tirane" }, "sq"],
                [{ urlLang: null, savedLang: null, browserLocales: ["en-US", "sq-AL"], timeZone: "America/Detroit" }, "sq"],
                // 5. Supported European visitors inside Albania keep their own language
                [{ urlLang: null, savedLang: null, browserLocales: ["it-IT", "en-US"], timeZone: "Europe/Tirane" }, "it"],
                [{ urlLang: null, savedLang: null, browserLocales: ["it-IT"], timeZone: "Europe/Tirane" }, "it"],
                [{ urlLang: null, savedLang: null, browserLocales: ["de-DE", "en-US"], timeZone: "Europe/Tirane" }, "de"],
                [{ urlLang: null, savedLang: null, browserLocales: ["de-AL", "en-AL"], timeZone: "Europe/Tirane" }, "de"],
                [{ urlLang: null, savedLang: null, browserLocales: ["el-GR"], timeZone: "Europe/Tirane" }, "el"],
                [{ urlLang: null, savedLang: null, browserLocales: ["fr-FR"], timeZone: "Europe/Tirane" }, "fr"],
                // 6. Unsupported primary locale inside Albania falls back to English, NOT Albanian
                [{ urlLang: null, savedLang: null, browserLocales: ["nl-NL"], timeZone: "Europe/Tirane" }, "en"],
                [{ urlLang: null, savedLang: null, browserLocales: ["ro-RO", "en-US"], timeZone: "Europe/Tirane" }, "en"],
                // 7. Secondary language behavior outside Albania
                [{ urlLang: null, savedLang: null, browserLocales: ["en-US", "fr-FR"], timeZone: "America/New_York" }, "en"],
                [{ urlLang: null, savedLang: null, browserLocales: ["nl-NL", "de-DE", "en-US"], timeZone: "Europe/Amsterdam" }, "de"],
                [{ urlLang: null, savedLang: null, browserLocales: ["en-US"], timeZone: "America/New_York" }, "en"],
            ];

            cases.forEach(([input, expected], idx) => {
                assertEq(detectPreferredLanguage(input), expected, "Case #" + (idx + 1) + " " + JSON.stringify(input));
            });
            """
        )

    def test_consent_banner_region_matrix(self) -> None:
        run_js_with_site_modules(
            """
            // Must NOT auto-prompt (US, Albania, non-EEA Balkans/Eastern Europe, RoW)
            const noBannerZones = [
                "Europe/Tirane",
                "Europe/Belgrade",
                "Europe/Skopje",
                "Europe/Podgorica",
                "Europe/Istanbul",
                "America/New_York",
                "America/Chicago",
                "Asia/Tokyo",
                ""
            ];
            noBannerZones.forEach(tz => {
                assertEq(shouldShowConsentBannerByRegion(tz), false, "Expected false for timezone " + tz);
            });

            // MUST auto-prompt (EEA, UK, Switzerland, island territories)
            const showBannerZones = [
                "Europe/Rome",
                "Europe/Athens",
                "Europe/Berlin",
                "Europe/Paris",
                "Europe/London",
                "Europe/Zurich",
                "Europe/Vienna",
                "Europe/Amsterdam",
                "Atlantic/Reykjavik",
                "Atlantic/Canary",
                "Asia/Nicosia"
            ];
            showBannerZones.forEach(tz => {
                assertEq(shouldShowConsentBannerByRegion(tz), true, "Expected true for timezone " + tz);
            });
            """
        )

    def test_set_language_telemetry_whatsapp_and_hotelbee_sync(self) -> None:
        run_js_with_site_modules(
            """
            // Set up mock DOM nodes
            const titleEl = {
                innerHTML: "Welcome",
                getAttribute(k) { return k === "data-translate" ? "hero_title" : null; }
            };
            __translatables.push(titleEl);
            captureEnglishText();

            const labelEl = { textContent: "EN" };
            __domById.set("currentLanguageLabel", labelEl);

            const hbHost = {
                innerHTML: "",
                children: [],
                querySelector() { return null; },
                appendChild(el) { this.children.push(el); return el; }
            };
            __domById.set("hb-search-widget-host", hbHost);

            const waLink = {
                href: "",
                getAttribute(k) { return k === "data-whatsapp-intent" ? "restaurant" : null; }
            };
            __whatsappLinks.push(waLink);

            // 1. Auto-selected initial load (isManual: false) must NOT emit language_select or set preferredLanguage
            setLanguage("sq", { updateUrl: false, recordUsage: true, isManual: false });
            assertEq(document.documentElement.lang, "sq", "html lang updated to sq");
            assertEq(labelEl.textContent, "SQ", "Header label updated to SQ");
            assertEq(titleEl.innerHTML, translations.sq.hero_title, "Albanian hero_title applied");
            assertEq(localStorage.getItem("preferredLanguage"), null, "Auto-select must not persist manual preferredLanguage");
            assertEq(
                __gtagCalls.some(c => c[0] === "event" && c[1] === "language_select"),
                false,
                "Initial page load must not fire language_select event"
            );
            assertEq(
                __gtagCalls.some(c => c[0] === "set" && c[1] === "user_properties" && c[2].preferred_language === "sq"),
                true,
                "preferred_language user property must be set"
            );

            // 2. Manual selection (isManual: true) persists preferredLanguage, fires language_select, and syncs widgets
            __gtagCalls.length = 0;
            hbHost.children = [];
            setLanguage("it", { updateUrl: true, recordUsage: true, isManual: true });
            assertEq(localStorage.getItem("preferredLanguage"), "it", "Manual choice persisted");
            assertEq(
                __gtagCalls.some(c => c[0] === "event" && c[1] === "language_select" && c[2].language === "it" && c[2].previous_language === "sq"),
                true,
                "Manual dropdown click fires language_select with previous_language"
            );
            assertEq(
                waLink.href.includes(encodeURIComponent(WHATSAPP_MESSAGES.it.restaurant)),
                true,
                "WhatsApp link updated to Italian restaurant prompt"
            );
            const itScript = hbHost.children.find(c => c.tagName === "SCRIPT");
            assertEq(itScript.dataset.lang, "it", "HotelBee mounted with data-lang=it");

            // 3. Greek (el) falls back cleanly to data-lang=en on HotelBee while translating page & WhatsApp to Greek
            hbHost.children = [];
            setLanguage("el", { updateUrl: true, recordUsage: true, isManual: true });
            const elScript = hbHost.children.find(c => c.tagName === "SCRIPT");
            assertEq(elScript.dataset.lang, "en", "HotelBee falls back to en for Greek");
            assertEq(
                waLink.href.includes(encodeURIComponent(WHATSAPP_MESSAGES.el.restaurant)),
                true,
                "WhatsApp link updated to Greek restaurant prompt"
            );

            // 4. Switching back to English restores captured original English HTML
            setLanguage("en", { updateUrl: true, recordUsage: true, isManual: true });
            assertEq(titleEl.innerHTML, "Welcome", "English text restored from WeakMap");
            assertEq(window.history.lastUrl, "/?lang=en", "URL updated cleanly via history.replaceState");

            // 5. URL language parsing (?lang= and #lang=, case-insensitive, first or subsequent param)
            window.location.search = "?lang=DE";
            window.location.hash = "";
            assertEq(getUrlLanguage(), "de", "Case-insensitive ?lang=DE as first param");

            window.location.search = "?utm_source=instagram&lang=SQ";
            window.location.hash = "";
            assertEq(getUrlLanguage(), "sq", "Case-insensitive ?lang=SQ parsed alongside UTM params");

            window.location.search = "";
            window.location.hash = "#lang=IT";
            assertEq(getUrlLanguage(), "it", "Case-insensitive #lang=IT hash parsed");

            window.location.search = "?lang=invalid";
            window.location.hash = "";
            assertEq(getUrlLanguage(), null, "Unsupported ?lang= returns null");

            // 6. Consent updates keep ad_* strictly denied
            __gtagCalls.length = 0;
            updateAnalyticsConsent(true);
            assertEq(localStorage.getItem("analytics-consent"), "accepted", "Consent accepted saved");
            const grantCall = __gtagCalls.find(c => c[0] === "consent" && c[1] === "update");
            assertDeepEq(grantCall[2], {
                analytics_storage: "granted",
                ad_storage: "denied",
                ad_user_data: "denied",
                ad_personalization: "denied"
            }, "Accepting analytics keeps all ad_* signals denied");

            __gtagCalls.length = 0;
            updateAnalyticsConsent(false);
            assertEq(localStorage.getItem("analytics-consent"), "rejected", "Consent rejected saved");
            const denyCall = __gtagCalls.find(c => c[0] === "consent" && c[1] === "update");
            assertEq(denyCall[2].analytics_storage, "denied", "Declining analytics sets analytics_storage denied");
            """
        )


if __name__ == "__main__":
    unittest.main()
