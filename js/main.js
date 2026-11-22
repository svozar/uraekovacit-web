import { translations } from './translations.js';

const supportedLangs = ['en', ...Object.keys(translations)];
const englishText = new WeakMap();

function captureEnglishText() {
    document.querySelectorAll('[data-translate]').forEach(el => {
        englishText.set(el, el.innerHTML);
    });
}

function getUrlLanguage() {
    const params = new URLSearchParams(window.location.search);
    const lang = params.get('lang');
    if (lang && supportedLangs.includes(lang)) {
        return lang;
    }

    const hash = window.location.hash.replace(/^#/, '');
    if (hash.startsWith('lang=')) {
        const parsed = hash.split('=')[1];
        if (parsed && supportedLangs.includes(parsed)) {
            return parsed;
        }
    }

    return null;
}

function updateLanguageUrl(lang) {
    const params = new URLSearchParams(window.location.search);
    params.set('lang', lang);
    const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState({}, '', newUrl);
}

function trackEvent(eventName, params = {}) {
    if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, {
            language: document.documentElement.lang || 'en',
            ...params
        });
    }
}

function recordLanguageUsage(lang, previousLang = null, isManual = false) {
    const storageKey = 'languageUsage';
    let usage = {};

    try {
        usage = JSON.parse(localStorage.getItem(storageKey) || '{}');
        usage[lang] = (usage[lang] || 0) + 1;
        usage.lastUsed = new Date().toISOString();
        localStorage.setItem(storageKey, JSON.stringify(usage));
    } catch (error) {
        // Ignore storage quota / private browsing errors
    }

    if (typeof window.gtag === 'function') {
        window.gtag('set', 'user_properties', { preferred_language: lang });
    }

    if (isManual && lang !== previousLang) {
        trackEvent('language_select', {
            language: lang,
            previous_language: previousLang || 'en'
        });
    }
}

function setLanguage(lang, options = {}) {
    const { updateUrl = true, recordUsage = true, isManual = true } = options;

    if (!supportedLangs.includes(lang)) {
        console.error(`Language ${lang} not found in translations.`);
        return;
    }

    const previousLang = document.documentElement.lang || 'en';
    document.documentElement.lang = lang;
    const translatableElements = document.querySelectorAll('[data-translate]');

    translatableElements.forEach(el => {
        const key = el.getAttribute('data-translate');

        if (lang === 'en') {
            el.innerHTML = englishText.get(el);
        } else if (translations[lang][key]) {
            el.innerHTML = translations[lang][key];
        }
    });

    const currentLanguageLabel = document.getElementById('currentLanguageLabel');
    if (currentLanguageLabel) {
        currentLanguageLabel.textContent = lang.toUpperCase();
    }

    document.querySelectorAll('.lang-option').forEach(option => {
        if (option.getAttribute('data-lang') === lang) {
            option.classList.add('active-lang');
        } else {
            option.classList.remove('active-lang');
        }
    });

    if (updateUrl) {
        updateLanguageUrl(lang);
    }
    if (recordUsage) {
        recordLanguageUsage(lang, previousLang, isManual);
    }
}

function closeLanguageMenu() {
    const languageDropdownMenu = document.getElementById('languageDropdownMenu');
    const languageDropdownButton = document.getElementById('languageDropdownButton');

    if (languageDropdownMenu) {
        languageDropdownMenu.classList.add('hidden');
    }
    if (languageDropdownButton) {
        languageDropdownButton.setAttribute('aria-expanded', 'false');
    }
}

