"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BLACKPEARL_REQUEST_TIMEOUT_MS = void 0;
exports.blackPearlRequest = blackPearlRequest;
exports.blackPearlHeaders = blackPearlHeaders;
exports.sleep = sleep;
exports.normalizeString = normalizeString;
exports.BLACKPEARL_REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;
const LOG_BODY_PREVIEW_CHARS = 500;
async function blackPearlRequest(logger, url, init, context, jobId) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), exports.BLACKPEARL_REQUEST_TIMEOUT_MS);
        const startedAt = Date.now();
        logger.debug(`BlackPearl -> ${init.method} ${context} (attempt ${attempt}/${MAX_ATTEMPTS})`);
        let response;
        try {
            response = await fetch(url, { ...init, signal: controller.signal });
        }
        catch (error) {
            clearTimeout(timeout);
            const elapsedMs = Date.now() - startedAt;
            const isTimeout = error instanceof Error && error.name === 'AbortError';
            const reason = isTimeout
                ? `timed out after ${exports.BLACKPEARL_REQUEST_TIMEOUT_MS}ms`
                : `network error: ${error instanceof Error ? error.message : String(error)}`;
            logger.error(`BlackPearl <- FAILED ${context} (attempt ${attempt}/${MAX_ATTEMPTS}) after ${elapsedMs}ms: ${reason}`);
            if (attempt < MAX_ATTEMPTS) {
                await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
                continue;
            }
            return null;
        }
        clearTimeout(timeout);
        const elapsedMs = Date.now() - startedAt;
        const bodyText = await safeReadText(response);
        if (response.status === 401 || response.status === 403) {
            logger.error(`BlackPearl <- HTTP ${response.status} ${context} in ${elapsedMs}ms - authentication failed, check BLACKPEARL_API_KEY. Body: ${truncate(bodyText)}`);
            return null;
        }
        if (response.status === 404) {
            logger.warn(`BlackPearl <- HTTP 404 ${context} in ${elapsedMs}ms. Body: ${truncate(bodyText)}`);
            return null;
        }
        if (response.status === 503) {
            logCompleteErrorResponse(logger, response, bodyText, context, jobId);
        }
        if (response.status === 429 || response.status >= 500) {
            if (response.status !== 503) {
                logger.error(`BlackPearl <- HTTP ${response.status} ${context} in ${elapsedMs}ms - transient failure. Body: ${truncate(bodyText)}`);
            }
            if (attempt < MAX_ATTEMPTS) {
                const backoffMs = RETRY_BASE_DELAY_MS *
                    2 ** (attempt - 1) *
                    (response.status === 429 ? 2 : 1);
                await sleep(backoffMs);
                continue;
            }
            return null;
        }
        if (!response.ok) {
            logger.error(`BlackPearl <- HTTP ${response.status} ${context} in ${elapsedMs}ms. Body: ${truncate(bodyText)}`);
            return null;
        }
        logger.log(`BlackPearl <- HTTP ${response.status} ${context} in ${elapsedMs}ms. Body: ${truncate(bodyText)}`);
        try {
            return JSON.parse(bodyText);
        }
        catch (error) {
            logger.error(`BlackPearl returned an unparseable response trying to ${context}: ${error instanceof Error ? error.message : String(error)}. Raw body: ${truncate(bodyText)}`);
            return null;
        }
    }
    return null;
}
function blackPearlHeaders(apiKey) {
    return {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    };
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function normalizeString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
async function safeReadText(response) {
    try {
        return await response.text();
    }
    catch (error) {
        return `<failed to read response body: ${error instanceof Error ? error.message : String(error)}>`;
    }
}
function truncate(text, maxLength = LOG_BODY_PREVIEW_CHARS) {
    if (text.length <= maxLength)
        return text;
    return `${text.slice(0, maxLength)}... (${text.length} chars total)`;
}
function logCompleteErrorResponse(logger, response, bodyText, context, jobId) {
    const headers = {};
    response.headers.forEach((value, key) => {
        headers[key] = value;
    });
    logger.error(`BlackPearl 503 (transient - job continues running server-side) trying to ${context}: ${JSON.stringify({
        httpStatus: response.status,
        jobId: jobId ?? null,
        timestamp: new Date().toISOString(),
        responseHeaders: headers,
        responseBody: bodyText,
    })}`);
}
//# sourceMappingURL=blackpearl-http.util.js.map