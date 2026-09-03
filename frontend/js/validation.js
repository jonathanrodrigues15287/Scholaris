/**
 * validation.js — Shared inline form validation helpers
 *
 * Usage:
 *   Validate.setError(fieldEl, "Message")   — mark field invalid, show message
 *   Validate.clearError(fieldEl)            — remove error state
 *   Validate.clearAll(formEl)               — clear all errors in a form/container
 *   Validate.isValidTimeRange("09:00 - 10:00") — boolean
 *   Validate.isValidDate("2024-01-15")      — boolean
 *   Validate.isValidFutureDate("2024-01-15") — boolean (not strictly past)
 */

window.Validate = (function () {

  /** Attach an inline error below a field */
  function setError(field, message) {
    field.classList.add('field-error');

    // Remove existing error message if any
    const existing = field.parentElement.querySelector('.field-error-msg');
    if (existing) existing.remove();

    const msg = document.createElement('span');
    msg.className = 'field-error-msg';
    msg.setAttribute('role', 'alert');
    msg.textContent = message;

    // Insert after the field
    field.after(msg);
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', msg.id || '');
  }

  /** Remove error state from a field */
  function clearError(field) {
    field.classList.remove('field-error');
    field.removeAttribute('aria-invalid');
    const msg = field.parentElement?.querySelector('.field-error-msg');
    if (msg) msg.remove();
  }

  /** Clear all errors inside a container element */
  function clearAll(container) {
    container.querySelectorAll('.field-error').forEach(el => {
      el.classList.remove('field-error');
      el.removeAttribute('aria-invalid');
    });
    container.querySelectorAll('.field-error-msg').forEach(el => el.remove());
  }

  /**
   * Validate a time range string like "09:00 AM - 10:00 AM" or "09:00 - 10:00"
   * Returns { valid: bool, error: string }
   */
  function isValidTimeRange(str) {
    if (!str || !str.trim()) return { valid: false, error: 'Time is required.' };
    if (str.trim() === 'HH:MM - HH:MM') return { valid: false, error: 'Please enter a valid time range.' };

    const timeRe = /^\d{1,2}:\d{2}(\s*[APap][Mm])?(\s*-\s*\d{1,2}:\d{2}(\s*[APap][Mm])?)?$/;
    if (!timeRe.test(str.trim())) {
      return { valid: false, error: 'Use format HH:MM or HH:MM - HH:MM (e.g. 09:00 - 10:00).' };
    }

    // Check start < end if both provided
    const parts = str.split('-').map(s => s.trim());
    if (parts.length === 2) {
      const toMins = t => {
        const m = t.match(/(\d{1,2}):(\d{2})\s*([APap][Mm])?/);
        if (!m) return 0;
        let h = parseInt(m[1], 10), mn = parseInt(m[2], 10);
        if (m[3]) {
          const ampm = m[3].toUpperCase();
          if (ampm === 'PM' && h !== 12) h += 12;
          if (ampm === 'AM' && h === 12) h = 0;
        }
        return h * 60 + mn;
      };
      if (toMins(parts[0]) >= toMins(parts[1])) {
        return { valid: false, error: 'End time must be after start time.' };
      }
    }
    return { valid: true, error: '' };
  }

  /**
   * Validate an ISO date string (YYYY-MM-DD) or dd-mm-yyyy.
   * Returns { valid: bool, error: string }
   */
  function isValidDate(str) {
    if (!str || !str.trim()) return { valid: true, error: '' }; // optional date is ok
    const date = new Date(normaliseDate(str));
    if (isNaN(date.getTime())) return { valid: false, error: 'Invalid date. Use DD-MM-YYYY format.' };
    return { valid: true, error: '' };
  }

  /**
   * Validate that a date is not more than 10 years in the past.
   * Accepts dd-mm-yyyy or yyyy-mm-dd.
   */
  function isValidFutureDate(str) {
    if (!str || !str.trim()) return { valid: true, error: '' };
    const date = new Date(normaliseDate(str));
    if (isNaN(date.getTime())) return { valid: false, error: 'Invalid date. Use DD-MM-YYYY format.' };
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
    if (date < tenYearsAgo) return { valid: false, error: 'Date seems too far in the past.' };
    return { valid: true, error: '' };
  }

  /** Converts dd-mm-yyyy to yyyy-mm-dd so Date() can parse it */
  function normaliseDate(str) {
    const parts = str.split('-');
    if (parts.length === 3 && parts[0].length !== 4) {
      return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    }
    return str;
  }

  return { setError, clearError, clearAll, isValidTimeRange, isValidDate, isValidFutureDate };
})();
