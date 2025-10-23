'use strict';

/**
 * @ngdoc overview
 * @name evtviewer.imageViewer
 * @description
 * # evtviewer.imageViewer
 * Module referring to viewer, intended as a single content of image
 */

angular.module('evtviewer.imageViewer', ['evtviewer.openseadragon','evtviewer.imageViewerService']);

(function () {
   var imageModule = angular.module('evtviewer.imageViewer', ['evtviewer.openseadragon','evtviewer.imageViewerService']);

     // NOTE: This controller is kept for backwards compatibility
     // The actual viewer configuration comes from imageViewer.provider.js via osd.build()
     imageModule.controller('imageViewerCtrl', [function () {
         // Empty controller - configuration handled by osd provider
      }]);
})();
