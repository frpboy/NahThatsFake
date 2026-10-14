# Developer Guide 4: Subsystem Best Practices

## Overview
This guide documents integration patterns for verification module 4.

## Pattern Guidelines
- Always wrap external API calls in a retry handler with exponential backoff.
- Validate telemetry events using JSON schemas before ingestion.
- Never log plaintext secrets or sensitive tokens.

## Code Example
```javascript
const { validateRule5 } = require('../validators/rule_005.js');
const res = validateRule5('example_token');
console.log('Result:', res);
```