function initLanguageDropdown() {
    const languageDropdownButton = document.getElementById('languageDropdownButton');
    const languageDropdownMenu = document.getElementById('languageDropdownMenu');

    if (languageDropdownButton) {
        languageDropdownButton.addEventListener('click', () => {
            const isExpanded = languageDropdownButton.getAttribute('aria-expanded') === 'true';
            languageDropdownButton.setAttribute('aria-expanded', String(!isExpanded));
            if (languageDropdownMenu) {
                languageDropdownMenu.classList.toggle('hidden');
            }
        });
    }

    document.querySelectorAll('.lang-option').forEach(option => {
        option.addEventListener('click', (event) => {
            const lang = event.currentTarget.getAttribute('data-lang');
            if (lang) {
                setLanguage(lang);
                closeLanguageMenu();
            }
        });
    });

    document.addEventListener('click', event => {
        const dropdownContainer = document.getElementById('languageDropdownContainer');
        const languageDropdownMenu = document.getElementById('languageDropdownMenu');
        const languageDropdownButton = document.getElementById('languageDropdownButton');

        if (!dropdownContainer || !languageDropdownMenu || !languageDropdownButton) {
            return;
        }

        if (!dropdownContainer.contains(event.target) && !languageDropdownMenu.classList.contains('hidden')) {
            closeLanguageMenu();
        }
    });
}

function initMobileMenu() {
    const mobileMenuButton = document.getElementById('mobileMenuButton');
    const mobileMenu = document.getElementById('mobileMenu');

    if (!mobileMenuButton || !mobileMenu) {
        return;
    }

    mobileMenuButton.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });

    document.querySelectorAll('.mobile-nav-link').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.add('hidden');
        });
    });
}

function initSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (event) {
            const targetId = this.getAttribute('href');
            if (!targetId || targetId === '#') {
                return;
            }
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                event.preventDefault();
                targetElement.scrollIntoView({ behavior: 'smooth' });

                const ctaId = this.getAttribute('data-cta');
                if (ctaId) {
                    trackEvent('cta_click', {
                        cta_id: ctaId,
                        target_section: targetId.slice(1)
                    });
                } else if (this.classList.contains('nav-link')) {
                    trackEvent('nav_click', {
                        target_section: targetId.slice(1),
                        menu_type: this.classList.contains('mobile-nav-link') ? 'mobile' : 'desktop'
                    });
                }
            }
        });
    });
}

