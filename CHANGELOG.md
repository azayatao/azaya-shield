## Security hardening notes (2026-11)

Proxy profile application now checks Chrome's proxy ownership, avoids clearing settings controlled by another extension, uses a local blackhole PAC route for invalid active configurations, and reports WebRTC-policy failures instead of claiming complete protection. Proxy authentication is limited to HTTP(S) challenges matching the selected profile's exact host and port, with request-attempt tracking cleaned up on completion/error.

PAC input validation now rejects malformed modes/domains and recognizes additional private/link-local IPv4 and local IPv6 destinations. Remember that local/private routes and sites-mode exclusions intentionally remain direct.

The geolocation shim now validates and bounds configuration and coordinate jitter. Important limitation: its bridge uses page-visible DOM events, so the nonce is only a correlation value, not authentication. This feature is **not** guaranteed against hostile page JavaScript; see `SECURITY-NOTES.md`. No Node test can establish absence of network leaks; perform browser-level IPv4/IPv6/DNS/WebRTC checks with a proxy endpoint you control.
