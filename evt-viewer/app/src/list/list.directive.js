/**
 * @ngdoc directive
 * @module evtviewer.list
 * @name evtviewer.list.directive:evtList
 * @description 
 * # evtList
 * <p>Container that shows a list of named entities,
 * (divided by indexing letter) which are not "loaded" or "initialized" all together, 
 * but in group of 5 elements when scrolling occurs 
 * (it uses infinite scrolling to perform the lazy loading of elements)
 * <p>The list of elements itself depend on the type of list; elements are retrieved from 
 * {@link evtviewer.dataHandler.parsedData}.</p> 
 * <p>Available types are:<ul>
 * <li> **person**: will retrieve and show a list of persons;</li>
 * <li> **place**: will retrieve and show a list of places;</li>
 * <li> **org**: will retrieve and show a list of organizations;</li>
 * <li> **generic**: will retrieve and show a list of generic named entities.</li>
 * </ul></p>
 * <p>The {@link evtviewer.list.controller:ListCtrl controller} for this directive is dynamically defined 
 * inside the {@link evtviewer.list.evtList evtList} provider file.</p>
 *
 * @scope
 * @param {string=} listId id of list
 * @param {string=} listType type of list ('person', 'place', 'org', 'generic')
 *
 * @restrict E
 *
 * @requires evtviewer.dataHandler.parsedData
 * @requires evtviewer.list.evtList
**/
angular.module('evtviewer.list')

.directive('evtList', ['evtList', 'evtInterface', function(evtList, evtInterface) {
    return {
        restrict: 'E',
        scope: {
            listId : '@',
            listType: '@'
        },
        transclude: true,
        template: require('./list.dir.tmpl.html'),
        link: function(scope, element, attrs){
            // Initialize list
            scope.vm = {
                listId: scope.listId,
                listType: scope.listType
            };
            var currentList = evtList.build(scope.listId, scope);

            // Pagination logic for named entities list
            var NAMED_ENTITIES_LIST_TYPES = ['person', 'place', 'org', 'generic'];
            scope.vm.isNamedEntitiesList = NAMED_ENTITIES_LIST_TYPES.includes(scope.vm.listType);
            scope.vm.pageSize = 20;
            scope.vm.currentPage = 1;
            scope.vm.totalPages = 1;

            function updatePagination() {
                if (!scope.vm.isNamedEntitiesList) return;
                var total = currentList.elementsInListKey ? currentList.elementsInListKey.length : 0;
                scope.vm.totalPages = Math.max(1, Math.ceil(total / scope.vm.pageSize));
                var start = (scope.vm.currentPage - 1) * scope.vm.pageSize;
                var end = start + scope.vm.pageSize;
                scope.vm.visibleElements = currentList.elementsInListKey ? currentList.elementsInListKey.slice(start, end) : [];
            }

            if (scope.vm.isNamedEntitiesList) {
                scope.$watch(function() {
                    return currentList.elementsInListKey && currentList.elementsInListKey.length;
                }, function() {
                    scope.vm.currentPage = 1;
                    updatePagination();
                });

                scope.vm.nextPage = function() {
                    if (scope.vm.currentPage < scope.vm.totalPages) {
                        scope.vm.currentPage++;
                        updatePagination();
                    }
                };
                scope.vm.prevPage = function() {
                    if (scope.vm.currentPage > 1) {
                        scope.vm.currentPage--;
                        updatePagination();
                    }
                };
                // Also update on letter change
                scope.$watch(function() { return currentList.selectedLetter; }, function() {
                    scope.vm.currentPage = 1;
                    updatePagination();
                });
            }

            // Keep original infinite scroll for other lists
            if (!scope.vm.isNamedEntitiesList) {
                scope.vm.loadMoreElements = function() {
                    currentList.loadMoreElements();
                    scope.vm.visibleElements = currentList.visibleElements;
                };
                scope.vm.visibleElements = currentList.visibleElements;
            }

            scope.vm.scrollToElement = function(entityId) {
                var scrollDiv = angular.element(element).find('.scrollableDiv')[0];
                var entity = angular.element(scrollDiv).find('[data-entity-id="' + entityId +'"]');
                if (entity.length > 0 && entity[0]) {
                    scrollDiv.scrollTop = entity[0].offsetTop;
                }
                console.log(scrollDiv.scrollTop)
            }

            scope.$watch(function() {
                return evtInterface.getState('currentNamedEntity');
            }, function(newItem, oldItem) {
                if (newItem !== oldItem) {
                    currentList.selectLetter(newItem.charAt(0));
                }
            });
            // Garbage collection
            scope.$on('$destroy', function() {
                if (currentList){
                    currentList.destroy();
                }     
            });
        }
    };
}]);