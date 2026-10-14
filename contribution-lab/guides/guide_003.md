# Developer Guide 3: Subsystem Best Practices

## Overview
This guide documents integration patterns for verification module 3.

## Pattern Guidelines
- Always wrap external API calls in a retry handler with exponential backoff.
- Validate telemetry events using JSON schemas before ingestion.
- Never log plaintext secrets or sensitive tokens.

## Code Example
```javascript
const { validateRule4 } = require('../validators/rule_004.js');
const res = validateRule4('example_token');
console.log('Result:', res);
```
