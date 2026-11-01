(function () {
    'use strict';

    /* Future backend integration:
       POST answers to /api/plan. Validate the response against the plan schema
       and attach provenance. Keep API keys server-side. This local prototype
       makes no network requests and claims no live inventory.
    */
    function matchesCuratedDemo(answers) {
        var expected = {
            origin: 'Los Angeles (LAX)',
            start: '2026-11-25',
            end: '2026-11-29',
            who: 'couple',
            stay: 'The Kahala Hotel & Resort',
            pace: 'Moderate',
            budget: 6000,
            mustdos: 'Diamond Head, Kualoa Ranch, intro dive, parasailing, birthday dinner 11/26 7:30 PM, Black Friday shopping'
        };
        var ages = (answers.ages || []).map(Number).sort(function (a, b) {
            return a - b;
        });
        return Object.keys(expected).every(function (key) {
            return answers[key] === expected[key];
        }) && !answers.flexible && answers.personal && answers.includeFlights !== false
            && JSON.stringify(ages) === '[18,19]'
            && JSON.stringify((answers.styles || []).slice().sort()) === '["relaxing","scenic"]'
            && !(answers.food || []).length && !answers.allergies;
    }

    window.AI = {
        generatePlan: function (answers) {
            return new Promise(function (resolve) {
                setTimeout(function () {
                    var destination = Engine.matchDestination(answers.destination);
                    var curated = destination.id === 'oahu' && !answers.templateOahu;
                    var plan = curated
                        ? JSON.parse(JSON.stringify(OAHU_SAMPLE))
                        : Engine.buildTemplatePlan(answers, destination);
                    if (curated) plan.curatedMismatch = !matchesCuratedDemo(answers);
                    plan.meta = Engine.dateRange(
                        plan.start || plan.days[0].date,
                        plan.end || plan.days[plan.days.length - 1].date
                    ) + ' · ' + plan.days.length + ' days · ' + (curated
                        ? 'Couple · Ages 18 & 19'
                        : (answers.who || 'Travelers') + ' · Ages ' + (answers.ages || []).join(' & '));
                    // Safety guidance for the fixed demo must reflect its fixed travelers.
                    resolve(Engine.applyAgeRules(plan, curated
                        ? Object.assign({}, answers, { ages: [18, 19] })
                        : answers));
                }, new URLSearchParams(location.search).get('fast') === '1' ? 0 : 1500);
            });
        },
        recommendDestinations: function (answers) {
            // Future: server-side tools with schema validation and no client keys.
            return Promise.resolve(Engine.recommend(answers));
        }
    };
}());
