# Developer Guide 25: Subsystem Best Practices

## Overview
This guide documents integration patterns for verification module 25.

## Pattern Guidelines
- Always wrap external API calls in a retry handler with exponential backoff.
- Validate telemetry events using JSON schemas before ingestion.
- Never log plaintext secrets or sensitive tokens.

## Code Example
```javascript
const { validateRule26 } = require('../validators/rule_026.js');
const res = validateRule26('example_token');
console.log('Result:', res);
```
