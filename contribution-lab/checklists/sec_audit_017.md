# Security Audit Standard 17

### Audit Scope
Verification criteria for cryptographic primitives and key handling in module 17.

### Controls Matrix
| Control ID | Description | Severity | Verified |
|---|---|---|---|
| SEC-17-01 | HMAC timing equality check | CRITICAL | [x] |
| SEC-17-02 | Nonce single-use replay protection | HIGH | [x] |
| SEC-17-03 | Zeroing buffers in memory | MEDIUM | [x] |
| SEC-17-04 | Rate limit window enforcement | HIGH | [x] |

### Sign-off
Automated CI validation confirmed passing on all test vectors.
