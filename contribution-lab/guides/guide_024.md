# Developer Guide 24: Subsystem Best Practices

## Overview
This guide documents integration patterns for verification module 24.

## Pattern Guidelines
- Always wrap external API calls in a retry handler with exponential backoff.
- Validate telemetry events using JSON schemas before ingestion.
- Never log plaintext secrets or sensitive tokens.

## Code Example
```javascript
const { validateRule25 } = require('../validators/rule_025.js');
const res = validateRule25('example_token');
console.log('Result:', res);
```
