# Security Audit Standard 27

### Audit Scope
Verification criteria for cryptographic primitives and key handling in module 27.

### Controls Matrix
| Control ID | Description | Severity | Verified |
|---|---|---|---|
| SEC-27-01 | HMAC timing equality check | CRITICAL | [x] |
| SEC-27-02 | Nonce single-use replay protection | HIGH | [x] |
| SEC-27-03 | Zeroing buffers in memory | MEDIUM | [x] |
| SEC-27-04 | Rate limit window enforcement | HIGH | [x] |

### Sign-off
Automated CI validation confirmed passing on all test vectors.
