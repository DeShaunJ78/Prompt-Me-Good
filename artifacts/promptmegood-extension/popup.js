/* Popup controller. Talks to background.js via chrome.runtime
 * messages so the storage helpers stay in one place. */

'use strict';

(function () {
  var DEFAULT_BASE_URL = 'https://www.promptmegood.com/';

  var input  = document.getElementById('pmg-pop-base');
  var form   = document.getElementById('pmg-pop-form');
  var reset  = document.getElementById('pmg-pop-reset');
  var status = document.getElementById('pmg-pop-status');

  function setStatus(msg, kind) {
    status.textContent = msg || '';
    status.classList.remove('is-ok', 'is-error');
    if (kind === 'ok')    status.classList.add('is-ok');
    if (kind === 'error') status.classList.add('is-error');
  }

  /* Hydrate the input from storage on open. */
  try {
    chrome.runtime.sendMessage({ type: 'pmg.getBaseUrl' }, function (resp) {
      if (resp && resp.baseUrl) input.value = resp.baseUrl;
      else                      input.value = DEFAULT_BASE_URL;
    });
  } catch (_) {
    input.value = DEFAULT_BASE_URL;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = (input.value || '').trim();
    chrome.runtime.sendMessage({ type: 'pmg.setBaseUrl', baseUrl: v }, function (resp) {
      if (resp && resp.ok) {
        setStatus('Saved — right-click menu now points at this URL.', 'ok');
      } else {
        setStatus((resp && resp.error) || 'Could not save. Check the URL and try again.', 'error');
      }
    });
  });

  reset.addEventListener('click', function () {
    input.value = DEFAULT_BASE_URL;
    chrome.runtime.sendMessage({ type: 'pmg.setBaseUrl', baseUrl: DEFAULT_BASE_URL }, function (resp) {
      if (resp && resp.ok) setStatus('Reset to the live site.', 'ok');
      else                 setStatus('Could not reset. Try again.', 'error');
    });
  });
})();
