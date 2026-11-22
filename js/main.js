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

const HOTELBEE_SUPPORTED_LANGS = new Set(['en', 'sq', 'de', 'fr', 'it']);
let currentHotelBeeLang = null;

const WHATSAPP_MESSAGES = {
    en: {
        general: 'Hello Ura e Kovaçit, I have a question about visiting.',
        restaurant: 'Hello Ura e Kovaçit, I would like to reserve a table at the restaurant.',
        spa: 'Hello Ura e Kovaçit, I would like to inquire about booking a spa treatment.',
        events: 'Hello Ura e Kovaçit, I would like to inquire about hosting a wedding, event, or retreat.'
    },
    sq: {
        general: 'Përshëndetje Ura e Kovaçit, kam një pyetje rreth vizitës.',
        restaurant: 'Përshëndetje Ura e Kovaçit, dëshiroj të rezervoj një tavolinë në restorant.',
        spa: 'Përshëndetje Ura e Kovaçit, dëshiroj të rezervoj një trajtim masazhi/wellness.',
        events: 'Përshëndetje Ura e Kovaçit, dëshiroj informacion rreth organizimit të një dasme, eventi apo retreat-i.'
    },
    de: {
        general: 'Hallo Ura e Kovaçit, ich habe eine Frage zu einem Besuch.',
        restaurant: 'Hallo Ura e Kovaçit, ich möchte gerne einen Tisch im Restaurant reservieren.',
        spa: 'Hallo Ura e Kovaçit, ich möchte gerne eine Wellness- oder Massagebehandlung buchen.',
        events: 'Hallo Ura e Kovaçit, ich möchte gerne eine Hochzeit, Veranstaltung oder ein Retreat anfragen.'
    },
    fr: {
        general: 'Bonjour Ura e Kovaçit, j’ai une question concernant une visite.',
        restaurant: 'Bonjour Ura e Kovaçit, je souhaiterais réserver une table au restaurant.',
        spa: 'Bonjour Ura e Kovaçit, je souhaiterais réserver un massage ou soin bien-être.',
        events: 'Bonjour Ura e Kovaçit, je souhaiterais des informations pour organiser un mariage, un événement ou une retraite.'
    },
    el: {
        general: 'Γεια σας Ura e Kovaçit, θα ήθελα πληροφορίες για επίσκεψη.',
        restaurant: 'Γεια σας Ura e Kovaçit, θα ήθελα να κάνω κράτηση τραπεζιού στο εστιατόριο.',
        spa: 'Γεια σας Ura e Kovaçit, θα ήθελα να κλείσω μια θεραπεία μασάζ ή ευεξίας.',
        events: 'Γεια σας Ura e Kovaçit, θα ήθελα πληροφορίες για τη διοργάνωση γάμου, εκδήλωσης ή retreat.'
    },
    it: {
        general: 'Buongiorno Ura e Kovaçit, ho una domanda su un soggiorno.',
        restaurant: 'Buongiorno Ura e Kovaçit, vorrei prenotare un tavolo al ristorante.',
        spa: 'Buongiorno Ura e Kovaçit, vorrei prenotare un massaggio o un trattamento benessere.',
        events: 'Buongiorno Ura e Kovaçit, vorrei informazioni per organizzare un matrimonio, un evento o un ritiro.'
    }
};

function updateWhatsAppLinks(lang) {
    const messages = WHATSAPP_MESSAGES[lang] || WHATSAPP_MESSAGES.en;
    document.querySelectorAll('a[data-whatsapp-intent]').forEach(link => {
        const intent = link.getAttribute('data-whatsapp-intent') || 'general';
        const text = messages[intent] || messages.general;
        link.href = `https://wa.me/355689098589?text=${encodeURIComponent(text)}`;
    });
}

