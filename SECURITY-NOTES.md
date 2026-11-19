# Security notes: proxy and location controls

This note documents important limits and the current hardening work. It is not a claim that the extension prevents every network or browser-level leak.

## Proxy

- This is a **browser proxy**, not a device-wide VPN. Only browser traffic selected by the PAC rules is routed through it. Local/private destinations, bypass entries, and non-matching sites in `sites` mode intentionally use `DIRECT`.
- `fail closed` means the PAC result for a selected proxy route does not include `DIRECT`; it does not prevent traffic outside this browser/profile from using the ISP connection.
- A PAC configuration cannot by itself prove that DNS, IPv6, WebRTC, extensions, or other applications are leak-free. Test those paths on the actual browser, OS, profile, and proxy endpoint.
- If another extension or policy controls Chrome's proxy, Azaya Shield reports that it could not take control rather than silently clearing that setting.
- Invalid or missing proxy profiles in an active mode are routed to a local non-listening endpoint rather than directly, where the extension can control proxy settings.
- Proxy credentials are supplied only for an HTTP(S) auth challenge whose host and port match the selected profile. Credentials remain in local extension storage; this is not encryption at rest. Do not export them, commit them, or reuse important account passwords.
- The IP-check feature contacts its configured IP-lookup provider, which sees the request IP. The proxy operator can see destination metadata; HTTPS content remains encrypted in transit to the destination.

## Geolocation

- The feature changes only the page's Geolocation API response. It does not change public IP location, OS location, timezone, language, or browser fingerprint.
- The main-world shim and isolated-world bridge currently exchange configuration through DOM events. **A nonce in a page-visible event is not a secret or a security boundary against hostile JavaScript on that page.** A hostile page can observe/forge DOM events. Therefore the current implementation must not be described as guaranteed protection against deliberate geolocation API tampering or location leakage.
- The shim validates configuration and fails closed if configuration never arrives, but these measures do not make a page-visible message authenticated. Reload pages after changing settings; already-open documents may retain their original configuration.
- For sensitive use, disable site geolocation in browser settings or deny the site's permission. Treat this extension feature as a compatibility/privacy convenience, not a defense against a malicious page.

## Validation

Node/VM tests check logic in a simulated environment. They do not prove Chrome runtime behavior or absence of IP/DNS/WebRTC leaks. Before relying on the proxy, test public IPv4/IPv6, DNS, WebRTC, and behavior after disconnecting the proxy. Use a test profile and a proxy endpoint you control.
