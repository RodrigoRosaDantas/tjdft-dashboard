(() => {
  if (!("serviceWorker" in navigator)) return;
  const currentScript = document.currentScript;
  const scriptUrl = currentScript?.src
    ? new URL(currentScript.src, document.baseURI)
    : new URL("./sw-register.js", document.baseURI);
  window.addEventListener("load", () => {
    const workerUrl = new URL("sw.js", scriptUrl);
    const scope = new URL("./", workerUrl).pathname;
    navigator.serviceWorker.register(workerUrl.href, { scope }).catch(() => {
      // Offline enhancement is optional; the online study flow remains available.
    });
  });
})();
