# Proxy & location security review

## Scope
This update hardens the extension's browser-proxy configuration and validates geolocation shim input. It does not claim that a browser proxy is a system VPN or that simulated tests establish leak-free behavior.

## Manual browser verification checklist

Use a separate browser profile and a proxy endpoint you own or are authorized to use.

1. Record public IPv4 and IPv6 with proxy off, then with proxy on.
2. Check DNS and WebRTC behavior while proxy is active.
3. Disconnect the proxy endpoint with fail-closed enabled; selected proxy routes should fail rather than fall back to `DIRECT`.
4. Check an explicitly bypassed domain and a non-matching domain in `sites` mode; those are intentionally direct.
5. Set proxy mode off and confirm any previous WebRTC privacy value is restored.
6. Test the geolocation feature on a harmless page you control; change the setting and reload the page.
7. Treat DOM-event nonce as observable, not authentication. Do not use the feature as a security boundary against hostile page scripts.

No network checks were run by this repository update. Results depend on the browser, OS, proxy endpoint, DNS configuration, and extensions installed.
