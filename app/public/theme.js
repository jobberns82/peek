'use strict';
// Dag- en nachtmodus, zoals bij MyPad: Auto volgt het apparaat, of kies dag of nacht.
// Staat los in <head> zodat de juiste kleuren er staan voordat de pagina getekend wordt.
(function () {
  var KEY = 'peek_thema';
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var pref = 'auto';
  try { var v = JSON.parse(localStorage.getItem(KEY)); if (v === 'light' || v === 'dark' || v === 'auto') pref = v; } catch (e) { /* standaard */ }

  function effective() { return pref === 'auto' ? (mq && mq.matches ? 'dark' : 'light') : pref; }
  function apply() {
    document.documentElement.setAttribute('data-theme', effective());
    var buttons = document.querySelectorAll('#thema button');
    for (var i = 0; i < buttons.length; i++) buttons[i].classList.toggle('on', buttons[i].dataset.t === pref);
  }
  function set(t) {
    pref = t === 'light' || t === 'dark' ? t : 'auto';
    try { localStorage.setItem(KEY, JSON.stringify(pref)); } catch (e) { /* niet erg */ }
    apply();
  }
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (pref === 'auto') apply(); });

  apply();
  document.addEventListener('DOMContentLoaded', function () {
    apply();
    var box = document.getElementById('thema');
    if (box) box.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) set(b.dataset.t); });
  });
})();
