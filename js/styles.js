(function(root) {
    'use strict';
    var options = [
        ['hotel', 'Staying at the hotel', 'Pool, spa, great food on site'],
        ['wandering', 'Wandering around', 'Neighborhoods, markets, no fixed plan'],
        ['scenic', 'Scenic spots', 'Views, viewpoints, photo stops'],
        ['food', 'Food & cafés', 'Local favorites, healthy cafés'],
        ['culture', 'Culture & history', 'Museums, temples, local stories'],
        ['nature', 'Nature & beaches', 'Parks, gardens, shorelines']
    ];
    // Intensity belongs to pace. Migrate interests before filtering, deduping and capping.
    function normalize(values) {
        return (Array.isArray(values) ? values : []).map(function(key) {
            return key === 'adventure' ? 'nature' : key;
        }).filter(function(key, index, all) {
            return options.some(function(option) { return option[0] === key; }) && all.indexOf(key) === index;
        }).slice(0, 2);
    }
    root.GONOW_STYLES = options;
    root.GoNowStyles = { normalize: normalize };
}(typeof window !== 'undefined' ? window : globalThis));
