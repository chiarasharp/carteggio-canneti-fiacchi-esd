angular.module('evtviewer.core')

.filter('capitalize', function() {
	return function(input, all) {
		var reg = (all) ? /([^\W_]+[^\s-]*) */g : /([^\W_]+[^\s-]*)/;
		return (!!input && input.replace) ? input.replace(reg, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();}) : '';
	};
})
/**
 * @ngdoc filter
 * @module evtviewer.core
 * @name evtviewer.core.filter:camelToSpaces
 * @description 
 * # camelToSpaces
 * Transform camel string (ex: 'myStringInCamel') into more readable string that uses spaces (ex: 'my string in camel').
**/
.filter('camelToSpaces', function() {
	return function(input, all) {
		return (!!input && input.replace) ? input.replace(/\s+/g, ' ').replace(/([a-z\d])([A-Z])/g, '$1 $2') : '';
	};
})
/**
 * @ngdoc filter
 * @module evtviewer.core
 * @name evtviewer.core.filter:underscoresToSpaces
 * @description 
 * # underscoresToSpaces
 * Transform undescores in string (ex: 'my_string_with_underscores') into spaces producing a more readable string (ex: 'my string with underscores').
**/
.filter('underscoresToSpaces', function() {
	return function(input, all) {
		return (!!input && input.replace) ? input.replace(/\_+/g, ' ') : '';
	};
})
/**
 * @ngdoc filter
 * @module evtviewer.core
 * @name evtviewer.core.filter:uppercase
 * @description 
 * # uppercase
 * Transform to uppercase a string (ex: 'lower case string' => 'LOWER CASE STRING').
**/
.filter('uppercase', function() {
	return function(input, all) {
		return (!!input && input.toUpperCase) ? input.toUpperCase() : '';
	};
})
/**
 * @ngdoc filter
 * @module evtviewer.core
 * @name evtviewer.core.filter:stringtohtml
 * @description 
 * # stringtohtml
 * Transform to html a string (ex: 'lower case string' => lower case string).
**/
.filter('stringtohtml', function() {
	return function(input, all) {
		return (!!input && input.replace) ? input.replace(/="[^"]+"/g,function($0){return $0.replace(/&lt;/g,'<').replace(/&gt;/g,'>');}) : '';
	};
})
/**
 * @ngdoc filter
 * @module evtviewer.core
 * @name evtviewer.core.filter:newLinesToSpaces
 * @description 
 * # newLinesToSpaces
 * Transform \n to single spaces
**/
.filter('newLinesToSpaces', function() {
    return function(input) {
		return input.replace(/\n/g, ' ');
    };
})
/**
 * @ngdoc filter
 * @module evtviewer.core
 * @name evtviewer.core.filter:normalizeMultispaces
 * @description 
 * # normalizeMultispaces
 * Transform multiple consecutive spaces to single spaces.
**/
.filter('normalizeMultispaces', function() {
    return function(input) {
		return input.replace(/\s{2,}/g, ' ');
    };
})
/**
 * @ngdoc filter
 * @module evtviewer.core
 * @name evtviewer.core.filter:formatISODate
 * @description
 * # formatISODate
 * Transform ISO date strings (YYYY-MM-DD, YYYY-MM, YYYY) into human-readable format based on current language.
**/
.filter('formatISODate', ['$translate', function($translate) {
    return function(input) {
        if (!input || typeof input !== 'string') {
            return input;
        }

        // Match ISO date patterns
        var fullDateMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        var yearMonthMatch = input.match(/^(\d{4})-(\d{2})$/);
        var yearMatch = input.match(/^(\d{4})$/);

        var currentLang = $translate.use() || 'en';

        if (fullDateMatch) {
            // Full date: YYYY-MM-DD
            var year = fullDateMatch[1];
            var month = parseInt(fullDateMatch[2], 10);
            var day = parseInt(fullDateMatch[3], 10);

            var months_it = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
                           'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
            var months_en = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];

            var monthName = (currentLang === 'it') ? months_it[month - 1] : months_en[month - 1];

            return currentLang === 'it'
                ? day + ' ' + monthName + ' ' + year
                : monthName + ' ' + day + ', ' + year;

        } else if (yearMonthMatch) {
            // Year-Month: YYYY-MM
            var year = yearMonthMatch[1];
            var month = parseInt(yearMonthMatch[2], 10);

            var months_it = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
                           'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
            var months_en = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];

            var monthName = (currentLang === 'it') ? months_it[month - 1] : months_en[month - 1];

            return monthName + ' ' + year;

        } else if (yearMatch) {
            // Year only: YYYY
            return yearMatch[1];
        }

        // Not an ISO date, return as is
        return input;
    };
}]);
