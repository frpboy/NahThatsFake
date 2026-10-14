# Developer Guide 28: Subsystem Best Practices

## Overview
This guide documents integration patterns for verification module 28.

## Pattern Guidelines
- Always wrap external API calls in a retry handler with exponential backoff.
- Validate telemetry events using JSON schemas before ingestion.
- Never log plaintext secrets or sensitive tokens.

## Code Example
```javascript
const { validateRule29 } = require('../validators/rule_029.js');
const res = validateRule29('example_token');
console.log('Result:', res);
```
