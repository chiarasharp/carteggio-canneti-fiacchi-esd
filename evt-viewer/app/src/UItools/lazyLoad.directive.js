/**
 * @ngdoc directive
 * @module evtviewer.UItools
 * @name evtviewer.UItools.directive:lazyLoad
 * @description
 * # lazyLoad
 * Directive that implements lazy loading for images using Intersection Observer API.
 * Images are only loaded when they come into viewport, improving initial page load time.
 *
 * @restrict A
 *
 * @scope
 * @param {string} lazyLoad - The URL of the image to lazy load
 *
 * @author [Your Name]
**/
angular.module('evtviewer.UItools')

.directive('lazyLoad', ['$timeout', function($timeout) {
    return {
        restrict: 'A',
        scope: {
            lazyLoad: '@'
        },
        link: function(scope, element, attrs) {
            var img = element[0];

            // Set a placeholder or keep src empty initially
            img.src = attrs.placeholder || 'images/empty-image.jpg';

            // Check if Intersection Observer is supported
            if ('IntersectionObserver' in window) {
                var observer = new IntersectionObserver(function(entries, observer) {
                    entries.forEach(function(entry) {
                        if (entry.isIntersecting) {
                            // Element is in viewport, load the image
                            var imgUrl = scope.lazyLoad || attrs.lazyLoad;
                            if (imgUrl) {
                                img.src = imgUrl;
                                // Keep the onerror handler if it exists
                                if (attrs.onerror) {
                                    img.onerror = function() {
                                        eval(attrs.onerror);
                                    };
                                }
                            }
                            // Stop observing this element once loaded
                            observer.unobserve(img);
                        }
                    });
                }, {
                    // Load images slightly before they enter viewport (100px margin)
                    rootMargin: '100px'
                });

                observer.observe(img);

                // Clean up observer when element is destroyed
                scope.$on('$destroy', function() {
                    observer.disconnect();
                });
            } else {
                // Fallback for older browsers - load immediately
                $timeout(function() {
                    var imgUrl = scope.lazyLoad || attrs.lazyLoad;
                    if (imgUrl) {
                        img.src = imgUrl;
                        if (attrs.onerror) {
                            img.onerror = function() {
                                eval(attrs.onerror);
                            };
                        }
                    }
                }, 0);
            }
        }
    };
}]);
