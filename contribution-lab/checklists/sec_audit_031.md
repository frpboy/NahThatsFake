# Security Audit Standard 31

### Audit Scope
Verification criteria for cryptographic primitives and key handling in module 31.

### Controls Matrix
| Control ID | Description | Severity | Verified |
|---|---|---|---|
| SEC-31-01 | HMAC timing equality check | CRITICAL | [x] |
| SEC-31-02 | Nonce single-use replay protection | HIGH | [x] |
| SEC-31-03 | Zeroing buffers in memory | MEDIUM | [x] |
| SEC-31-04 | Rate limit window enforcement | HIGH | [x] |

### Sign-off
Automated CI validation confirmed passing on all test vectors.
