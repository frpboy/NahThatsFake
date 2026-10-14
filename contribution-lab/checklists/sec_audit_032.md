# Security Audit Standard 32

### Audit Scope
Verification criteria for cryptographic primitives and key handling in module 32.

### Controls Matrix
| Control ID | Description | Severity | Verified |
|---|---|---|---|
| SEC-32-01 | HMAC timing equality check | CRITICAL | [x] |
| SEC-32-02 | Nonce single-use replay protection | HIGH | [x] |
| SEC-32-03 | Zeroing buffers in memory | MEDIUM | [x] |
| SEC-32-04 | Rate limit window enforcement | HIGH | [x] |

### Sign-off
Automated CI validation confirmed passing on all test vectors.
