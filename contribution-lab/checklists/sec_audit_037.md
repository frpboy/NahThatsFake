# Security Audit Standard 37

### Audit Scope
Verification criteria for cryptographic primitives and key handling in module 37.

### Controls Matrix
| Control ID | Description | Severity | Verified |
|---|---|---|---|
| SEC-37-01 | HMAC timing equality check | CRITICAL | [x] |
| SEC-37-02 | Nonce single-use replay protection | HIGH | [x] |
| SEC-37-03 | Zeroing buffers in memory | MEDIUM | [x] |
| SEC-37-04 | Rate limit window enforcement | HIGH | [x] |

### Sign-off
Automated CI validation confirmed passing on all test vectors.
