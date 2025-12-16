/**
 * Remove all whitespace from a value string.
 * Useful for cleaning prices like "34,\n99" -> "34,99"
 */
export function cleanValue(val) {
    return val.replace(/\s+/g, '').trim();
}
/**
 * Convert a date to a human-readable "time ago" string.
 * @param dateParam - Date string, Date object, or null/undefined
 * @returns Human-readable string like "5m ago", "2h ago", "3d ago"
 */
export function timeAgo(dateParam) {
    if (!dateParam)
        return null;
    const date = typeof dateParam === 'object' ? dateParam : new Date(dateParam.toString().replace(' ', 'T'));
    const today = new Date();
    const seconds = Math.round((today.getTime() - date.getTime()) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);
    if (seconds < 5)
        return 'just now';
    if (seconds < 60)
        return `${seconds}s ago`;
    if (minutes < 60)
        return `${minutes}m ago`;
    if (hours < 24)
        return `${hours}h ago`;
    return `${days}d ago`;
}
/**
 * Format a date string to a localized date/time string.
 * Handles ISO format and space-separated format.
 */
export function formatDate(dateString) {
    if (!dateString)
        return 'Unknown Date';
    try {
        const isoString = dateString.toString().replace(' ', 'T');
        const date = new Date(isoString);
        if (isNaN(date.getTime()))
            return 'Invalid Date';
        return date.toLocaleString();
    }
    catch {
        return 'Error Date';
    }
}
/**
 * Parse tags from JSON string safely.
 * @param tagsJson - JSON string like '["tag1", "tag2"]' or undefined
 * @returns Array of tag strings
 */
export function parseTags(tagsJson) {
    if (!tagsJson)
        return [];
    try {
        return JSON.parse(tagsJson);
    }
    catch {
        return [];
    }
}
/**
 * Calculate sparkline index for displaying history bars.
 * History is sorted newest-first, but we want newest on the right.
 *
 * @param barIndex - The bar position (0 = leftmost, barCount-1 = rightmost)
 * @param historyLength - Number of history items available
 * @param barCount - Total number of bars to display
 * @returns The history array index, or -1 if bar should be empty
 */
export function getSparklineHistoryIndex(barIndex, historyLength, barCount = 10) {
    // Rightmost bar (barCount-1) should show history[0] (newest)
    const historyIndex = (barCount - 1) - barIndex;
    return historyIndex < historyLength ? historyIndex : -1;
}
/**
 * Get the color for a history status.
 */
export function getStatusColor(status) {
    switch (status) {
        case 'unchanged': return '#22c55e'; // green
        case 'changed': return '#eab308'; // yellow
        case 'error': return '#ef4444'; // red
        default: return '#6b7280'; // gray
    }
}
