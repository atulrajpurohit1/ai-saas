"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findUnresolvedPlaceholders = findUnresolvedPlaceholders;
const PLACEHOLDER_PATTERN = /\[[^[\]\n]{2,60}\](?!\()/g;
function findUnresolvedPlaceholders(content) {
    if (!content)
        return [];
    const matches = content.match(PLACEHOLDER_PATTERN) || [];
    return [...new Set(matches)];
}
//# sourceMappingURL=proposal-content.util.js.map