function mountHotelBeeWidget(lang) {
    const host = document.getElementById('hb-search-widget-host');
    if (!host) {
        return;
    }

    const widgetLang = HOTELBEE_SUPPORTED_LANGS.has(lang) ? lang : 'en';
    if (currentHotelBeeLang === widgetLang && host.querySelector('#hb-search-widget')?.childNodes.length) {
        return;
    }
    currentHotelBeeLang = widgetLang;

    host.innerHTML = '';
    const targetDiv = document.createElement('div');
    targetDiv.id = 'hb-search-widget';
    host.appendChild(targetDiv);

    const script = document.createElement('script');
    script.src = 'https://uraekovacit.hotelbee.io/booking/embed/search.js';
    script.async = true;
    script.dataset.target = 'hb-search-widget';
    script.dataset.lang = widgetLang;
    script.dataset.buttonColor = '#9A6238';
    script.dataset.primaryColor = '#9A6238';
    script.dataset.font = 'Inter';
    script.dataset.radius = '8';
    host.appendChild(script);
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
    updateWhatsAppLinks(lang);
    mountHotelBeeWidget(lang);
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
    const controlsEl = overlay?.querySelector('.gallery-controls');
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
    let activeTitle = '';

    function showImage(i) {
        if (!gallery.length) {
            return;
        }
        index = (i + gallery.length) % gallery.length;
        imgEl.src = gallery[index];
        counter.textContent = gallery.length > 1 ? `${index + 1} / ${gallery.length}` : '';
        if (controlsEl) {
            controlsEl.style.display = gallery.length > 1 ? 'flex' : 'none';
        }
        if (caption) {
            caption.textContent = activeTitle;
        }
    }

    function openGallery(images, start = 0, title = '') {
        gallery = images.map(s => s.trim()).filter(Boolean);
        if (!gallery.length) {
            return;
        }
        activeTitle = title;

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

        const galleryData = thumb.getAttribute('data-gallery') || thumb.getAttribute('src') || '';
        const initialImages = galleryData.split(',').map(s => s.trim()).filter(Boolean);

        // Wrap thumbnail once to display subtle photo-count / expand indicator
        if (thumb.parentElement && !thumb.parentElement.classList.contains('gallery-thumb-wrap')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'gallery-thumb-wrap';
            thumb.parentNode.insertBefore(wrapper, thumb);
            wrapper.appendChild(thumb);

            const badge = document.createElement('span');
            badge.className = 'gallery-badge';
            badge.setAttribute('aria-hidden', 'true');
            const countLabel = initialImages.length > 1 ? `<span>1/${initialImages.length}</span>` : '';
            badge.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>${countLabel}`;
            wrapper.appendChild(badge);
        }

        thumb.addEventListener('click', () => {
            const latestGalleryData = thumb.getAttribute('data-gallery') || thumb.src || '';
            const images = latestGalleryData.split(',').map(s => s.trim()).filter(Boolean);
            if (!images.length && thumb.src) {
                images.push(thumb.src);
            }
            const cardHeading = thumb.closest('.card')?.querySelector('h3')?.textContent?.trim() || '';
            const galleryId = thumb.getAttribute('data-gallery-id') || thumb.getAttribute('src') || 'unknown';
            trackEvent('room_gallery_open', {
                gallery_id: galleryId,
                photo_count: images.length
            });
            openGallery(images, 0, cardHeading);
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

function initMobileStickyBar() {
    const bar = document.getElementById('mobileActionBar');
    const hero = document.getElementById('hero');
    const reservations = document.getElementById('reservations');
    const contact = document.getElementById('contact');
    const footer = document.querySelector('footer');
    const consentBanner = document.getElementById('consentBanner');

    if (!bar || !hero || !('IntersectionObserver' in window)) {
        return;
    }

    let heroVisible = true;
    let reservationsVisible = false;
    let contactVisible = false;
    let footerVisible = false;

    function syncVisibility() {
        const consentShowing = consentBanner?.classList.contains('show') || false;
        const shouldShow = !heroVisible && !reservationsVisible && !contactVisible && !footerVisible && !consentShowing;
        bar.classList.toggle('visible', shouldShow);
    }

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.target === hero) {
                heroVisible = entry.isIntersecting;
            } else if (entry.target === reservations) {
                reservationsVisible = entry.isIntersecting;
            } else if (entry.target === contact) {
                contactVisible = entry.isIntersecting;
            } else if (entry.target === footer) {
                footerVisible = entry.isIntersecting;
            }
        });
        syncVisibility();
    }, { threshold: 0.15 });

    observer.observe(hero);
    if (reservations) {
        observer.observe(reservations);
    }
    if (contact) {
        observer.observe(contact);
    }
    if (footer) {
        observer.observe(footer);
    }

    if (consentBanner && 'MutationObserver' in window) {
        const consentObserver = new MutationObserver(syncVisibility);
        consentObserver.observe(consentBanner, { attributes: true, attributeFilter: ['class'] });
    }
}

function initializeApp() {
    initLanguageDropdown();
    initMobileMenu();
    initSmoothScrolling();
    initGallery();
    initializeModals();
    initMobileStickyBar();
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
