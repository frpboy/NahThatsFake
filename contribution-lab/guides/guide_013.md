# Developer Guide 13: Subsystem Best Practices

## Overview
This guide documents integration patterns for verification module 13.

## Pattern Guidelines
- Always wrap external API calls in a retry handler with exponential backoff.
- Validate telemetry events using JSON schemas before ingestion.
- Never log plaintext secrets or sensitive tokens.

## Code Example
```javascript
const { validateRule14 } = require('../validators/rule_014.js');
const res = validateRule14('example_token');
console.log('Result:', res);
```
