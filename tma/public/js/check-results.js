/**
 * Separate per-check results for the Mini App.
 *
 * Suggestion by Alex Meleshko (LinkedIn, on the Nah That's Fake launch post):
 * "If the image service times out but the link check comes back clean, I'd
 * show those as two separate results. A green check next to the link is easy
 * to read as a verdict on the photo too."
 *
 * So every check is described on its own: a check whose service timed out or
 * was inconclusive has NO verdict (risk_level/score are null) and must never
 * be shown with another check's clean/green result. The summary flags any
 * inconclusive part instead of presenting one combined verdict.
 *
 * UMD: works as a browser global (window.SeparateCheckResults) and via
 * require() in tests.
 */
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.SeparateCheckResults = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function toSeparateResult(type, outcome) {
        if (outcome && outcome.status === 'complete') {
            return {
                type: type,
                status: 'complete',
                risk_level: outcome.risk_level,
                score: outcome.score
            };
        }
        // Timeout / error / inconclusive / missing score: no verdict for
        // this check, and nothing borrowed from the other check.
        return {
            type: type,
            status: 'inconclusive',
            risk_level: null,
            score: null,
            reason: outcome && outcome.status ? outcome.status : 'inconclusive'
        };
    }

    /**
     * Derive one check's outcome from a stored check row. A row without a
     * real risk level or score was inconclusive — it is not "0% risk".
     */
    function outcomeFromCheckRow(check) {
        if (!check) return null;
        const risk = check.risk_level;
        if ((risk === 'HIGH' || risk === 'MEDIUM' || risk === 'LOW') &&
            typeof check.score === 'number') {
            return { status: 'complete', risk_level: risk, score: check.score };
        }
        return { status: 'inconclusive' };
    }

    function buildSeparateResults(input) {
        input = input || {};
        const results = [];
        if (input.image) results.push(toSeparateResult('image', input.image));
        if (input.link) results.push(toSeparateResult('link', input.link));

        const inconclusiveTypes = results
            .filter(function (r) { return r.status === 'inconclusive'; })
            .map(function (r) { return r.type; });
        const complete = inconclusiveTypes.length === 0;

        const headline = complete
            ? 'Separate results for each check — each verdict applies only to its own check.'
            : 'Partial result: the ' + inconclusiveTypes.join(' and ') +
              ' check is inconclusive, so there is no verdict for it. ' +
              'Each result applies only to its own check.';

        return {
            results: results,
            summary: { complete: complete, inconclusiveTypes: inconclusiveTypes, headline: headline }
        };
    }

    /** Plain-text description of ONE check's own result, for detail views. */
    function describeCheckResult(check) {
        const type = check && check.check_type === 'image' ? 'image' : 'link';
        const separate = buildSeparateResults(
            type === 'image'
                ? { image: outcomeFromCheckRow(check) }
                : { link: outcomeFromCheckRow(check) }
        );
        const result = separate.results[0];
        const label = type === 'image' ? 'Image check' : 'Link check';

        if (result.status !== 'complete') {
            return label + ': inconclusive — no verdict was produced for this ' +
                type + '. This is not a clean or safe result.';
        }
        const percent = Math.round(result.score * 100);
        return label + ': ' + result.risk_level + ' risk (' + percent + '%). ' +
            'This verdict applies only to this ' + type + '.';
    }

    return {
        buildSeparateResults: buildSeparateResults,
        outcomeFromCheckRow: outcomeFromCheckRow,
        describeCheckResult: describeCheckResult
    };
});
