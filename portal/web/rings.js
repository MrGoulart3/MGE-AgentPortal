'use strict';
window.PortalRings = (() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function ring(percent, options = {}) {
    const p = Math.max(0, Math.min(100, Number(percent) || 0));
    const ours = Math.max(0, Math.min(p, Number(options.ours) || 0));
    const circumference = 2 * Math.PI * 46;
    const color = options.color || (p >= 90 ? '#d13b3b' : p >= 75 ? '#c98a00' : '#1f8a46');
    const arc = (value, stroke, start) => `<circle cx="60" cy="60" r="46" fill="none" stroke="${stroke}" stroke-width="11" stroke-dasharray="${circumference * value / 100} ${circumference}" transform="rotate(${-90 + start * 3.6} 60 60)"/>`;
    return `<svg viewBox="0 0 120 120" role="img" aria-label="${escape(options.label || options.text || p + '%')}"><circle class="ring-track" cx="60" cy="60" r="46" stroke-width="11"/>${arc(ours, '#3579e8', 0)}${arc(p - ours, color, ours)}<text class="ring-value" style="font-size:${String(options.text ?? p).length > 6 ? 13 : 21}px" x="60" y="61" text-anchor="middle">${escape(options.text ?? Math.round(p))}</text><text class="ring-unit" x="60" y="80" text-anchor="middle">${escape(options.unit ?? '%')}</text></svg>`;
  }
  function card(title, percent, detail, options = {}) {
    return `<div class="ringcard">${ring(percent, options)}<strong>${escape(title)}</strong><small>${escape(detail)}</small></div>`;
  }
  return {ring, card, escape};
})();