function initGallery() {
    const thumbs = Array.from(document.querySelectorAll('.room-thumb'));
    const overlay = document.getElementById('galleryOverlay');
    const imgEl = document.getElementById('galleryImage');
    const prevBtn = document.getElementById('galleryPrev');
    const nextBtn = document.getElementById('galleryNext');
    const closeBtn = document.getElementById('galleryClose');
    const counter = document.getElementById('galleryCounter');
    const caption = document.getElementById('galleryCaption');

    if (!overlay || !imgEl || !prevBtn || !nextBtn || !closeBtn || !counter) {
        return;
    }

    let gallery = [];
    let index = 0;

    function showImage(i) {
        if (!gallery.length) {
            return;
        }
        index = (i + gallery.length) % gallery.length;
        imgEl.src = gallery[index];
        counter.textContent = `${index + 1} / ${gallery.length}`;
        caption.textContent = '';
    }

    function openGallery(images, start = 0) {
        gallery = images.map(s => s.trim()).filter(Boolean);
        if (!gallery.length) {
            return;
        }

        showImage(start);
        overlay.style.display = 'block';
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeGallery() {
        overlay.style.display = 'none';
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    thumbs.forEach(thumb => {
        thumb.style.cursor = 'pointer';
        thumb.addEventListener('click', () => {
            const galleryData = thumb.getAttribute('data-gallery') || thumb.src || '';
            const images = galleryData.split(',').map(s => s.trim()).filter(Boolean);
            if (!images.length && thumb.src) {
                images.push(thumb.src);
            }
            const galleryId = thumb.getAttribute('data-gallery-id') || thumb.getAttribute('src') || 'unknown';
            trackEvent('room_gallery_open', {
                gallery_id: galleryId,
                photo_count: images.length
            });
            openGallery(images, 0);
        });
    });

    prevBtn.addEventListener('click', () => showImage(index - 1));
    nextBtn.addEventListener('click', () => showImage(index + 1));
    closeBtn.addEventListener('click', closeGallery);

    overlay.addEventListener('click', event => {
        if (event.target === overlay) {
            closeGallery();
        }
    });

    document.addEventListener('keydown', event => {
        if (overlay.style.display !== 'block') {
            return;
        }
        if (event.key === 'ArrowLeft') {
            showImage(index - 1);
        }
        if (event.key === 'ArrowRight') {
            showImage(index + 1);
        }
        if (event.key === 'Escape') {
            closeGallery();
        }
    });
}

const NON_OPT_IN_EUROPEAN_TIMEZONES = new Set([
    'Europe/Tirane',
    'Europe/Belgrade',
    'Europe/Podgorica',
    'Europe/Sarajevo',
    'Europe/Skopje',
    'Europe/Istanbul',
    'Europe/Kyiv',
    'Europe/Kiev',
    'Europe/Chisinau',
    'Europe/Minsk',
    'Europe/Moscow'
]);

const EXTRA_OPT_IN_TIMEZONES = new Set([
    'Atlantic/Reykjavik',
    'Atlantic/Canary',
    'Atlantic/Faroe',
    'Atlantic/Madeira',
    'Asia/Nicosia'
]);

function shouldShowConsentBannerByRegion() {
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        if (EXTRA_OPT_IN_TIMEZONES.has(tz)) {
            return true;
        }
        if (tz.startsWith('Europe/') && !NON_OPT_IN_EUROPEAN_TIMEZONES.has(tz)) {
            return true;
        }
    } catch (error) {
        return false;
    }
    return false;
}

function updateAnalyticsConsent(granted) {
    const status = granted ? 'accepted' : 'rejected';
    try {
        localStorage.setItem('analytics-consent', status);
    } catch (error) {
        // Ignore storage errors in private browsing modes
    }
    if (window.gtag) {
        window.gtag('consent', 'update', {
            analytics_storage: granted ? 'granted' : 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied'
        });
    }
}

function initConsentBanner() {
    let consent = null;
    try {
        consent = localStorage.getItem('analytics-consent');
    } catch (error) {
        consent = null;
    }

    const banner = document.getElementById('consentBanner');
    const acceptBtn = document.getElementById('consentAccept');
    const rejectBtn = document.getElementById('consentReject');

    if (!banner) {
        return;
    }

    if (!consent && shouldShowConsentBannerByRegion()) {
        banner.classList.add('show');
    }

    if (acceptBtn) {
        acceptBtn.addEventListener('click', () => {
            updateAnalyticsConsent(true);
            banner.classList.remove('show');
        });
    }

    if (rejectBtn) {
        rejectBtn.addEventListener('click', () => {
            updateAnalyticsConsent(false);
            banner.classList.remove('show');
        });
    }
}

function initPrivacyModal() {
    const privacyModal = document.getElementById('privacyModal');
    const privacyLink = document.getElementById('privacyLink');
    const footerPrivacyLink = document.getElementById('footerPrivacyLink');
    const privacyModalClose = document.getElementById('privacyModalClose');
    const manageConsentBtn = document.getElementById('manageConsentBtn');
    const consentBanner = document.getElementById('consentBanner');

    if (!privacyModal) {
        return;
    }

    function closePrivacyModal() {
        privacyModal.style.display = 'none';
        document.body.style.overflow = '';
    }

    if (privacyLink) {
        privacyLink.addEventListener('click', event => {
            event.preventDefault();
            privacyModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        });
    }

    if (footerPrivacyLink) {
        footerPrivacyLink.addEventListener('click', event => {
            event.preventDefault();
            privacyModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        });
    }

    if (manageConsentBtn && consentBanner) {
        manageConsentBtn.addEventListener('click', () => {
            closePrivacyModal();
            consentBanner.classList.add('show');
        });
    }

    if (privacyModalClose) {
        privacyModalClose.addEventListener('click', closePrivacyModal);
    }

    privacyModal.addEventListener('click', event => {
        if (event.target === privacyModal) {
            closePrivacyModal();
        }
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && privacyModal.style.display === 'block') {
            closePrivacyModal();
        }
    });
}

