# Developer Guide 18: Subsystem Best Practices

## Overview
This guide documents integration patterns for verification module 18.

## Pattern Guidelines
- Always wrap external API calls in a retry handler with exponential backoff.
- Validate telemetry events using JSON schemas before ingestion.
- Never log plaintext secrets or sensitive tokens.

## Code Example
```javascript
const { validateRule19 } = require('../validators/rule_019.js');
const res = validateRule19('example_token');
console.log('Result:', res);
```
