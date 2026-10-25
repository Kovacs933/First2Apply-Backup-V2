/** The candidate details the Apply assistant fills into application forms. */
export type AutofillDetails = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
};

/**
 * JavaScript run inside a job application page: fills the candidate's details into empty name, email, phone,
 * location and LinkedIn boxes. It never submits anything and never overwrites what's already typed.
 * Returns how many boxes it filled.
 */
export function buildAutofillScript(details: AutofillDetails) {
  const [firstName, ...rest] = details.fullName.trim().split(/\s+/);
  const values = {
    fullName: details.fullName.trim(),
    firstName: firstName ?? '',
    lastName: rest.join(' '),
    email: details.email.trim(),
    phone: details.phone.trim(),
    location: details.location.trim(),
    linkedinUrl: details.linkedinUrl.trim(),
  };

  return `(() => {
  const values = ${JSON.stringify(values)};
  const rules = [
    // [field, test on the box's type/autocomplete/name/label text]
    ['email', (t, d) => t === 'email' || /\\be-?mail\\b/.test(d)],
    ['phone', (t, d) => t === 'tel' || /\\b(phone|mobile|telephone|tel)\\b/.test(d)],
    ['linkedinUrl', (t, d) => /linkedin/.test(d)],
    ['firstName', (t, d) => /given-name|first.?name|forename|\\bfname\\b/.test(d)],
    ['lastName', (t, d) => /family-name|last.?name|surname|family.?name|\\blname\\b/.test(d)],
    ['fullName', (t, d) => /full.?name|your name|^\\s*name\\s*\\*?\\s*$|\\bname\\b/.test(d) && !/company|employer|user|file|refer|school|college|university|job|manager|recruiter|account|bank|middle|preferred|pronoun/.test(d)],
    ['location', (t, d) => /\\b(city|town|location|current location|where do you live)\\b/.test(d) && !/postcode|post code|zip|relocat|willing/.test(d)],
  ];

  const labelText = (el) => {
    const parts = [el.getAttribute('aria-label') || '', el.placeholder || '', el.name || '', el.id || '', el.getAttribute('autocomplete') || ''];
    if (el.id) document.querySelectorAll('label[for="' + CSS.escape(el.id) + '"]').forEach((l) => parts.push(l.innerText));
    const wrap = el.closest('label');
    if (wrap) parts.push(wrap.innerText);
    (el.getAttribute('aria-labelledby') || '').split(/\\s+/).filter(Boolean).forEach((id) => {
      const l = document.getElementById(id);
      if (l) parts.push(l.innerText);
    });
    return parts.join(' ').toLowerCase();
  };
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const setValue = (el, value) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    el.style.outline = '2px solid #E8A55A';
  };

  const used = new Set();
  let filled = 0;
  const boxes = document.querySelectorAll('input:not([type]), input[type=text], input[type=email], input[type=tel], input[type=url], input[type=search], textarea');
  for (const el of boxes) {
    if (el.disabled || el.readOnly || el.value.trim() || !isVisible(el)) continue;
    if (el instanceof HTMLTextAreaElement && el.rows > 2) continue; // cover letters and questions are for the candidate
    const t = (el.getAttribute('type') || 'text').toLowerCase();
    const d = labelText(el);
    const rule = rules.find(([field, test]) => values[field] && test(t, d) && !(used.has(field) && field !== 'email'));
    if (!rule) continue;
    setValue(el, values[rule[0]]);
    used.add(rule[0]);
    filled++;
  }
  return filled;
})()`;
}
