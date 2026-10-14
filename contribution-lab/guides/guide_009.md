# Developer Guide 9: Subsystem Best Practices

## Overview
This guide documents integration patterns for verification module 9.

## Pattern Guidelines
- Always wrap external API calls in a retry handler with exponential backoff.
- Validate telemetry events using JSON schemas before ingestion.
- Never log plaintext secrets or sensitive tokens.

## Code Example
```javascript
const { validateRule10 } = require('../validators/rule_010.js');
const res = validateRule10('example_token');
console.log('Result:', res);
```
