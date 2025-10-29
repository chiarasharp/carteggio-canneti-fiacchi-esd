angular.module('evtviewer.openseadragon')
     .provider('osd', function(){


        this.$get = ['parsedData', 'config', function(parsedData, config) {
            var imageViewer = {};

            imageViewer.test = function(param){
                return (param)?true:true;
            }

            imageViewer.imgCoeff = function(){
                return config.imageNormalizationCoefficient;
            }

            imageViewer.build = function(){
                 // Make a copy of config to avoid mutations
                 var options = angular.copy(config.imageViewerOptions);

                 var pages = parsedData.getPages();
                 var length = pages.length;
                 options.tileSources = [];

                 // Optimized loop - cache page lookups and avoid redundant checks
                 for(var i = 0; i < length; i++){
                     var pp = parsedData.getPage(pages[i]);
                     var source = pp.source;
                     // Simplified validation - empty string is falsy
                     if(source && source.trim()){
                        // Check if this is a IIIF image URL
                        if(source.indexOf('/iiif/') > -1 && source.indexOf('/full/') > -1){
                           // Extract IIIF Image API info.json URL directly (avoiding 303 redirect CORS issues)
                           // e.g., https://classense.unibo.it/iiif/2/24771/full/605,800/0/default.jpg
                           // becomes https://classense.unibo.it/iiif/2/24771/info.json
                           var iiifParts = source.split('/iiif/');
                           var baseUrl = iiifParts[0];
                           var pathParts = iiifParts[1].split('/');
                           var version = pathParts[0]; // e.g., "2"
                           var imageId = pathParts[1]; // e.g., "24771"
                           var iiifInfoUrl = baseUrl + '/iiif/' + version + '/' + imageId + '/info.json';
                           if(i < 3) console.log('IIIF detected:', source, '->', iiifInfoUrl);
                           options.tileSources.push(iiifInfoUrl);
                        } else {
                           // Fallback to regular image for non-IIIF sources
                           if(i < 3) console.log('Non-IIIF:', source);
                           options.tileSources.push({type:"image", url: source});
                        }
                     }
                 }
                 options.id = "osd-img";
                 console.log('OpenSeadragon tileSources:', options.tileSources);
                 return options;
            }

            return imageViewer;

        }];
    });

