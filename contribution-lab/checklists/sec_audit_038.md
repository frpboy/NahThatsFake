# Security Audit Standard 38

### Audit Scope
Verification criteria for cryptographic primitives and key handling in module 38.

### Controls Matrix
| Control ID | Description | Severity | Verified |
|---|---|---|---|
| SEC-38-01 | HMAC timing equality check | CRITICAL | [x] |
| SEC-38-02 | Nonce single-use replay protection | HIGH | [x] |
| SEC-38-03 | Zeroing buffers in memory | MEDIUM | [x] |
| SEC-38-04 | Rate limit window enforcement | HIGH | [x] |

### Sign-off
Automated CI validation confirmed passing on all test vectors.