function initAnalyticsTelemetry() {
    // 1. Delegated click tracking for HotelBee search widget, contacts, menu PDF, and social links
    document.addEventListener('click', event => {
        const searchBtn = event.target.closest('#hb-search-widget .hb-sw-btn');
        if (searchBtn && !searchBtn.disabled) {
            const widget = document.getElementById('hb-search-widget');
            let checkinDisplay = '';
            let checkoutDisplay = '';
            let adults = '';
            let children = '';

            if (widget) {
                const dateBlocks = widget.querySelectorAll('.hb-sw-dates div[style*="font-weight: 600"]');
                if (dateBlocks.length >= 2) {
                    checkinDisplay = dateBlocks[0].textContent.trim();
                    checkoutDisplay = dateBlocks[1].textContent.trim();
                }
                const guestBlocks = widget.querySelectorAll('.hb-sw-guest-content div[style*="font-weight: 600"]');
                if (guestBlocks.length >= 2) {
                    adults = guestBlocks[0].textContent.trim();
                    children = guestBlocks[1].textContent.trim();
                }
            }

            trackEvent('booking_search_click', {
                checkin_display: checkinDisplay,
                checkout_display: checkoutDisplay,
                adults: Number(adults) || 2,
                children: Number(children) || 0
            });
            return;
        }

        const link = event.target.closest('a[href]');
        if (!link) {
            return;
        }

        const href = link.getAttribute('href') || '';
        const containerEl = link.closest('section[id], footer, header, [id]');
        const locationId = link.getAttribute('data-contact-location')
            || containerEl?.id
            || containerEl?.tagName?.toLowerCase()
            || 'page';

        if (href.endsWith('.pdf')) {
            trackEvent('menu_open', {
                menu_file: href.split('/').pop() || href,
                location: locationId
            });
            return;
        }

        let contactMethod = link.getAttribute('data-contact-method') || '';
        if (!contactMethod) {
            if (href.startsWith('tel:')) {
                contactMethod = 'phone';
            } else if (href.startsWith('mailto:')) {
                contactMethod = 'email';
            } else if (href.includes('wa.me/') || href.includes('whatsapp.com')) {
                contactMethod = 'whatsapp';
            } else if (href.includes('google.com/maps') || href.includes('maps.google.') || href.includes('maps.app.goo.gl')) {
                contactMethod = 'maps';
            }
        }

        if (contactMethod) {
            trackEvent('contact_click', {
                method: contactMethod,
                location: locationId
            });
            return;
        }

        if (href.includes('instagram.com')) {
            trackEvent('social_click', { platform: 'instagram', location: locationId });
        } else if (href.includes('facebook.com')) {
            trackEvent('social_click', { platform: 'facebook', location: locationId });
        }
    });

    // 2. Section visibility tracking (fires once per session when >=45% visible for >=1.5s)
    if ('IntersectionObserver' in window) {
        const seenSections = new Set();
        const dwellTimers = new Map();

        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                const sectionId = entry.target.id;
                if (!sectionId || sectionId === 'hero' || seenSections.has(sectionId)) {
                    return;
                }

                if (entry.isIntersecting) {
                    if (!dwellTimers.has(sectionId)) {
                        const timerId = window.setTimeout(() => {
                            dwellTimers.delete(sectionId);
                            if (!seenSections.has(sectionId)) {
                                seenSections.add(sectionId);
                                trackEvent('section_view', { section_id: sectionId });
                                observer.unobserve(entry.target);
                            }
                        }, 1500);
                        dwellTimers.set(sectionId, timerId);
                    }
                } else if (dwellTimers.has(sectionId)) {
                    window.clearTimeout(dwellTimers.get(sectionId));
                    dwellTimers.delete(sectionId);
                }
            });
        }, { rootMargin: '-25% 0px -25% 0px', threshold: 0.05 });

        document.querySelectorAll('section[id]').forEach(section => {
            if (section.id !== 'hero') {
                observer.observe(section);
            }
        });
    }
}

function initializeModals() {
    initConsentBanner();
    initPrivacyModal();
}

function initializeApp() {
    initLanguageDropdown();
    initMobileMenu();
    initSmoothScrolling();
    initGallery();
    initializeModals();
    initAnalyticsTelemetry();
    captureEnglishText();

    const urlLang = getUrlLanguage();
    const browserLang = (navigator.language || navigator.userLanguage || 'en').split('-')[0];
    const initialLang = urlLang || (supportedLangs.includes(browserLang) ? browserLang : 'en');
    setLanguage(initialLang, {
        updateUrl: Boolean(urlLang),
        recordUsage: true,
        isManual: false
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
