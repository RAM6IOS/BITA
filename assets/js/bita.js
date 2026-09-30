        /* BITA — shared behaviour: language switching, navigation, FAQ, page metadata. */

        /* Mobile navigation.
           Every page keeps one source of truth for its section list: buttons
           with data-go on the homepage, anchors to index.html#id on service
           pages. The panel is built from that nav instead of duplicating the
           links per page, so the section names and all three languages stay in
           one place. It is built before the language bindings below run, which
           is what keeps the cloned language switch in sync with the original. */
        (() => {
            const header = document.querySelector('header'),
                nav = header && header.querySelector('.nav'),
                trigger = document.querySelector('.menu');
            if (!header || !nav || !trigger) return;

            const FOCUSABLE = 'a[href],button:not([disabled])';

            const panel = document.createElement('div');
            panel.className = 'mobile-nav';
            panel.id = 'mobile-nav';
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-modal', 'true');
            panel.setAttribute('data-i18n', 'Main menu|القائمة الرئيسية|Menu principal');
            panel.hidden = true;

            const links = document.createElement('nav');
            links.className = 'mobile-nav-links';
            links.setAttribute('data-i18n', 'Primary navigation|التنقل الرئيسي|Navigation principale');
            nav.childNodes.forEach(item => {
                if (item.nodeType !== 1) return;
                if (item.classList.contains('lang')) {
                    const clone = item.cloneNode(true);
                    clone.classList.add('mobile-nav-lang');
                    links.append(clone);
                    return;
                }
                const a = document.createElement('a');
                a.className = 'mobile-nav-link';
                a.innerHTML = item.innerHTML;
                a.href = item.tagName === 'A' ? item.getAttribute('href') : '#' + item.dataset.go;
                links.append(a);
            });

            /* The project CTA points wherever the old header shortcut pointed:
               #contact on the homepage, ../../index.html#contact on a service
               page. The destination is preserved in the panel, which is where a
               phone visitor now expects it. */
            const cta = document.createElement('a');
            cta.className = 'button primary mobile-nav-cta';
            cta.href = trigger.tagName === 'A' ? trigger.getAttribute('href') : '#' + (trigger.dataset.go || 'contact');
            cta.setAttribute('data-t', 'Start a project|ابدأ مشروعًا|Démarrer un projet');
            links.append(cta);
            panel.append(links);
            document.body.append(panel);

            /* The shortcut becomes the toggle. It is rebuilt as a real button
               because service pages ship it as an anchor, and an anchor would
               navigate away on the first tap instead of opening the panel. */
            const btn = document.createElement('button');
            btn.className = 'menu';
            btn.type = 'button';
            const icon = document.createElement('span');
            icon.className = 'menu-icon';
            icon.setAttribute('aria-hidden', 'true');
            const label = document.createElement('span');
            label.className = 'menu-label';
            label.setAttribute('data-t', 'Menu|القائمة|Menu');
            btn.append(icon, label);
            trigger.replaceWith(btn);
            btn.setAttribute('aria-expanded', 'false');
            btn.setAttribute('aria-controls', panel.id);
            btn.setAttribute('data-i18n', 'Main menu|القائمة الرئيسية|Menu principal');

            let open = false,
                restore = null;
            const setOpen = next => {
                if (next === open) return;
                open = next;
                panel.hidden = !open;
                document.body.classList.toggle('nav-open', open);
                btn.setAttribute('aria-expanded', String(open));
                if (open) {
                    restore = document.activeElement;
                    const first = links.querySelector(FOCUSABLE);
                    if (first) first.focus();
                } else {
                    /* Focus returns to whatever opened the panel. A tap does not
                       always focus the toggle first, so an empty restore target
                       falls back to the toggle itself rather than leaving focus
                       on a link that is now hidden. */
                    const back = restore && restore !== document.body && restore.isConnected ? restore : btn;
                    restore = null;
                    back.focus();
                }
            };

            btn.addEventListener('click', () => setOpen(!open));
            /* Any destination inside the panel dismisses it, including the
               language switch, so the visitor keeps their place. */
            panel.addEventListener('click', e => {
                if (e.target.closest('a,button')) setOpen(false);
            });
            document.addEventListener('keydown', e => {
                if (!open) return;
                if (e.key === 'Escape') {
                    setOpen(false);
                    return;
                }
                if (e.key !== 'Tab') return;
                const items = [...links.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
                if (!items.length) return;
                const first = items[0],
                    last = items[items.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            });
            /* A resize past the header breakpoint hides the toggle and reveals
               the full nav; leaving the panel open over it would strand the
               body scroll lock. 761px is where bita.css stops showing .menu. */
            matchMedia('(min-width: 901px)').addEventListener('change', q => {
                if (q.matches) setOpen(false);
            });
        })();

        const LANGS = { en: 'ltr', ar: 'rtl', fr: 'ltr' },
            ORDER = Object.keys(LANGS),
            TITLES = {
                en: 'BITA — Digital Solutions',
                ar: 'BITA — حلول رقمية',
                fr: 'BITA — Solutions digitales'
            },
            root = document.documentElement,
            tr = c => ORDER.indexOf(c),
            btns = document.querySelectorAll('.lang [data-lang]'),
            descTag = document.querySelector('meta[name="description"]'),
            pageMeta = (() => {
                const el = document.getElementById('page-meta');
                if (!el) return null;
                try {
                    return JSON.parse(el.textContent);
                } catch (err) {
                    return null;
                }
            })();

        const setLang = c => {
            if (!(c in LANGS)) c = 'en';

            /* Remembered so the choice survives navigation: every page restores
               it from localStorage before it paints. Without this a reader who
               picked Arabic on one page landed on the English copy of the next
               one and had to set it again on each page. */
            try {
                localStorage.setItem('bita-lang', c);
            } catch (err) { }

            /* A language change swaps every string on the page, so the document
               height changes with it: on a phone the service pages differ by
               several thousand pixels between EN and AR, which moved the reader
               up to half a viewport. The nearest anchored block above the fold
               is remembered and restored to the same offset after the swap, so
               the reader stays on the content they were reading. */
            const y = window.scrollY;
            let anchor = null,
                offset = 0;
            if (y > 0) {
                document.querySelectorAll('[id]').forEach(el => {
                    /* Out-of-flow and unrendered nodes report a zero or a
                       viewport-relative rect, which would win the search and
                       land the correction on the wrong place: the overlay panel
                       is position:fixed, the metadata script and anything in a
                       display:none subtree have no box at all. Only a node that
                       is in normal flow with a real height can hold the fold. */
                    const pos = getComputedStyle(el).position;
                    const box = el.getBoundingClientRect();
                    if (pos === 'fixed' || pos === 'sticky' || !box.height) return;
                    const top = box.top + y;
                    if (top <= y + 8 && (!anchor || top > offset)) {
                        anchor = el.id;
                        offset = top;
                    }
                });
            }

            root.dataset.lang = c;
            root.lang = c;
            root.dir = LANGS[c];
            document.title = (pageMeta && pageMeta.titles && pageMeta.titles[c]) || TITLES[c];
            if (pageMeta && pageMeta.descriptions && pageMeta.descriptions[c] && descTag)
                descTag.setAttribute('content', pageMeta.descriptions[c]);
            btns.forEach(x => {
                x.classList.toggle('active', x.dataset.lang === c);
                x.setAttribute('aria-current', x.dataset.lang === c ? 'true' : 'false');
            });
            document.querySelectorAll('[data-i18n]').forEach(x => x.setAttribute('aria-label', x.dataset.i18n.split('|')[tr(c)]));
            document.querySelectorAll('[data-t]').forEach(x => x.textContent = x.dataset.t.split('|')[tr(c)]);
            document.querySelectorAll('[data-ph]').forEach(x => x.placeholder = x.dataset.ph.split('|')[tr(c)]);

            if (anchor) {
                const el = document.getElementById(anchor);
                if (el) {
                    /* The stylesheet sets scroll-behavior: smooth, which would
                       animate the correction into a visible glide. */
                    const smooth = root.style.scrollBehavior;
                    root.style.scrollBehavior = 'auto';
                    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - (y - offset));
                    root.style.scrollBehavior = smooth;
                }
            }
        };

        document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
            const target = document.getElementById(b.dataset.go);
            if (!target) return;
            target.scrollIntoView({
                behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
            });
        }));

        btns.forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));

        const mailLink = document.querySelector('[data-contact]');
        if (mailLink) mailLink.addEventListener('click', function () {
            const a = document.createElement('a');
            a.href = 'mailto:';
            a.setAttribute('aria-label', this.dataset.i18n.split('|')[tr(root.dataset.lang)]);
            document.body.append(a);
            a.click();
            a.remove();
        });

        /* Contact form.
           Formspree owns delivery, so the only work here is to post the fields
           and reflect the outcome in the hooks the page already ships but never
           styled: #contact-status for the page-level result, [data-fs-error]
           for the field Formspree rejected, and .submit-loading for the
           in-flight state. The endpoint stays on the form's action, so the form
           id keeps a single home.

           Every message is stored pipe-delimited and handed to the existing
           data-t binding as well as the current language, so a visitor who
           reads the result and then switches language still sees it. */
        (() => {
            const MSGS = {
                success: 'Message sent. We reply within one business day.|تم الإرسال. نرد خلال يوم عمل واحد.|Message envoyé. Nous répondons sous un jour ouvré.',
                fail: 'Something went wrong. Please try again.|حدث خطأ ما. حاول مرة أخرى.|Une erreur est survenue. Réessayez.',
                offline: 'No connection. Check your network and try again.|لا يوجد اتصال. تحقق من الشبكة وحاول مجددًا.|Pas de connexion. Vérifiez votre réseau.',
                required: 'This field is required.|هذا الحقل مطلوب.|Ce champ est requis.',
                email: 'Enter a valid email address.|أدخل بريدًا إلكترونيًا صالحًا.|Saisissez une adresse e-mail valide.'
            };
            const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

            document.querySelectorAll('.contact-form').forEach(form => {
                const action = form.getAttribute('action');

                /* The service pages reuse .contact-form as a static mockup: they
                   ship no action, so there is nowhere to post. They stay inert
                   rather than reloading the page on an empty submit. */
                if (!action) {
                    form.addEventListener('submit', e => e.preventDefault());
                    return;
                }

                const btn = form.querySelector('[data-fs-submit-btn]'),
                    status = document.getElementById('contact-status'),
                    formError = form.querySelector('.contact-form-error'),
                    slots = form.querySelectorAll('[data-fs-field]');
                let busy = false;

                /* Writes text into a slot and registers it for the data-t binding,
                   so a message stays correct in the language the visitor is
                   reading even if they switch after it appears. A string with no
                   pipe is language-neutral and survives the same split. */
                const put = (slot, text) => {
                    if (!slot) return;
                    slot.setAttribute('data-t', text);
                    slot.textContent = text.split('|')[tr(root.dataset.lang)];
                };

                const clear = () => {
                    form.querySelectorAll('[data-fs-error]').forEach(s => {
                        s.removeAttribute('data-t');
                        s.textContent = '';
                    });
                    slots.forEach(s => s.classList.remove('is-invalid'));
                };

                /* Blames one control: message in its own slot, red underline on
                   the field, and a polite live region so the reason is announced
                   as soon as focus arrives there. */
                const flag = (slot, text) => {
                    if (!slot) return null;
                    put(slot, text);
                    slot.setAttribute('aria-live', 'polite');
                    const control = form.querySelector('[name="' + slot.dataset.fsError + '"]');
                    if (control) control.classList.add('is-invalid');
                    return control;
                };

                /* Mirrors what the browser would have refused to submit, so the
                   visitor reads the reason in the field's own language instead of
                   a native bubble that does not match the page. */
                const validate = () => {
                    let first = null;
                    slots.forEach(s => {
                        const slot = form.querySelector('[data-fs-error="' + s.name + '"]');
                        if (s.required && !s.value.trim()) {
                            first = first || flag(slot, MSGS.required);
                            return;
                        }
                        if (s.type === 'email' && s.value.trim() && !EMAIL.test(s.value.trim())) {
                            first = first || flag(slot, MSGS.email);
                        }
                    });
                    return first;
                };

                form.addEventListener('submit', async e => {
                    e.preventDefault();
                    /* A double tap would post the enquiry twice, and Formspree
                       has no dedupe to catch it. */
                    if (busy) return;
                    clear();

                    const bad = validate();
                    if (bad) {
                        bad.focus();
                        return;
                    }

                    busy = true;
                    form.classList.add('is-sending');
                    if (btn) {
                        btn.disabled = true;
                        btn.setAttribute('aria-busy', 'true');
                    }

                    try {
                        const body = new FormData(form);
                        /* Replies should reach the person who wrote in, not the
                           account the form is tied to. */
                        const mail = form.querySelector('[name="email"]');
                        if (mail) body.set('_replyto', mail.value.trim());

                        const res = await fetch(action, {
                            method: 'POST',
                            body,
                            headers: { Accept: 'application/json' }
                        });
                        const data = await res.json().catch(() => ({}));

                        if (res.ok) {
                            form.reset();
                            clear();
                            put(status, MSGS.success);
                            if (status) status.classList.add('is-ok');
                            return;
                        }

                        /* Formspree names the field it objected to, so the reason
                           lands where the correction has to be made. Anything it
                           rejects without a name we can place has no field to
                           blame, and the form itself becomes the honest slot. */
                        const orphans = [];
                        let placed = false;
                        (Array.isArray(data.errors) ? data.errors : []).forEach(er => {
                            const slot = er.field && form.querySelector('[data-fs-error="' + er.field + '"]');
                            if (slot) {
                                placed = true;
                                flag(slot, er.message || MSGS.required);
                            } else if (er.message) {
                                orphans.push(er.message);
                            }
                        });

                        if (status) status.classList.remove('is-ok');
                        put(status, MSGS.fail);
                        if (!placed) put(formError, orphans.join(' ') || MSGS.fail);

                        const firstBad = form.querySelector('.is-invalid');
                        if (firstBad) firstBad.focus();
                    } catch (err) {
                        if (status) status.classList.remove('is-ok');
                        put(status, MSGS.offline);
                    } finally {
                        busy = false;
                        form.classList.remove('is-sending');
                        if (btn) {
                            btn.disabled = false;
                            btn.removeAttribute('aria-busy');
                        }
                    }
                });
            });
        })();

        /* Single-open accordion. One panel visible at a time keeps long FAQ lists scannable. */
        document.querySelectorAll('[data-faq]').forEach(group => {
            const triggers = group.querySelectorAll('.faq-q');
            triggers.forEach(btn => btn.addEventListener('click', () => {
                const isOpen = btn.getAttribute('aria-expanded') === 'true';
                triggers.forEach(other => {
                    other.setAttribute('aria-expanded', 'false');
                    const panel = document.getElementById(other.getAttribute('aria-controls'));
                    if (panel) panel.hidden = true;
                });
                if (!isOpen) {
                    const panel = document.getElementById(btn.getAttribute('aria-controls'));
                    if (panel) panel.hidden = false;
                    btn.setAttribute('aria-expanded', 'true');
                }
            }));
        });

        setLang(root.dataset.lang);
