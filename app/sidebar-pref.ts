export const SIDEBAR_HIDDEN_STORAGE_KEY = "ixacs-sidebar-hidden";

/** Runs in <head> before paint so a collapsed sidebar does not flash open on refresh. */
export const SIDEBAR_BOOTSTRAP_SCRIPT = `(function(){try{var k=${JSON.stringify(SIDEBAR_HIDDEN_STORAGE_KEY)};if(localStorage.getItem(k)==="1")document.documentElement.setAttribute("data-sidebar-hidden","1");}catch(e){}})();`;
