import { translations } from './translations.js';

const supportedLangs = Object.keys(translations);

function getUrlLanguage() {
    const params = new URLSearchParams(window.location.search);
    const lang = params.get('lang');
    if (lang && translations[lang]) {
        return lang;
    }

    const hash = window.location.hash.replace(/^#/, '');
    if (hash.startsWith('lang=')) {
        const parsed = hash.split('=')[1];
        if (parsed && translations[parsed]) {
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

function recordLanguageUsage(lang) {
    const storageKey = 'languageUsage';
    let usage = {};

    try {
        usage = JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch (error) {
        usage = {};
    }

    usage[lang] = (usage[lang] || 0) + 1;
    usage.lastUsed = new Date().toISOString();
    localStorage.setItem(storageKey, JSON.stringify(usage));

    if (window.gtag) {
        window.gtag('event', 'language_select', { language: lang });
    }
    if (window.dataLayer) {
        window.dataLayer.push({ event: 'language_select', language: lang });
    }
}

function setLanguage(lang, options = {}) {
    const { updateUrl = true, recordUsage = true } = options;

    if (!translations[lang]) {
        console.error(`Language ${lang} not found in translations.`);
        return;
    }

    document.documentElement.lang = lang;
    const translatableElements = document.querySelectorAll('[data-translate]');

    translatableElements.forEach(el => {
        const key = el.getAttribute('data-translate');
        if (translations[lang][key]) {
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
        recordLanguageUsage(lang);
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
            event.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}

function initReservationForm() {
    const reservationForm = document.getElementById('reservationForm');
    const reservationModal = document.getElementById('reservationModal');
    const closeModalButton = document.getElementById('closeModalButton');
    const modalOkButton = document.getElementById('modalOkButton');

    if (!reservationForm || !reservationModal) {
        return;
    }

    reservationForm.addEventListener('submit', event => {
        event.preventDefault();

        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const checkin = document.getElementById('checkin').value;
        const checkout = document.getElementById('checkout').value;

        const existingErrorMsg = reservationForm.querySelector('.error-message');
        if (existingErrorMsg) {
            existingErrorMsg.remove();
        }

        if (!name || !email || !checkin || !checkout) {
            const submitButton = reservationForm.querySelector('button[type="submit"]');
            const errorMsg = document.createElement('p');
            errorMsg.classList.add('text-red-500', 'text-sm', 'mt-2', 'error-message');
            errorMsg.textContent = translations[document.documentElement.lang]?.form_fill_all_fields || 'Please fill all required fields.';
            submitButton?.parentNode.insertBefore(errorMsg, submitButton?.nextSibling || null);
            return;
        }

        reservationModal.style.display = 'block';
        reservationForm.reset();
    });

    if (closeModalButton) {
        closeModalButton.addEventListener('click', () => {
            reservationModal.style.display = 'none';
        });
    }

    if (modalOkButton) {
        modalOkButton.addEventListener('click', () => {
            reservationModal.style.display = 'none';
        });
    }

    window.addEventListener('click', event => {
        if (event.target === reservationModal) {
            reservationModal.style.display = 'none';
        }
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

function initConsentBanner() {
    const consent = localStorage.getItem('analytics-consent');
    const banner = document.getElementById('consentBanner');
    const acceptBtn = document.getElementById('consentAccept');
    const rejectBtn = document.getElementById('consentReject');

    if (!banner) {
        return;
    }

    if (!consent) {
        banner.classList.add('show');
    }

    if (acceptBtn) {
        acceptBtn.addEventListener('click', () => {
            localStorage.setItem('analytics-consent', 'accepted');
            if (window.gtag) {
                window.gtag('consent', 'update', {
                    analytics_storage: 'granted',
                    ad_storage: 'granted'
                });
            }
            banner.classList.remove('show');
        });
    }

    if (rejectBtn) {
        rejectBtn.addEventListener('click', () => {
            localStorage.setItem('analytics-consent', 'rejected');
            if (window.gtag) {
                window.gtag('consent', 'update', {
                    analytics_storage: 'denied',
                    ad_storage: 'denied'
                });
            }
            banner.classList.remove('show');
        });
    }
}

function initPrivacyModal() {
    const privacyModal = document.getElementById('privacyModal');
    const privacyLink = document.getElementById('privacyLink');
    const footerPrivacyLink = document.getElementById('footerPrivacyLink');
    const privacyModalClose = document.getElementById('privacyModalClose');

    if (!privacyModal) {
        return;
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

    if (privacyModalClose) {
        privacyModalClose.addEventListener('click', () => {
            privacyModal.style.display = 'none';
            document.body.style.overflow = '';
        });
    }

    privacyModal.addEventListener('click', event => {
        if (event.target === privacyModal) {
            privacyModal.style.display = 'none';
            document.body.style.overflow = '';
        }
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && privacyModal.style.display === 'block') {
            privacyModal.style.display = 'none';
            document.body.style.overflow = '';
        }
    });
}

function initializeModals() {
    initConsentBanner();
    initPrivacyModal();
}

function initializeApp() {
    initLanguageDropdown();
    initMobileMenu();
    initSmoothScrolling();
    initReservationForm();
    initGallery();
    initializeModals();

    const urlLang = getUrlLanguage();
    const browserLang = (navigator.language || navigator.userLanguage || 'en').split('-')[0];
    const initialLang = urlLang || (supportedLangs.includes(browserLang) ? browserLang : 'en');
    setLanguage(initialLang, { updateUrl: true, recordUsage: true });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
