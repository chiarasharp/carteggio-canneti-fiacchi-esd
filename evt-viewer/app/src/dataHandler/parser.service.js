/**
 * @ngdoc service
 * @module evtviewer.dataHandler
 * @name evtviewer.dataHandler.evtParser
 * @description
 * # evtParser
 * Service containing methods to parse data
 *
 * @requires $q
 * @requires xmlParser
 * @requires evtviewer.core.config
 * @requires evtviewer.dataHandler.parsedData
**/
angular.module('evtviewer.dataHandler')

	.service('evtParser', ['$q', 'xmlParser', 'parsedData', 'config', function ($q, xmlParser, parsedData, config) {
		var parser = {};
		var idx = 0;
		var svgs = config.visCollSvg;

		// TODO: create module provider and add default configuration
		// var defAttributes = ['n', 'n', 'n'];

		var defPageElement = 'pb',
			defLineBreak = '<lb>',
			defLine = '<l>',
			// Added support for bibliographic references (<bibl>) and indirect person
			possibleNamedEntitiesDef = '<placeName>, <geogName>, <persName>, <orgName>, <rs>, <bibl>',
			possibleNamedEntitiesListsDef = '<listPlace>, <listPerson>, <listOrg>, <list>, <listBibl>',
			defImageList = 'image';

		var viscollDefs = {
			leaf: 'leaf',
			leafMode: 'mode',
			folioNumber: 'folioNumber',
			quire: 'quire',
			quireInfo: 'q',
			imageList: 'image',
			svgElements: 'g'
		};

		var projectInfoDefs = {
			sectionHeaders: '<sourceDesc>, ',
			sectionSubHeaders: '',
			blockLabels: '',
			inlineLabels: '<authority>, <settlement>, <publisher>, <pubPlace>, <availability>, <author>, <editor>, <idno>, <date>, <repository>, <msName>, <textLang>',
			changeDef: '<change>',
			changeWhenDef: '[when]',
			changeByDef: '[who]'
		};


		var frontDef      = '<front>',
			biblDef       = '<biblStruct>',
			titleStmt     = '<titleStmt>',
			respStmt     = '<respStmt>',
			resp = '<resp>',
			persName = '<persName>',
			availability = '<availability>',
			publisher = '<publisher>',
			seriesStmt    = '<seriesStmt>',
			sourceDesc    = '<sourceDesc>',
			correspDesc   = '<correspDesc>',
			languageInfo = '<langUsage>',
			revisionDesc  = '<revisionDesc>';

		projectInfoDefs.sectionSubHeaders += '<projectDesc>, <refsDecl>, <notesStmt>, <seriesStmt>, <publicationStmt>, <respStmt>, <funder>, <sponsor>, <msContents>, <revisionDesc>, ';
		projectInfoDefs.sectionSubHeaders += '<principal>, <langUsage>, <particDesc>, <textClass>, <variantEncoding>, <editorialDecl>, <msIdentifier>, <physDesc>, <history>, <extent>, <editionStmt>';
		projectInfoDefs.blockLabels += '<edition>, <correction>, <hyphenation>, <interpretation>, <normalization>, <punctuation>, <interpGrp>';
		projectInfoDefs.blockLabels += '<quotation>, <segmentation>, <stdVals>, <colophon>, <handDesc>, <decoDesc>, <supportDesc>, <origin>';
		parser.parserProperties = {};

		// ///////// //
		// UTILITIES //
		// ///////// //
		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#isNestedInElem
		 * @methodOf evtviewer.dataHandler.evtParser
		 *
		 * @description
		 * This method will check if an element is nested into another particular element.
		 *
		 * @param {element} element XML element to be checked
		 * @param {string} parentTagName tagName of the element that does not be a parent of @element
		 *
		 * @returns {boolean} whether the element is nested in the given other element or not
		 *
		 * @author CDP
		 */
		parser.isNestedInElem = function (element, parentTagName) {
			if (element.parentNode !== null) {
				if (element.parentNode.tagName === 'text') {
					return false;
				} else if (element.parentNode.tagName === parentTagName) {
					return true;
				} else {
					return parser.isNestedInElem(element.parentNode, parentTagName);
				}
			} else {
				return false;
			}
		};

		parser.capitalize = function (str, all) {
			var reg = (all) ? /([^\W_]+[^\s-]*) */g : /([^\W_]+[^\s-]*)/;
			return (!!str) ? str.replace(reg, function (txt) {
				return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
			}) : '';
		};

		parser.camelToSpace = function (str) {
			return (!!str) ? str.replace(/\W+/g, ' ').replace(/([a-z\d])([A-Z])/g, '$1 $2') : '';
		};

		parser.camelToUnderscore = function (str) {
			return (!!str) ? str.replace(/\W+/g, ' ').replace(/([a-z\d])([A-Z])/g, '$1_$2') : '';
		};

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#isInMainVersion
		 * @methodOf evtviewer.dataHandler.evtParser
		 *
		 * @description
		 * This method will check if an element belongs to the main version of the text.
		 *
		 * @param {element} element XML element to be checked
		 *
		 * @returns {boolean} whether the element belongs to the main version of the text or not
		 *
		 * @author CM
		 */
		parser.isInMainVersion = function (element) {
			if (element.parentNode !== null) {
				if (element.parentNode.tagName === 'text') {
					return true;
				} else if (element.parentNode.tagName === 'rdgGrp') {
					if (config.versions && config.versions.length > 0) {
						if (element.parentNode.hasAttribute('ana')) {
							if (element.parentNode.getAttribute('ana').replace(/#/, '') === config.versions[0]) {
								return true;
							} else {
								return false;
							}
						} else {
							return false;
						}
					} else {
						return true;
					}
				} else {
					return parser.isInMainVersion(element.parentNode);
				}
			}
		};

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#parseXMLElement
		 * @methodOf evtviewer.dataHandler.evtParser
		 *
		 * @description
		 * This method will a generic XML element in a quite generic way
		 * - It will transform a generic XML element into an <code>span</code> element
		 *  - with a data-* attribute for each @attribute of the XML element
		 *  - and a class name that is equal to the tag name of the original XML element
		 * - It will also transform its children
		 * - It will treat in a particular way notes, dates, named entities reference and line breaks.
		 * - When transforming a text node, every <code>__SPACE__</code> string will be converted back to single spaces.
		 * (They were transformed in <code>__SPACE__</code> because when parsing XML single spaces between two elements are deleted).
		 *
		 * @param {element} doc XML element of global document to be parsed
		 * @param {element} element XML element to be parsed
		 * @param {Object} options object indicating some specifig options,
		 * e.g. skip (which elements to skip from being transformed),
		 * exclude (which elements to exclude from final result),
		 * context (in which context the parser was called).
		 * This parameter is ready to be used for further options needed when expanding the generic parser.
		 *
		 * @returns {element} XHTML element with the same data as the XML element read.
		 *
		 * @author CDP
		 */
		parser.parseXMLElement = function (doc, element, options) {

			var newElement;
			var skip = options.skip || '',
				exclude = options.exclude || undefined;

			var skipped = false;


			if (element.nodeType === 3) { // check if it's a text node
				newElement = element;

				if (newElement.textContent) {
					newElement.textContent = newElement.textContent.replace('__SPACE__', ' ');
				}
				// newElement = document.createElement('span');
				// newElement.className = "textNode";
				// newElement.appendChild(element);
			} else if (
				// check if it needs to be skipped
				element.tagName !== undefined &&
				(
					skip.toLowerCase().indexOf('<' + element.tagName.toLowerCase() + '>') >= 0
					|| element.className.indexOf('depaAnchor') >= 0
					|| element.className.indexOf('depaContent') >= 0)
				) {
				newElement = element;
				skipped = true;
			} else if (
				// check if it needs to be excluded
				element.tagName !== undefined && 
				exclude !== undefined && 
				exclude.toLowerCase().indexOf('<' + element.tagName.toLowerCase() + '>') >= 0
			) {
				newElement = document.createTextNode('');
			} else {
				// standardize tag name to lower case
				var tagName = element.tagName !== undefined ? element.tagName.toLowerCase() : '';

				// check for elements with copyOf attributes
				if (
					element.attributes !== undefined &&
					element.attributes.copyOf !== undefined &&
					element.attributes.copyOf.value !== ''
				) {
					newElement = document.createElement('span');
					newElement.className = element.tagName + ' copy';

					// extract id from copyOf attribute
					var copyOfId = element.attributes.copyOf.value.replace('#', '');
					var match = '<' + element.tagName + ' xml:id="' + copyOfId + '.*<\/' + element.tagName + '>';
					
					// find the element it refers to
					var sRegExInput = new RegExp(match, 'ig');
					var copiedElementText = doc.outerHTML.match(sRegExInput);
					
					// if found, parse the element
					if (copiedElementText) {
						var copiedElement = angular.element(copiedElementText[0])[0];

						newElement.appendChild(parser.parseXMLElement(doc, copiedElement, options));
					}
				} else {

					// parsing line elements
					if (!parsedData.getEncodingDetail('usesLineBreaks') && tagName === 'l') {
						newElement = parser.parseLine(doc, element, options);
					
					// parsing note elements
					} else if (tagName === 'note' && skip.indexOf('<evtNote>') < 0) {
						newElement = parser.parseNote(element);
					
					// parsing date elements
					} else if (tagName === 'date' && (!element.childNodes || element.childNodes.length <= 0)) { //TEMP => TODO: create new directive
						//newElement = parser.parseDateElement(element);
						newElement = document.createElement('span');
						newElement.className = element.tagName ? element.tagName.toLowerCase() : '';;
						var textContent = '';
						for (var i = 0; i < element.attributes.length; i++) {
							var attrib = element.attributes[i];
							if (attrib.specified) {
								if (attrib.name !== 'xml:id') {
									var date = new Date(attrib.value);
									var formattedDate = date && !isNaN(date) ? date.toLocaleDateString() : attrib.value;
									textContent += parser.camelToSpace(attrib.name.replace(':', '-')).toLowerCase() + ': ' + formattedDate + ', ';
								}
							}
						}
						newElement.textContent = textContent.slice(0, -1);

					} else if ( // process named entities if enabled in config
						config.namedEntitiesSelector &&
						possibleNamedEntitiesDef.toLowerCase().indexOf('<' + tagName + '>') >= 0 &&
						element.getAttribute('ref') !== undefined
					) { //TODO: Rivedere
						/* if(tagName === 'bibl') {
							tagName = tagName;
						} */
						newElement = parser.parseNamedEntity(doc, element, skip);
					} else {

						if (element.tagName === 'div') {
							newElement = document.createElement('div');
						} else {
							newElement = document.createElement('span');
						}

						newElement.className = element.tagName !== undefined ? element.tagName.toLowerCase() : '';

						if (element.attributes) {
							for (var k = 0; k < element.attributes.length; k++) {
								var attribK = element.attributes[k];
								if (attribK.specified) {
									if (attribK.name !== 'xml:id') {
										newElement.setAttribute('data-' + attribK.name.replace(':', '-'), attribK.value);
									}
								}
							}
						}

						if (element.tagName === 'div') {
							var divId;
							if (element.attributes && element.getAttribute('xml:id')) {
								divId = element.getAttribute('xml:id');
							} else {
								divId = parser.xpath(element).substr(1);
							}
							newElement.setAttribute('id', divId);
						}

						if (element.childNodes) {
							for (var j = 0; j < element.childNodes.length; j++) {
								var childElement = element.childNodes[j].cloneNode(true);
								newElement.appendChild(parser.parseXMLElement(doc, childElement, options));
							}
						} else {
							newElement.innerHTML = element.innerHTML + ' ';
						}

						// handle project info-specific labeling
						if (options.context && options.context === 'projectInfo') {
							if (newElement.innerHTML.replace(/\s/g, '') !== '') {
								var labelElement = document.createElement('span'),
									addLabel = false;

								labelElement.className = 'label-' + element.tagName;
								labelElement.innerHTML = '{{ \'PROJECT_INFO.' + parser.camelToUnderscore(element.tagName).toUpperCase() + '\' | translate }}';

								// determine label type (header, subheader, etc.) for styling
								if (projectInfoDefs.sectionHeaders.toLowerCase().indexOf('<' + tagName + '>') >= 0) {
									labelElement.className += ' projectInfo-sectionHeader';
									addLabel = true;
								} else if (projectInfoDefs.sectionSubHeaders.toLowerCase().indexOf('<' + tagName + '>') >= 0) {
									labelElement.className += ' projectInfo-sectionSubHeader';
									addLabel = true;
								} else if (projectInfoDefs.blockLabels.toLowerCase().indexOf('<' + tagName + '>') >= 0) {
									labelElement.className += ' projectInfo-blockLabel';
									addLabel = true;
								} else if (projectInfoDefs.inlineLabels.toLowerCase().indexOf('<' + tagName + '>') >= 0) {
									labelElement.className += ' projectInfo-inlineLabel';
									labelElement.innerHTML += ': ';
									addLabel = true;
								}

								if (projectInfoDefs.changeDef.toLowerCase().indexOf('<' + tagName + '>') >= 0) {
									var changeText = '';
									var changeWhen = element.getAttribute(projectInfoDefs.changeWhenDef.replace(/[\[\]]/g, ''));
									if (changeWhen) {
										changeText += changeWhen + ' ';
									}
									var changeBy = element.getAttribute(projectInfoDefs.changeByDef.replace(/[\[\]]/g, ''));
									if (changeBy) {
										changeText += '[' + changeBy + ']';
									}
									if (changeText !== '') {
										newElement.innerHTML = changeText + ' - ' + newElement.innerHTML;
									}
								}

								if (addLabel) {
									newElement.insertBefore(labelElement, newElement.childNodes[0]);
								}
							}
						}

						if (tagName === 'lb') {
							newElement.id = element.getAttribute('xml:id');
							newElement.appendChild(document.createElement('br'));
							var lineN = document.createElement('span');
							lineN.className = 'lineN';
							var lineNum = element.getAttribute('n');
							lineN.textContent = lineNum;
							if (lineNum) {
								newElement.appendChild(lineN);
							}
						}
					}
				}
			}

			if (skipped || element.nodeType === 3 || (newElement.innerHTML && newElement.innerHTML.replace(/\s/g, '') !== '')
				|| (newElement.className && (newElement.className.indexOf('depaAnchor') >= 0 || newElement.className.indexOf('depaContent') >= 0))) {
				return newElement;
			} else {
				return document.createTextNode('');
			}
		};

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#parseElementAttributes
		 * @methodOf evtviewer.dataHandler.evtParser
		 *
		 * @description
		 * This method will parse all the attributes (and their values) of a given element into a structured JSON object
		 *
		 * @param {element} element XML element to be parsed
		 *
		 * @returns {Object} JSON object representing the attributes parsed, structured as follows:
			  <pre>
				var attributes = {
					attriName1: 'attrib value 1',
					attriName2: 'attrib value 2',
					_indexes: ['attribName1', 'attribName2']
				}
			  </pre>
		 *
		 * @author CDP
		 */
		parser.parseElementAttributes = function (element) {
			var attributes = {
				_indexes: []
			};
			if (element && element.attributes) {
				for (var i = 0; i < element.attributes.length; i++) {
					var attrib = element.attributes[i];
					if (attrib.specified) {
						var attribName = attrib.name.replace(':', '-');
						attributes[attribName] = attrib.value;
						attributes._indexes.push(attribName);
					}
				}
			}
			return attributes;
		};

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#parseElementAttributes
		 * @methodOf evtviewer.dataHandler.evtParser
		 *
		 * @description
		 * This method will parse external files and add them to {@link evtviewer.dataHandler.parsedData parsedData}.
		 *
		 * @param {element} doc XML element to be parsed
		 * @param {string} type type of external resources being parsed
		 *
		 * @author CM
		 */
		parser.parseExternalDocuments = function (doc, type) {
			var newExtDoc = {
				value: type,
				content: doc
			};
			if (type !== 'analogues' && type !== 'sources') {
				parsedData.addSourceDocument(newExtDoc, type);
			} else {
				parsedData.addExternalDocument(newExtDoc, type);
			}
			console.log('## Source Documents ##', parsedData.getSourceDocuments());
			console.log('## External Documents ##', parsedData.getExternalDocuments());
		};

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#createRegExpr
		 * @methodOf evtviewer.dataHandler.evtParser
		 *
		 * @description
		 * This method will take a string, used in the config file to define a critical elements,
		 * and returns a string that will be used to search the XML elements.
		 * - It checks if there is an attribute, introduced by a '['
		 *  - If there isn't a square bracket, it adds the element name in the match string
		 * - Otherwise it saves the name of the element marked by the '<' and the '['
		 * - Adds regular expression operators to the match string
		 * - Looks for the closing square bracket and for the equals sign
		 * - Adds the name of the attribute , the regular expression operators and and the value of the attribute
		 *
		 * @param {string} def string of the element definition, contained in config file.
		 * It may contain more than one definition separated by commas
		 *
		 * @returns {RegExp} the regular expression created
		 *
		 * @author CM
		 */
		parser.createRegExpr = function (def) {
			var match = '(',
				//Save all the definition contained in def in aDef array
				aDef = def.split(',');

			for (var i = 0; i < aDef.length; i++) {
				//Checks if there is an attribute, introduced by a '['
				if (aDef[i].indexOf('[') < 0) {
					//If there isn't a square bracket, it adds the element name in the match string
					match += aDef[i].replace(/[>]/g, '');
				} else {
					//Otherwise it saves the name of the element marked by the '<' and the '['
					var bracketOpen = aDef[i].indexOf('[');
					if (aDef[i].substring(1, bracketOpen) !== '[') {
						match += aDef[i].substring(0, bracketOpen);
					}
					//Adds regular expression operators to the match string
					match += '[^<>]*?';
					//Looks for the closing square bracket
					var bracketClose = aDef[i].indexOf(']');
					//...and for the equals sign
					var equal = aDef[i].indexOf('=');
					//Adds the name of the attribute...
					match += aDef[i].substring(bracketOpen + 1, equal);
					//...reg expr operators
					match += '\\s*?=\\s*?[\'\"]\\s*?';
					//...and the value of the attribute
					match += aDef[i].substring(equal + 1, bracketClose);
				}
				if (i < aDef.length - 1) {
					//Adds operator or to add a new definition contained in aDef
					match += '|';
				} else if (i === aDef.length - 1) {
					//Closes the regular expression
					match += ')';
				}
			}

			var sRegExpInput = new RegExp(match, 'i');

			return sRegExpInput;
		};

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#parseDateElement
		 * @methodOf evtviewer.dataHandler.evtParser
		 * @description
		 * Parses TEI date elements with support for multiple date formats and attributes.
		 * Handles from/to ranges and single dates with proper formatting and i18n support.
		 *
		 * @param {Element} element - The date element to parse
		 * @returns {Element} A DOM element containing the formatted date
		 */
		parser.parseDateElement = function (element) {
			const dateElement = document.createElement('span');
    		dateElement.className = 'date';

			// prepare text content from attributes values
			let textContent = '';
			let fromDate = element.getAttribute('from') || element.getAttribute('from-iso');
    		let toDate = element.getAttribute('to') || element.getAttribute('to-iso');
    		let whenDate = element.getAttribute('when') || element.getAttribute('when-iso');

			if (fromDate && toDate) {
				const formattedFromDate = formatDate(fromDate);
				const formattedToDate = formatDate(toDate);
				textContent = `{{ 'PROJECT_INFO.FROM_DATE' | translate }} ${formattedFromDate} {{ 'PROJECT_INFO.TO_DATE' | translate }} ${formattedToDate}`;
			} 
			else if (fromDate) {
				textContent = `{{ 'PROJECT_INFO.FROM_DATE' | translate }} ${formatDate(fromDate)}`;
			} 
			else if (toDate) {
				textContent = `{{ 'PROJECT_INFO.TO_DATE' | translate }} ${formatDate(toDate)}`;
			} 
			else if (whenDate) {
				textContent = formatDate(whenDate);
			}
		
			// If no date attribute is available, display 'NO_DATE' message
			if (!textContent) {
				textContent = `{{ 'PROJECT_INFO.NO_DATE' | translate }}`;
			}
		
			dateElement.textContent = textContent;
		
			return dateElement;
		}

		/**
		 * Utility: Formats a date string as a locale date or returns the original string if invalid.
		 */
		function formatDate(date) {
			const dateObj = new Date(date);

			if (!isNaN(dateObj)) {
				return dateObj.toLocaleDateString();
			}

			return date;
		}

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#createLabeledBlock
		 * @methodOf evtviewer.dataHandler.evtParser
		 * @description
		 * Creates a standardized labeled block for metadata display.
		 * Supports optional linking of content and consistent styling.
		 *
		 * @param {string} label - Translation key for the label
		 * @param {string|Element} value - Content to display
		 * @param {string} [link] - Optional URL for linked content
		 * @returns {Element} A DOM element with the labeled content
		 */
		function createLabeledBlock(label, value, link) {
			const blockLabel = document.createElement('span');
			blockLabel.className = 'projectInfo-blockLabel';
	
			const inlineLabel = document.createElement('span');
			inlineLabel.className = 'projectInfo-inlineLabel';
			inlineLabel.innerHTML = `{{ '${label}' | translate }}: `;
	
			blockLabel.appendChild(inlineLabel);

			if (link && typeof value === 'string') {
				const linkElement = document.createElement('a');
				linkElement.href = link;
				linkElement.target = '_blank';
				linkElement.textContent = value;
				blockLabel.appendChild(linkElement);
			} else if (typeof value === 'string') {
				blockLabel.appendChild(document.createTextNode(value));
			} else if (value instanceof Node) {
				blockLabel.appendChild(value);
			}

			return blockLabel;
		};

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#createAbbreviation
		 * @methodOf evtviewer.dataHandler.evtParser
		 *
		 * @description
		 * This method will take a string and transforms it into an abbreviated <code>textNode</code> contained in a <code>span</code> element.
		 *
		 * @param {string} string string to abbreviate
		 * @param {number} maxLength maximum length of the string to show
		 *
		 * @returns {string} the abbreviated string
		 *
		 * @author CM
		 */
		parser.createAbbreviation = function (string, maxLength) {
			var length = maxLength / 2,
				stringBegin = string.substring(0, length),
				stringEnd = string.substring((string.length - length - 1), (string.length - 1)),
				wslastIndexBegin = stringBegin.lastIndexOf('', (stringBegin.length - 1)),
				wsfirstIndexEnd = stringEnd.indexOf('', 1),
				begin = stringBegin.substring(0, wslastIndexBegin),
				blurredBegin = stringBegin.substring(wslastIndexBegin, stringBegin.length),
				end = stringEnd.substring(wsfirstIndexEnd, stringEnd.length),
				blurredEnd = stringEnd.substring(0, wsfirstIndexEnd);
			var result = '<span class="textNode">' + begin + '<span class="blurredText">' + blurredBegin + '</span> [...] <span class="blurredText">' + blurredEnd + '</span>' + end + '</span>';
			return result;
		};
		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#balanceXHTML
		 * @methodOf evtviewer.dataHandler.evtParser
		 *
		 * @description
		 * This method will an excerpted or truncated XHTML string and returns a well-balanced XHTML string
		 * - It checks for broken tags, e.g. <code>&lt;stro</code> [a <code>&lt;</code> after the last <code>&gt;</code> indicates a broken tag]
		 *  - It eventually truncates broken tags
		 * - It checks for broken elements, e.g. <code>&lt;strong&gt;Hello, w</code>
		 *  - It gets an array of all tags (start, end, and self-closing)
		 *  - It prepares an empty array where to store broken tags (<code>stack</code>)
		 *  - It loops over all tags
		 *    - when it founds an end tag, it pops it off of the stack
		 *    - when it founds a start tag, it push it onto the stack
		 *    - then it founds a self-closing tag, it do nothing
		 *  - At the end of the loop, <code>stack</code> should contain only the start tags of the broken elements, most deeply-nested at the top
		 *  - It loops over stack array
		 *    - pops the unmatched tag off the stack
		 *    - gets just the tag name
		 *    - and appends the end tag
		 *
		 * @param {string} XHTMLstring string to balanced
		 *
		 * @returns {string} well-balanced XHTML string
		 *
		 * @author CDP
		 */
		parser.balanceXHTML = function (XHTMLstring) {
			// Check for broken tags, e.g. <stro
			// Check for a < after the last >, indicating a broken tag
			if (XHTMLstring) {
				if (XHTMLstring.lastIndexOf('<') > XHTMLstring.lastIndexOf('>')) {
					// Truncate broken tag
					XHTMLstring = XHTMLstring.substring(0, XHTMLstring.lastIndexOf('<'));
				}

				// Check for broken elements, e.g. <strong>Hello, w
				// Get an array of all tags (start, end, and self-closing)
				var tags = XHTMLstring.match(/<(?!\!)[^>]+>/g);
				var stack = [];
				var tagToOpen = [];
				for (var tag in tags) {
					if (tags[tag].search('/') === 1) { // </tagName>
						// end tag -- pop off of the stack
						// se l'ultimo elemento di stack è il corrispettivo tag di apertura
						var tagName = tags[tag].replace(/[<\/>]/ig, '');
						var openTag = stack[stack.length - 1];
						if (openTag && (openTag.search('<' + tagName + ' ') >= 0 || openTag.search('<' + tagName + '>') >= 0)) {
							stack.pop();
						} else { //Tag non aperto
							tagToOpen.push(tagName);
						}
					} else if (tags[tag].search('/>') <= 0) { // <tagName>
						// start tag -- push onto the stack
						stack.push(tags[tag]);
					} else { // <tagName />
						// self-closing tag -- do nothing
					}
				}

				// stack should now contain only the start tags of the broken elements, most deeply-nested at the top
				while (stack.length > 0) {
					// pop the unmatched tag off the stack
					var endTag = stack.pop();
					// get just the tag name
					endTag = endTag.substring(1, endTag.search(/[ >]/));
					// append the end tag
					XHTMLstring += '</' + endTag + '>';
				}

				while (tagToOpen.length > 0) {
					var startTag = tagToOpen.shift();
					XHTMLstring = '<' + startTag + '>' + XHTMLstring;
				}
			}

			// Return the well-balanced XHTML string
			return (XHTMLstring ? XHTMLstring : '');
		};
		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#analyzeEncoding
		 * @methodOf evtviewer.dataHandler.evtParser
		 *
		 * @description
		 * This method will analyze the encoding and save the encoding details in
		 * {@link evtviewer.dataHandler.parsedData parsedData}.
		 * Details handled are:
		 * - whether the edition uses line breaks of not
		 * - whether the edition has line numbers encoded or not
		 *
		 * @param {string} XHTMLstring string to balanced
		 *
		 * @author CDP
		 */
		parser.analyzeEncoding = function (doc) {
			// Check if uses line breaks to divide lines
			var currentDocument = angular.element(doc);
			var lineBreaks = currentDocument.find('body ' + defLineBreak.replace(/[<>]/g, ''));
			parsedData.setEncodingDetail('usesLineBreaks', lineBreaks.length > 0);

			var lineNums = currentDocument.find(defLine.replace(/[<>]/g, '') + '[n]');
			parsedData.setEncodingDetail('lineNums', lineNums.length > 0);
		};
		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#parseNote
		 * @methodOf evtviewer.dataHandler.evtParser
		 *
		 * @description
		 * This method will parse an XML element representing a note (<code>note</code> in XMLT-TEI P5)
		 * and transform it into an <code>evt-popover</code> element.
		 *
		 * @param {element} noteNode element to be parsed
		 *
		 * @returns {element} <code>evt-popover</code> generated
		 *
		 * @author CDP
		 */
		parser.parseNote = function (noteNode) {
			var popoverElem = document.createElement('evt-popover');
			var popoverN = noteNode.getAttribute('n') ? noteNode.getAttribute('n') : '';
			var popoverType = noteNode.getAttribute('type') || 'generic';
			popoverElem.setAttribute('data-trigger', 'click');
			popoverElem.setAttribute('data-tooltip', noteNode.innerHTML);
			popoverElem.setAttribute('data-n', popoverN);
			popoverElem.setAttribute("data-type", popoverType);
			popoverElem.innerHTML = '<i class="evt_note">' +
				'<span class="' + popoverType + '">' + popoverN + '</span>' + '</i>';

			return popoverElem;
		}
		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#parseNamedEntity
		 * @methodOf evtviewer.dataHandler.evtParser
		 * @description
		 * This method will parse an XML element representing a named entity
         * and transform it into an <code>evt-named-entity-ref</code> element.
		 * Changed: Enhanced support for bibliographic references and indirect references to people.
		 *
		 * @param {element} doc XML element to be parsed
		 * @param {element} entityNode node to be transformed
		 * @param {string} skip names of sub elements to skip from transformation
		 *
		 * @returns {element} <code>evt-named-entity-ref</code> generated
		 *
		 * @author CDP
		 */
		parser.parseNamedEntity = function (doc, entityNode, skip) {
			var entityElem = document.createElement('evt-named-entity-ref'),
				entityRef = entityNode.getAttribute('ref'),
				entityType = entityNode.getAttribute('type'),
				entityId = entityRef ? entityRef.replace('#', '') : undefined
				listType = null;

			if (entityId && entityId !== '') {
				entityElem.setAttribute('data-entity-id', entityId);
			}
			if(entityType != null && entityType != "religious" && entityType != "person") { 
				entityElem.setAttribute('bibl-type', entityType);
				listType = entityType;
			}
			else {
				listType = entityNode.tagName ? entityNode.tagName : 'generic';
			}
			
			entityElem.setAttribute('data-entity-type', listType);

			var entityContent = '';
			for (var i = 0; i < entityNode.childNodes.length; i++) {
				var childElement = entityNode.childNodes[i].cloneNode(true),
					parsedXmlElem;

				parsedXmlElem = parser.parseXMLElement(doc, childElement, {
					skip: skip
				});
				entityElem.appendChild(parsedXmlElem);
			}
			return entityElem;
		};

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#parseLines
		 * @methodOf evtviewer.dataHandler.evtParser
		 *
		 * @description
		 * This method will parse all line elements inside an XML document.
		 *
		 * @param {element} docDOM XML document to be parsed
		 *
		 * @author CDP
		 */
		parser.parseLines = function (docDOM) {
			var lines = docDOM.getElementsByTagName('l');
			var n = 0;
			while (n < lines.length) {
				var lineNode = lines[n],
					newElement = parser.parseLine(docDOM, lineNode, {});
				lineNode.parentNode.replaceChild(newElement, lineNode);
			}
		};
		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#parseLine
		 * @methodOf evtviewer.dataHandler.evtParser
		 *
		 * @description
		 * This method will parse an XML element representing a line
		 * and transform it in a <code>div</code> element with specific data-* attributes
		 * indicating some specific properties of the line and line number.
		 *
		 * @param {element} lineNode XML element to be parsed
		 *
		 * @returns {element} <code>div</code> representing the parsed line
		 *
		 * @author CDP
		 */
		parser.parseLine = function (doc, lineNode, options) {
			var newElement = document.createElement('div');
			newElement.className = lineNode.tagName + ' l-block';
			for (var i = 0; i < lineNode.attributes.length; i++) {
				var attrib = lineNode.attributes[i];
				if (attrib.specified) {
					newElement.setAttribute('data-' + attrib.name.replace(':', '-'), attrib.value);
				}
			}
			newElement.innerHTML = lineNode.innerHTML;
			var lineNum = lineNode.getAttribute('n');
			if (lineNum && lineNum !== '') {
				var lineNumElem = document.createElement('span');
				lineNumElem.className = 'lineN';
				lineNumElem.textContent = lineNum;
				newElement.className += ' l-hasLineN';

				var parsedElement = parser.parseXMLElement(doc, newElement, options);
				newElement.innerHTML = lineNumElem.outerHTML + '<span class="lineContent">' + parsedElement.outerHTML + '</span>';
				//newElement.insertBefore(lineNumElem, newElement.childNodes[0]);
			} else if (parsedData.getEncodingDetail('lineNums')) {
				newElement.className += ' l-indent';
				var parsedElement = parser.parseXMLElement(doc, newElement, options);
				newElement.innerHTML = '<span class="lineContent">' + parsedElement.outerHTML + '</span>';
			}

			return newElement;
		};
		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#parseGlyphs
		 * @methodOf evtviewer.dataHandler.evtParser
		 *
		 * @description
		 * This method will parse an XML element representing a glyph and its mappings
		 * and save it in {@link evtviewer.dataHandler.parsedData parsedData} for future retrievements.
		 *
		 * @param {string} doc string representing the XML document to be parsed
		 *
		 * @author CDP
		 */
		parser.parseGlyphs = function (doc) {
			var currentDocument = angular.element(doc);
			angular.forEach(currentDocument.find('glyph, char'),
				function (element) {
					var glyph = {};
					glyph.id = element.getAttribute('xml:id') || '';
					glyph.xmlCode = element.outerHTML;
					glyph.mapping = {};
					angular.forEach(angular.element(element).find('mapping'),
						function (mapping) {
							var sType = mapping.getAttribute('type');
							glyph.mapping[sType] = {
								element: mapping.outerHTML,
								content: mapping.innerHTML,
								attributes: []
							};
							for (var i = 0; i < mapping.attributes.length; i++) {
								var attrib = mapping.attributes[i];
								if (attrib.specified) {
									glyph.mapping[sType].attributes.push({
										name: attrib.name.replace(':', '-'),
										value: attrib.value
									});
								}
							}
						});
					var parsedXmlElem = parser.parseXMLElement(doc, element, {
						skip: ''
					});
					glyph.parsedXml = parsedXmlElem ? parsedXmlElem.outerHTML : '';
					//TODO: decide how to structure content
					parsedData.addGlyph(glyph);
				});
			console.log('# GLYPHS #', parsedData.getGlyphs());
		};
		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#xpath
		 * @methodOf evtviewer.dataHandler.evtParser
		 *
		 * @description
		 * This method will generate a string representing the xpath of the given element.
		 * This string can be use as a unique identifier, since every element as a different xpath.
		 *
		 * @param {element} el XML element to analyze
		 *
		 * @returns {string} calculated xpath of the given element
		 *
		 * @author CDP
		 */
		parser.xpath = function (el) {
			try {
				if (typeof el === 'string') {
					// document.evaluate(xpathExpression, contextNode, namespaceResolver, resultType, result );
					return document.evaluate(el, document, null, 0, null);
				}
				if (!el || el.nodeType !== 1) {
					return '';
				}
				var sames = [];
				if (el.parentNode) {
					sames = [].filter.call(el.parentNode.children, function (x) {
						return x.tagName === el.tagName;
					});
				}
				var countIndex = sames.length > 1 ? ([].indexOf.call(sames, el) + 1) : '';
				countIndex = countIndex > 1 ? countIndex - 1 : '';
				var tagName = el.tagName.toLowerCase() !== 'tei' ? '-' + el.tagName.toLowerCase() : '';
				return parser.xpath(el.parentNode) + tagName + countIndex;
			} catch (e) {
				idx++;
				return '-id' + idx;
			}
		};
		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#parsePages
		 * @methodOf evtviewer.dataHandler.evtParser
		 *
		 * @description
		 * This method will parse the pages of a given edition document in a given XML document
		 * and store them in {@link evtviewer.dataHandler.parsedData parsedData} for future retrievements.
		 *
		 * @param {string} doc string representing the XML element to parse
		 * @param {string} docId id of the document to analyze and to whom add parsed pages
		 *
		 * @author CDP
		 */
		parser.parsePages = function (doc, docId) {
			var currentDocument = angular.element(doc);
			angular.forEach(currentDocument.find(defPageElement),
				function (element) {
					var newPage = {};
					if (element.getAttribute('ed')) {
						newPage.value = element.getAttribute('xml:id') || element.getAttribute('ed').replace('#', '') + '-' + element.getAttribute('n') || 'page_' + (parsedData.getPages().length + 1);
					} else {
						newPage.value = element.getAttribute('xml:id') || 'page_' + (parsedData.getPages().length + 1);
					}
					newPage.image = element.getAttribute('facs') || config.singleImagesUrl + newPage.value + '.jpg';
					newPage.svgId = element.getAttribute('svg:id') || (parsedData.getPages().length + 1);
					newPage.label = element.getAttribute('n') || 'Page ' + (parsedData.getPages().length + 1);
					newPage.title = element.getAttribute('n') || 'Page ' + (parsedData.getPages().length + 1);
					for (var i = 0; i < element.attributes.length; i++) {
						var attrib = element.attributes[i];
						if (attrib.specified) {
							newPage[attrib.name.replace(':', '-')] = attrib.value;
						}
					}
					/* // Get image source URL
					if (element.getAttribute('facs')) { */
					newPage.source = element.getAttribute('facs');
					/* } else {
						// TODO: handle other cases (e.g. <surface>)
						// handle image source from singleImagesUrl
						newPage.source = config.singleImagesUrl + newPage.value + '.jpg';
					} */
					parsedData.addPage(newPage, docId);
				});
			//console.log('## Pages ##', parsedData.getPages());
		};
		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#parseSvgsForViscoll
		 * @methodOf evtviewer.dataHandler.evtParser
		 *
		 * @description
		 * This method will parse the svgs of the resource
		 * and store them in {@link evtviewer.dataHandler.parsedData parsedData} for future retrievements.
		 *
		 * @param {string} doc string representing the XML element to parse
		 * @param {string} docId id of the document to analyze and to whom add parsed pages
		 *
		 * @author FD
		 */
		parser.parseSvgsForViscoll = function (svgDoc, svgId) {
			var currentDocument = angular.element(svgDoc);
			var xmlSvg = svgDoc.lastChild;
			var xmlTitle = '';
			try {
				// soluzione non bellissima, ma finché non abbiamo altri attributi
				// nell'svg di Viscoll non possiamo fare altrimenti
				xmlTitle = xmlSvg.firstElementChild.innerHTML.match(/quire\s\d*\sfor/)[0].match(/\d+/)[0];
			} catch (e) { }
			var newSvg = {
				id: svgId,
				quireN: xmlTitle,
				// id di g recuperare la prima cifra con getAttribute sull'ID
				svgLeaves: [], //array con tutti i G
				textSvg: xmlSvg
			};
			// ciclo sui g --> aggiungere a svg leaves gli id hasAttribute
			var svgCollection = parsedData.getViscollSvgs();
			angular.forEach(currentDocument.find(viscollDefs.svgElements),
				function (element) {
					if (element.hasAttribute('id')) {
						var svgLeaf = {
							id: element.id.replace('#', ''),
							value: element.id.replace('#', ''),
							label: element.id.replace('#', '')
						};

						angular.forEach(svgCollection.imglist._indexes, function (imgId) {
							if (svgLeaf.id === imgId.slice(0, -2)) {
								if (svgLeaf.img == undefined) {
									svgLeaf.img = svgCollection.imglist[imgId].url;
									svgLeaf.imgConjoin = svgCollection.imglist[imgId].conjoinUrl;
									svgLeaf.imageId = svgCollection.imglist[imgId].value;
									if (svgCollection.imglist[imgId].conjoinUrl !== undefined) {
										for (var a in svgCollection.imglist) {
											if (svgCollection.imglist[imgId].id === svgCollection.imglist[a].conjoin) {
												svgLeaf.conjoinId = svgCollection.imglist[a].value;
											}
										}
									}
								} else {
									svgLeaf.img2 = svgCollection.imglist[imgId].url;
									svgLeaf.imgConjoin2 = svgCollection.imglist[imgId].conjoinUrl;
									svgLeaf.imageId2 = svgCollection.imglist[imgId].value;
									if (svgCollection.imglist[imgId].conjoinUrl !== undefined) {
										for (var b in svgCollection.imglist) {
											if (svgCollection.imglist[imgId].id == svgCollection.imglist[b].conjoin) {
												svgLeaf.conjoinId2 = svgCollection.imglist[b].value;
											}
										}
									}
								}
							}
						});
						newSvg.svgLeaves.push(svgLeaf);
						parsedData.updateLeafDataInQuire(svgId, svgLeaf);
					}
				});

			parsedData.addViscollSvg(newSvg);
		};

		parser.parseViscollDatamodel = function (doc) {
			var currentDocument = angular.element(doc);
			var shelfmark = angular.element(currentDocument.find('shelfmark'));
			var svgToLoad = [];
			// Handle quires
			angular.forEach(currentDocument.find(viscollDefs.quire),
				function (element) {
					var newQuire = {
						value: element.getAttribute('xml:id') || '',
						n: element.getAttribute('n') || 'quire' + (parsedData.getViscollQuires().length + 1),
						leaves: {
							length: 0,
							_indexes: []
						}
					};
					parsedData.addViscollQuire(newQuire);
					if (shelfmark) {
						svgToLoad.push({
							fileName: 'id-' + shelfmark.text() + '-' + newQuire.n + '.svg',
							id: newQuire.value
						});
					}
				});
			// Handle leafs
			angular.forEach(currentDocument.find(viscollDefs.leaf),
				function (element) {
					var quireElem = angular.element(element).find(viscollDefs.quireInfo);
					quireElem = quireElem ? quireElem[0] : undefined;
					if (quireElem) {
						var leafMode = angular.element(element).find(viscollDefs.leafMode);
						var conjoinElems = quireElem.childNodes;
						var conjoinElem = conjoinElems[1] == undefined ? conjoinElems[0] : conjoinElems[1];
						var newLeaf = {
							value: element.getAttribute('xml:id') || '',
							leafno: quireElem.getAttribute('leafno') || '',
							quire: quireElem.getAttribute('target').replace('#', '') || 'target',
							conjoin: conjoinElem.getAttribute('target').replace('#', '') || 'target',
							mode: leafMode && leafMode[0] ? leafMode[0].getAttribute('val') : ''
						};
						parsedData.addViscollLeaf(newLeaf);
					}
				});
			parsedData.setViscollSVGToLoad(svgToLoad);
			console.log('## parseViscollDatamodel ##', parsedData.getViscollSvgs());
		};

		parser.parseViscollImageList = function (doc) {
			var currentDocument = angular.element(doc);
			var svgCollection = parsedData.getViscollSvgs();
			angular.forEach(currentDocument.find(defImageList),
				function (element) {
					var newImage = {
						value: element.getAttribute('val') || 'val',
						url: element.getAttribute('url') || 'url',
						id: element.getAttribute('id') || 'id'
					};
					var id = newImage.id.slice(0, -2);
					angular.forEach(svgCollection.quires._indexes, function (quireId) {
						var leaves = svgCollection.quires[quireId].leaves;
						angular.forEach(leaves._indexes, function (leafId) {
							var leafObj = leaves[leafId];
							if (id === leafObj.value) {
								newImage.conjoin = leafObj.conjoin;
								if (newImage.id.substr(newImage.id.length - 1) === 'v') {
									newImage.conjoin += '-r';
								} else {
									newImage.conjoin += '-v';
								}
							}
						});
					});
					parsedData.addViscollImageList(newImage);
				});
			angular.forEach(svgCollection.imglist._indexes, function (id1) {
				angular.forEach(svgCollection.imglist._indexes, function (id2) {
					if (id2 === svgCollection.imglist[id1].conjoin) {
						svgCollection.imglist[id1].conjoinUrl = svgCollection.imglist[id2].url;
					}
				});
			});
		};

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#parseDocuments
		 * @methodOf evtviewer.dataHandler.evtParser
		 *
		 * @description
		 * This method parses the documents of a given XML document and stores them in parsedData.
		 * It handles different document structures:
		 * - Text groups with nested text elements
		 * - Single text elements
		 * - Edition text divisions
		 * 
		 * The parser now implements improved handling of:
		 * 1. Nested document structures (text groups)
		 * 2. Document element detection and validation
		 * 3. Prevention of duplicate parsing for nested elements
		 *
		 * @param {string} doc string representing the XML element to parse
		 * @returns {Object} The parsed documents from parsedData.getDocuments()
		 *
		 * @author CDP
		 * @author CM (refactoring)
		 */
		parser.parseDocuments = function (doc) {
			var currentDocument = angular.element(doc),
				defDocElement = null,
				defContentEdition = 'body',
				defTeiHeader = 'teiHeader*';

			// CHANGE: Check for both text group and individual text elements
			// This ensures proper handling of nested document structures
			if (currentDocument.find('text group text').length > 0 && currentDocument.find('text').length > 0) {
				defDocElement = 'text group text' && 'text';
			} else if (currentDocument.find('div[subtype="edition_text"]').length > 0) {
				// Handle edition text divisions differently
				defDocElement = 'div[subtype="edition_text"]';
				defContentEdition = 'div';
			}

			if (!defDocElement) {
				parser.parserProperties['defDocElement'] = defDocElement;
			} else {		
				parser.parserProperties['defDocElement'] = 'text';
			}
			parser.parserProperties['defContentEdition'] = defContentEdition;

			parsedData.setCriticalEditionAvailability(currentDocument.find(config.listDef.replace(/[<>]/g, '')).length > 0);

			// Process each document element, avoiding duplicate parsing of nested structures
			angular.forEach(currentDocument.find(defDocElement),
				function (element) {
					var currEl = angular.element(element);

					// Only parse if element doesn't contain nested groups
					// This prevents duplicate processing of nested document structures
					if(currEl.children('group').length === 0) { 
						parser.parseDocument(element, doc); 
					}
			});

			console.log('## PAGES ##', parsedData.getPages());
			console.log('## Documents ##', parsedData.getDocuments());
			console.log('## DIVS ##', parsedData.getDivs());
			return parsedData.getDocuments();
		};

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#parseDocument
		 * @methodOf evtviewer.dataHandler.evtParser
		 *
		 * @description
		 * This method will parse a portion of the given XML document that can be considered as an individual textual document
		 * and store it in {@link evtviewer.dataHandler.parsedData parsedData} for future retrievements.
		 *
		 * @param {element} element the XML element to parse
		 * @param {string} doc string representing the XML element to parse
		 *
		 * @author CM
		 */
		parser.parseDocument = function (element, doc) {
			var newDoc = {
				value: element.getAttribute('xml:id') || parser.xpath(doc).substr(1) || 'doc_' + (parsedData.getDocuments()._indexes.length + 1),
				label: '',
				title: '',
				content: element,
				front: undefined,
				pages: [], // Pages will be added later
				divs: [],
				teiHeader: {}
			};
			for (var j = 0; j < element.attributes.length; j++) {
				var attrib = element.attributes[j];
				if (attrib.specified) {
					newDoc[attrib.name.replace(':', '-')] = attrib.value;
				}
			}

			if (newDoc['xml-id'] === undefined) {
				parser.createTitle(newDoc, 'Doc');
			}
			else {
				parser.createTitle(newDoc, '');
			}

			parser.parseFront(newDoc, element);

			
			parsedData.addDocument(newDoc);

			parser.parsePages(element, newDoc.value);

			if (parser.parserProperties['defContentEdition'] === 'body') {
				var front = element.querySelector('front'),
					body = element.querySelector('body');
				if (front) {
					parser.parseDivs(front, newDoc.value, 'front');
				}
				parser.parseDivs(body, newDoc.value, 'body');
			} else {
				parser.parseDivs(element, newDoc.value, 'body');
			}

			if (config.defaultEdition !== 'critical' || !parsedData.isCriticalEditionAvailable()) {
				// Split pages works only on diplomatic/interpretative edition
				// In critical edition, text will be splitted into pages for each witness
				config.defaultEdition = 'diplomatic';
				var pages = parsedData.getPages();
				var newDocPages = newDoc.pages;
				angular.forEach(angular.element(element).find(parser.parserProperties['defContentEdition']),
					function (editionElement) {
						//editionElement.innerHTML = parser.splitLineBreaks(element, defContentEdition);
						parser.splitPages(pages, editionElement, newDoc.value, parser.parserProperties['defContentEdition'], newDocPages);
					});
			}
		}

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#parseDivs
		 * @methodOf evtviewer.dataHandler.evtParser
		 *
		 * @description
		 * This method will parse all the divs inside of an individual textual document.
		 *
		 * @param {element} doc the XML element to parse
		 * @param {string} docId the id of the document whose divs are currently getting parsed
		 * @param {string} section tagName of the element where the div is contained (ex.: 'body', 'front' or 'back')
		 *
		 * @author CM
		 */
		parser.parseDivs = function (doc, docId, section) {
			var lang = doc.getAttribute('xml:lang') ? doc.getAttribute('xml:lang') : '';
			var currentDocument = angular.element(doc);
			angular.forEach(currentDocument.children('div'), function (element) {
				parser.parseDiv(element, docId, section, lang);
			});
		};

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#parseDiv
		 * @methodOf evtviewer.dataHandler.evtParser
		 *
		 * @description
		 * This method will parse the info about a single div inside of an individual textual document
		 * and then stores it in parsedData for future use.
		 *
		 * @param {element} element the XML element to parse
		 * @param {string} docId the id of the document whose divs are currently getting parsed
		 * @param {string} section tagName of the element where the div is contained (ex.: 'body', 'front' or 'back')
		 *
		 * @author CM
		 */
		parser.parseDiv = function (element, docId, section) {
			var newDiv = {
				doc: docId,
				section: section,
				subDivs: [],
				title: '',
				_isSubDiv: parser.isNestedInElem(element, 'div')
			};
			angular.forEach(Object.values(element.attributes), function (attr) {
				if (attr.specified) {
					newDiv[attr.name.replace(':', '-')] = attr.value;
				}
			});
			if (newDiv.corresp) {
				newDiv.corresp = newDiv.corresp.replace('#', '').split(' ');
			}
			newDiv.value = newDiv['xml-id'] || parser.xpath(element).substr(1) || 'div_' + (parsedData.getDivs().length + 1);
			parser.createTitle(newDiv, 'Div');
			var elem = angular.element(element);
			angular.forEach(elem.children('div'), function (child) {
				newDiv.subDivs.push(parser.parseDiv(child, docId, section).value);
			});
			parsedData.addDiv(newDiv, docId);
			return newDiv;
		}

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#createTitle
		 * @methodOf evtviewer.dataHandler.evtParser
		 *
		 * @description
		 * This method creates the name for the nuew parsed element object
		 * by using the attributes of the element or a default solution.
		 *
		 * @param {object} parsedElement the JSON object with all the info about the parsed element
		 * @param {string} tag the type of element that was parsed ('doc', 'div')
		 *
		 * @author CM
		 */
		parser.createTitle = function (parsedElement, tag) {
			if (parsedElement.type) {
				parsedElement.title += parsedElement.type.substr(0, 1).toUpperCase() + parsedElement.type.substr(1);
			} else {
				parsedElement.title += tag;
			}
			if (parsedElement.subtype) {
				parsedElement.title += ' - ' + parsedElement.subtype.substr(0, 1).toUpperCase() + parsedElement.subtype.substr(1);
			}
			parsedElement.title += ' ';
			switch (tag) {
				case 'Div': {
					parsedElement.title += parsedElement.n || parsedData.getDivs().length + 1;
				}
					break;
				case 'Doc': {
					var wit,
						corresp = parsedData.getWitnessesList().find(function (witId) {
							wit = witId;
							return parsedData.getWitness(witId).corresp === parsedElement.value;
						});

					if (corresp) {
						parsedElement.title += wit;
					}
					else {
						parsedElement.title += parsedElement.n || parsedData.getDocuments()._indexes.length + 1;
					}
				}
					break;
				default: {
					parsedElement.title = parsedElement.n || parsedElement['xml-id'];
				}
					break;
			}
			parsedElement.label = parsedElement.title;
		}

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#parseFront
		 * @methodOf evtviewer.dataHandler.evtParser
		 * @description
		 * Parses the front matter of a TEI document, extracting metadata about the correspondence.
		 * Coordinates multiple specialized parsers for different sections of the front matter.
		 *
		 * @param {Object} newDoc - The document object being built
		 * @param {Element} element - The XML element containing the front matter
		 * @returns {void} Updates the newDoc object with parsed front matter
		 */
		parser.parseFront = function(newDoc, element) {
			var docFront = element.querySelectorAll(frontDef.replace(/[<\/>]/ig, ''));
			
			// Only parse if <front> element exists
			if (docFront && docFront[0]) {
				var frontElem = docFront[0].cloneNode(true);
				var parsedContent = `
					<div class="document-Info">
						${parser.parseFileDesc(frontElem).outerHTML}
						${parser.parseProfileDesc(frontElem).outerHTML}
						${parser.parseRevisionHistory(frontElem).outerHTML}
					</div>
				`;

				var frontAttributes = parser.parseElementAttributes(frontElem);
				newDoc.front = {
					attributes: frontAttributes,
					parsedContent: parsedContent.trim(),
					originalContent: frontElem.outerHTML
				};
			}
		};

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#parseFileDesc
		 * @methodOf evtviewer.dataHandler.evtParser
		 * @description
		 * Parses the fileDesc element of a TEI document, consolidating title, series, and source information.
		 * Now returns a DOM element instead of HTML string for better manipulation and consistency.
		 * Coordinates multiple specialized parsers for different sections of the file description.
		 *
		 * @param {Element} front - The front matter element containing the file description
		 * @returns {Element} DOM element containing the structured file description
		 */
		parser.parseFileDesc = function(front) {

			const fileDescDiv = document.createElement('div');
			fileDescDiv.className = 'fileDesc';

			fileDescDiv.appendChild(parser.parseTitleStatement(front));

			fileDescDiv.appendChild(parser.parsePublStatement(front));

            fileDescDiv.appendChild(parser.parseSeriesStatement(front));

            fileDescDiv.appendChild(parser.parseSourceDescription(front));

			return fileDescDiv;
		};

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#parseProfileDesc
		 * @methodOf evtviewer.dataHandler.evtParser
		 * @description
		 * Processes profile description metadata including correspondence and language information.
		 * Creates a structured DOM hierarchy for profile-related content.
		 *
		 * @param {Element} front - The front matter element containing profile descriptions
		 * @returns {Element} A DOM element containing the parsed profile information
		 */
		parser.parseProfileDesc = function(front) {

			const profileDescDiv = document.createElement('div');
			profileDescDiv.className = 'profileDesc';

			const correspDescDiv = parser.parseCorrespondenceDescription(front);
			const langDiv = parser.parseLanguages(front);

			if (correspDescDiv) {
				profileDescDiv.appendChild(correspDescDiv);
			}

			if (langDiv) {
				profileDescDiv.appendChild(langDiv);
			}

			return profileDescDiv;
		};

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#parseTitleStatement
		 * @methodOf evtviewer.dataHandler.evtParser
		 * @description
		 * Extracts and formats the title and author information from the title statement.
		 *
		 * @param {Element} front - The front matter element containing the title statement
		 * @returns {string} HTML string containing formatted title and team information
		 */
		parser.parseTitleStatement = function(front) {
			var currentElement = angular.element(front);
			var authors = currentElement.find(titleStmt.replace(/[<>]/g, '') + ' author');
			var respStmts = currentElement.find(respStmt.replace(/[<>]/g, ''));
			
			var titles = Array.from(currentElement.find(titleStmt.replace(/[<>]/g, '') + ' title'));

			const titleStmtDiv = document.createElement('div');
			titleStmtDiv.className = 'titleStatement';

			if (titles.length > 0) {
				var bigTitle = titles.shift();

				const sectionHeader = document.createElement('span');
				sectionHeader.className = 'projectInfo-sectionHeader';
				sectionHeader.innerHTML = `${bigTitle ? bigTitle.textContent : `{{ 'PROJECT_INFO.NO_INFO' | translate }}`}`;
				titleStmtDiv.appendChild(sectionHeader);

				angular.forEach(titles, function(title) {
					const sectionSubHeader = document.createElement('span');
					sectionSubHeader.className = 'projectInfo-sectionSubHeader';
					sectionSubHeader.innerHTML = `${title ? title.textContent : `{{ 'PROJECT_INFO.NO_INFO' | translate }}`}`;
					titleStmtDiv.appendChild(sectionSubHeader);
				});
			}
			
			angular.forEach(authors, function(author) {
				//const authorContent = author ? author.textContent : `{{ 'PROJECT_INFO.NO_INFO' | translate }}`;
				const authorEntity = parser.parseNamedEntity(document, author);

				//titleStmtDiv.appendChild(authorEntity);
				titleStmtDiv.appendChild(createLabeledBlock('PROJECT_INFO.AUTHOR', authorEntity));			
			});

			if (respStmts.length > 0) {

				const respStmtDiv = document.createElement('div');
				respStmtDiv.className = 'respStatement';

				const sectionHeader = document.createElement('span');
				sectionHeader.className = 'projectInfo-sectionSubHeader';
				sectionHeader.innerHTML = `{{ 'PROJECT_INFO.RESP_STMT' | translate }}`;
				respStmtDiv.appendChild(sectionHeader);

				angular.forEach(respStmts, function(respStmt) {
					var respStmtEl = angular.element(respStmt);

					var respEl = respStmtEl.find(resp.replace(/[<>]/g, ''))[0];
					var respType = respEl.textContent.toUpperCase();

					var people = respStmtEl.find(persName.replace(/[<>]/g, ''));

					const sectionLabel = document.createElement('span');
					sectionLabel.className = 'projectInfo-inlineLabel';
					sectionLabel.innerHTML = `{{ 'PROJECT_INFO.RESP_${respType}' | translate }}: `;
					respStmtDiv.appendChild(sectionLabel);

					const personList = document.createElement('ul');
					personList.className = 'projectInfo-list';

					angular.forEach(people, function(person) {
						//var personText = `${person ? person.textContent : `{{ 'PROJECT_INFO.NO_INFO' | translate }}`}`;
						var personElement = person ? parser.parseNamedEntity(document, person) : `{{ 'PROJECT_INFO.NO_INFO' | translate }}`;

						const listPersonItem = document.createElement('li');
						listPersonItem.className = 'projectInfo-listItem';
						listPersonItem.appendChild(personElement);

						//listPersonItem.innerHTML = personText;

						personList.appendChild(listPersonItem);
					});
					
					respStmtDiv.appendChild(personList);
				});

				titleStmtDiv.appendChild(respStmtDiv);
			}

			return titleStmtDiv;
		};

		parser.parsePublStatement = function(front) {
			var currentElement = angular.element(front);

			var publishers = currentElement.find(publisher.replace(/[<>]/g, ''));
			var licenceEl = currentElement.find(availability.replace(/[<>]/g, '') + ' licence');

			const publStmtDiv = document.createElement('div');
			publStmtDiv.className = 'publStatement';

			const sectionHeader = document.createElement('span');
			sectionHeader.className = 'projectInfo-sectionSubHeader';
			sectionHeader.innerHTML = `{{ 'PROJECT_INFO.PUBLICATION_STMT' | translate }}`;
			publStmtDiv.appendChild(sectionHeader);

			angular.forEach(publishers, (publisher) => {
				const publisherContent = publisher ? publisher.textContent : `{{ 'PROJECT_INFO.NO_INFO' | translate }}`;
				//const publisherRef = publisher.getAttribute("ref") || undefined;
				publStmtDiv.appendChild(createLabeledBlock('PROJECT_INFO.PUBLISHER', publisherContent));
			});

			angular.forEach(licenceEl, (licence) => {
				let licenceContent;
				let licenceTarget;
			
				if (licence) {
					licenceContent = licence.textContent;
					licenceTarget = licence.getAttribute('target') || undefined;
				} else {
					licenceContent = `{{ 'PROJECT_INFO.NO_INFO' | translate }}`;
				}
			
				publStmtDiv.appendChild(createLabeledBlock('PROJECT_INFO.LICENCE', licenceContent, licenceTarget));
			});

			return publStmtDiv;
		}

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#parseSeriesStatement
		 * @methodOf evtviewer.dataHandler.evtParser
		 * @description
		 * Processes series-related metadata including main title, subseries, and unit information.
		 *
		 * @param {Element} front - The front matter element
		 * @returns {string} HTML string containing formatted series information
		 */
		parser.parseSeriesStatement = function(front) {
			var currentElement = angular.element(front);

			var seriesTitles = currentElement.find(seriesStmt.replace(/[<>]/g, '') + ' title[type="main"]'),
				subSeriesTitle = currentElement.find(seriesStmt.replace(/[<>]/g, '') + ' title[type="subseries"]'),
				units = currentElement.find(seriesStmt.replace(/[<>]/g, '') + ' biblScope');

			const seriesStmtDiv = document.createElement('div');
			seriesStmtDiv.className = 'seriesStatement';

			// main header
			const sectionHeader = document.createElement('span');
			sectionHeader.className = 'projectInfo-sectionSubHeader';
			sectionHeader.innerHTML = `{{ 'PROJECT_INFO.SERIES_STMT' | translate }}`;
			seriesStmtDiv.appendChild(sectionHeader);

			angular.forEach(seriesTitles, (title) => {
				const titleContent = title ? title.textContent : `{{ 'PROJECT_INFO.NO_INFO' | translate }}`;
				seriesStmtDiv.appendChild(createLabeledBlock('PROJECT_INFO.SERIES_MAIN_TITLE', titleContent));
			});

			angular.forEach(subSeriesTitle, (title) => {
				const titleContent = title ? title.textContent : `{{ 'PROJECT_INFO.NO_INFO' | translate }}`;
				seriesStmtDiv.appendChild(createLabeledBlock('PROJECT_INFO.SERIES_SUB_TITLE', titleContent));
			});

			angular.forEach(units, (unit) => {
				const unitContent = unit ? unit.textContent : `{{ 'PROJECT_INFO.NO_INFO' | translate }}`;
				seriesStmtDiv.appendChild(createLabeledBlock('PROJECT_INFO.SERIES_UNIT', unitContent));
			});
			
			return seriesStmtDiv;
		};

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#parseSourceDescription
		 * @methodOf evtviewer.dataHandler.evtParser
		 * @description
		 * Extracts and formats source location information including country, settlement, and institution.
		 *
		 * @param {Element} front - The front matter element
		 * @returns {string} HTML string containing formatted source description
		 */
		parser.parseSourceDescription = function(front) {
			var currentElement = angular.element(front);

			var countries = currentElement.find(sourceDesc.replace(/[<>]/g, '') + ' country'),
				settlements = currentElement.find(sourceDesc.replace(/[<>]/g, '') + ' settlement'),
				institutions = currentElement.find(sourceDesc.replace(/[<>]/g, '') + ' institution');
			
			const sourceDescDiv = document.createElement('div');
			sourceDescDiv.className = 'sourceDesc';

			// main header
			const sectionHeader = document.createElement('span');
			sectionHeader.className = 'projectInfo-sectionSubHeader';
			sectionHeader.innerHTML = `{{ 'PROJECT_INFO.SOURCE_DESC' | translate }}`;
			sourceDescDiv.appendChild(sectionHeader);

			// process countries
			angular.forEach(countries, (country) => {
				const countryContent = country ? country.textContent : `{{ 'PROJECT_INFO.NO_INFO' | translate }}`;
				//const countryElement = country ? parser.parseNamedEntity(document, country) : `{{ 'PROJECT_INFO.NO_INFO' | translate }}`;
				//const countryTag = country.getAttribute("key") || undefined;
				sourceDescDiv.appendChild(createLabeledBlock('PROJECT_INFO.COUNTRY', countryContent));
			});

			// process settlements
			angular.forEach(settlements, (settlement) => {
				//const settlementContent = settlement ? settlement.textContent : `{{ 'PROJECT_INFO.NO_INFO' | translate }}`;
				const settlementElement = settlement ? parser.parseNamedEntity(document, settlement) : `{{ 'PROJECT_INFO.NO_INFO' | translate }}`;

				//const settlementRef = settlement.getAttribute("ref") || undefined;
				sourceDescDiv.appendChild(createLabeledBlock('PROJECT_INFO.SETTLEMENT', settlementElement));
			});

			// process institutions
			angular.forEach(institutions, (institution) => {
				//const institutionContent = institution ? institution.textContent : `{{ 'PROJECT_INFO.NO_INFO' | translate }}`;
				const institutionElement = institution ? parser.parseNamedEntity(document, institution) : `{{ 'PROJECT_INFO.NO_INFO' | translate }}`;

				sourceDescDiv.appendChild(createLabeledBlock('PROJECT_INFO.INSTITUTION', institutionElement));
			});
			
			return sourceDescDiv;
		};

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#parseCorrespondenceDescription
		 * @methodOf evtviewer.dataHandler.evtParser
		 * @description
		 * Processes correspondence metadata including sender, receiver, and associated dates.
		 * Handles multiple date formats including single dates and date ranges.
		 *
		 * @param {Element} front - The front matter element
		 * @returns {Element|null} DOM element containing correspondence info, or null if none found
		 */
		parser.parseCorrespondenceDescription = function(front) {
			var currentElement = angular.element(front);

			var correspDescEl = currentElement.find(correspDesc.replace(/[<>]/g, ''));

			var senders = currentElement.find(correspDesc.replace(/[<>]/g, '') + ' correspAction[type="sent"] persName'),
				receivers = currentElement.find(correspDesc.replace(/[<>]/g, '') + ' correspAction[type="received"] persName');
			
			var	datesSent = currentElement.find(correspDesc.replace(/[<>]/g, '') + ' correspAction[type="sent"] date'),
				datesReceived = currentElement.find(correspDesc.replace(/[<>]/g, '') + ' correspAction[type="received"] date');

			var correspDescDiv;

			if (correspDescEl.length > 0) {
				// main div for correspDesc data
				correspDescDiv = document.createElement('div');
				correspDescDiv.className = 'correspDesc';

				// main header
				const sectionHeader = document.createElement('span');
				sectionHeader.className = 'projectInfo-sectionSubHeader';
				sectionHeader.innerHTML = `{{ 'PROJECT_INFO.CORRESP_DESC' | translate }}`;
				correspDescDiv.appendChild(sectionHeader);

				// process senders
				angular.forEach(senders, (sender) => {
					//const senderContent = sender ? sender.textContent : `{{ 'PROJECT_INFO.NO_INFO' | translate }}`;
					const senderElement = sender ? parser.parseNamedEntity(document, sender) : `{{ 'PROJECT_INFO.NO_INFO' | translate }}`;
					correspDescDiv.appendChild(createLabeledBlock('PROJECT_INFO.SENDER', senderElement));
				});

				// process each sent date
				angular.forEach(datesSent, (date) => {
					const parsedDate = parser.parseDateElement(date);
					correspDescDiv.appendChild(createLabeledBlock('PROJECT_INFO.DATE_SENT', parsedDate.textContent));
				});

				// Process each receiver
				angular.forEach(receivers, (receiver) => {
					//const receiverContent = receiver ? receiver.textContent : `{{ 'PROJECT_INFO.NO_INFO' | translate }}`;
					const receiverElement = receiver ? parser.parseNamedEntity(document, receiver) : `{{ 'PROJECT_INFO.NO_INFO' | translate }}`;

					correspDescDiv.appendChild(createLabeledBlock('PROJECT_INFO.RECEIVER', receiverElement));
				});
			
				// Process each received date
				angular.forEach(datesReceived, (dateReceived) => {
					const parsedDateReceived = parser.parseDateElement(dateReceived);
					correspDescDiv.appendChild(createLabeledBlock('PROJECT_INFO.DATE_RECEIVED', parsedDateReceived.textContent));
				});
			} 
			//return correspDescDiv.outerHTML;
			return correspDescDiv;
		};

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#parseLanguages
		 * @methodOf evtviewer.dataHandler.evtParser
		 * @description
		 * Processes language usage information from the document.
		 *
		 * @param {Element} front - The front matter element
		 * @returns {Element} DOM element containing formatted language information
		 */
		parser.parseLanguages = function(front) {
			var currentElement = angular.element(front);
			var langUsageElements = currentElement.find(languageInfo.replace(/[<>]/g, ''));

			// main div for correspDesc data
			const langDiv = document.createElement('div');
    		langDiv.className = 'langUsage';

			// main header
			const sectionHeader = document.createElement('span');
			sectionHeader.className = 'projectInfo-sectionSubHeader';
			sectionHeader.innerHTML = `{{ 'PROJECT_INFO.LANG_USAGE' | translate }}`;
			langDiv.appendChild(sectionHeader);

			const langList = document.createElement('ul');
			langList.className = 'projectInfo-list';
		
			angular.forEach(langUsageElements, function(langUsage) {
				var languages = langUsage.querySelectorAll('language');
		
				angular.forEach(languages, function(language) {
					var langIdent = language.getAttribute('ident') || `{{ 'PROJECT_INFO.NO_INFO' | translate }}`;

					const listLangItem = document.createElement('li');
					listLangItem.className = 'projectInfo-listItem';

					const langBlock = document.createElement('span');
					langBlock.className = 'projectInfo-blockLabel';
					langBlock.innerHTML = langIdent;

					listLangItem.appendChild(langBlock);

					langList.appendChild(listLangItem);
				});
			});

			langDiv.appendChild(langList);
		
			//return langDiv.outerHTML;
			return langDiv;
		};	

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#parseRevisionHistory
		 * @methodOf evtviewer.dataHandler.evtParser
		 * @description
		 * Extracts and formats the revision history of the document.
		 *
		 * @param {Element} front - The front matter element
		 * @returns {Element} DOM element containing the formatted revision history
		 */
		parser.parseRevisionHistory = function(front) {
			var currentElement = angular.element(front);
			var changes = currentElement.find(revisionDesc.replace(/[<>]/g, '') + ' change');

			// main div for correspDesc data
			const revisionDescDiv = document.createElement('div');
    		revisionDescDiv.className = 'revisionDesc';

			// main header
			const sectionHeader = document.createElement('span');
			sectionHeader.className = 'projectInfo-sectionSubHeader';
			sectionHeader.innerHTML = `{{ 'PROJECT_INFO.REVISION_HISTORY' | translate }}`;
			revisionDescDiv.appendChild(sectionHeader);

			const changesList = document.createElement('ul');
			changesList.className = 'projectInfo-list';
			
			angular.forEach(changes, function(change) {
				const changeDateParsed = parser.parseDateElement(change).textContent; 
				const listChangeItem = document.createElement('li');
				listChangeItem.className = 'projectInfo-listItem';

				const changeBlock = document.createElement('span');
				changeBlock.className = 'projectInfo-blockLabel';
				changeBlock.innerHTML = changeDateParsed + `, ` + change.textContent;

				listChangeItem.appendChild(changeBlock);

				changesList.appendChild(listChangeItem);			
			});

			revisionDescDiv.appendChild(changesList);

			return revisionDescDiv;
		};	

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#splitLineBreaks
		 * @methodOf evtviewer.dataHandler.evtParser
		 *
		 * @description
		 * This method will parse a given XML document and split it into lines.
		 * It will uses regular expression to divide the XML into pieces
		 * and then balance the generated XHTML in order to handle the last line break.
		 *
		 * @param {element} docElement XML element to parse
		 * @param {string} defContentEdition string representing the definition of the starting point of the edition
	
		 * @returns {string} string representing the HTML with content divided into lines
		 *
		 * @author CDP
		 */
		parser.splitLineBreaks = function (docElement, defContentEdition) {
			var splittedHTML = '';
			// First Line Breaks (intended as text before first <lb>)
			var contentEditionMatch = '<' + defContentEdition + '(.|[\r\n])*?>',
				firstLineMatch = contentEditionMatch + '(.|[\r\n])*?<lb(.|[\r\n])*?\/>',
				sRegExFirstLine = new RegExp(firstLineMatch, 'ig'),
				matchesFirstLine = docElement.outerHTML.match(sRegExFirstLine);
			if (matchesFirstLine && matchesFirstLine.length > 0) {
				var sRegExContentEdition = new RegExp(contentEditionMatch, 'ig'),
					firstLineHTML = matchesFirstLine[0].replace(sRegExContentEdition, '');
				firstLineHTML = parser.balanceXHTML(firstLineHTML);
				splittedHTML += '<evtLB>' + firstLineHTML + '</evtLB>';
			}
			// var sRegExLbElem = new RegExp(/<lb(.|[\r\n])*?\/>/, 'ig');
			// var lbHTMLString = matches[i].match(sRegExLbElem);

			// Other Line Breaks
			var lineMatch = '<lb(.|[\r\n])*?(?=(<lb|<\/' + defContentEdition + '>))',
				sRegExLine = new RegExp(lineMatch, 'ig'),
				matches = docElement.outerHTML.match(sRegExLine),
				totMatches = matches ? matches.length : 0;
			for (var i = 0; i < totMatches; i++) {
				var lineHTML = parser.balanceXHTML(matches[i]);
				splittedHTML += '<evtLB>' + lineHTML + '</evtLB>';
			}
			return splittedHTML;
		};

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#splitPages
		 * @methodOf evtviewer.dataHandler.evtParser
		 *
		 * @description
		 * This method will parse a given XML document and split it into pages.
		 * It will uses regular expression to divide the XML into pieces
		 * and then balance the generated XHTML in order to handle the last page break.
		 * Finally it stores the result into {@link evtviewer.dataHandler.parsedData parsedData} for future retrievements.
		 *
		 * @param {element} docElement XML element to parse
		 * @param {string} docId id of the current edition document being parsed (used to store data)
		 * @param {string} defContentEdition string representing the definition of the starting point of the edition
	
		 * @author CDP
		 */
		parser.splitPages = function (pages, docElement, docId, defContentEdition, currentDocPages) {
			var matchOrphanText = '<body(.|[\r\n])*?(?=<pb)',
				sRegExInputOrphanText = new RegExp(matchOrphanText, 'ig'),
				matchesOrphanText = docElement.outerHTML.match(sRegExInputOrphanText);

			var match = '<pb(.|[\r\n])*?(?=(<pb|<\/' + defContentEdition + '>))';
			var sRegExInput = new RegExp(match, 'ig');
			var matches = docElement.outerHTML.match(sRegExInput);
			var pageId;

			if (matchesOrphanText && matchesOrphanText.length > 0) {
				var previousDoc = parsedData.getPreviousDocument(docId);

				if (previousDoc && previousDoc.pages && previousDoc.pages.length > 0) {
					var parentPageId = previousDoc.pages[previousDoc.pages.length - 1];
					var currentDocPos = pages.length - currentDocPages.length;

					if (parentPageId && parentPageId !== '') {
						var matchId = 0;
						for (var j = currentDocPos; j < pages.length; j++) {
							pageId = pages[j];
							if (pageId && pageId !== '') {
								parsedData.setPageText(pageId, docId, 'original', matches[matchId]);
								matchId++;
							}
						}
					}
				}
				else {
					for (var i = 0; i < pages.length; i++) {
						pageId = pages[i];
						if (pageId && pageId !== '') {
							parsedData.setPageText(pageId, docId, 'original', matches[i]);
						}
					}
				}
			}
		};

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtParser#parseTextForEditionLevel
		 * @methodOf evtviewer.dataHandler.evtParser
		 *
		 * @description
		 * This method will parse the text of a given XML document on the basis of the page, document and edition level.
		 * - It balances the given XHTML
		 * - It replaces single spaces between elements into <code>__SPACE__</code>, otherwise they will be ignored from loop on childNode.
		 * - It removes <code>pb</code> and <code>lb</code> elements since they where already handled differently
		 * - It tranforms the <code>g</code> element into the text mapped in the referenced glyph for the specific edition level.
		 * - It parses all <code>childNodes</code> with {@link evtviewer.dataHandler.evtParser#parseXMLElement parseXMLElement()}
		 * - Finally it stores the result into {@link evtviewer.dataHandler.parsedData parsedData} for future retrievements.
		 *
		 * @param {string} pageId id of the page being parsed
		 * @param {string} docId id of the edition document being parsed
		 * @param {string} editionLevel id of the edition level being parsed
		 * @param {string} docHTML string representing the original XML of the edition
		 *
		 * @returns {promise} promise that the parser will end
		 *
		 * @author CDP
		 */
		parser.parseTextForEditionLevel = function (pageId, docId, editionLevel, docHTML) {
			var balancedHTMLString = parser.balanceXHTML(docHTML);
			balancedHTMLString = balancedHTMLString.replace(/>\s+</g, '>__SPACE__<');
			var deferred = $q.defer(),
				editionText = balancedHTMLString, //TEMP

				doc = xmlParser.parse('<div id="mainContentToTranform" class="' + editionLevel + '">' + balancedHTMLString + '</div>');
			if (doc !== undefined) {
				var docDOM = doc.getElementById('mainContentToTranform');
				//remove <pb>s
				var pbNode,
					pbs = docDOM.getElementsByTagName('pb'),
					k = 0;
				while (k < pbs.length) {
					pbNode = pbs[k];
					pbNode.parentNode.removeChild(pbNode);
				}

				//remove <lb>s
				var invalidLbsSuffix;
				if (editionLevel === 'diplomatic') {
					invalidLbsSuffix = '_reg';
				} else if (editionLevel === 'interpretative') {
					invalidLbsSuffix = '_orig';
				}
				if (invalidLbsSuffix) {
					var lbs = docDOM.getElementsByTagName('lb');
					k = 0;
					while (k < lbs.length) {
						var lbNode = lbs[k];
						var lbNodeId = lbNode.getAttribute('xml:id');
						if (lbNodeId && lbNodeId !== null && lbNodeId.indexOf(invalidLbsSuffix) >= 0) {
							lbNode.parentNode.removeChild(lbNode);
						} else {
							k++;
						}
					}
				}

				var Gs = docDOM.getElementsByTagName('g');
				k = 0;
				while (k < Gs.length) {
					var gNode = Gs[k],
						ref = gNode.getAttribute('ref'),
						glyphNode = document.createElement('span');
					glyphNode.className = 'glyph';

					if (ref && ref !== '') {
						ref = ref.replace('#', '');
						var edition = editionLevel;
						edition = edition === 'interpretative' ? 'normalized' : edition;
						if (parser.isNestedInElem(gNode, 'abbr') || parser.isNestedInElem(gNode, 'orig')) {
							edition = 'diplomatic';
						}
						var glyphMappingForEdition = parsedData.getGlyphMappingForEdition(ref, edition);
						if (glyphMappingForEdition) {
							glyphNode.appendChild(angular.element(glyphMappingForEdition.element)[0]);
						}
					}
					if (glyphNode) {
						//TODO Creare direttiva apposita per GLYPHs
						gNode.parentNode.insertBefore(glyphNode, gNode.nextSibling);
					}
					gNode.parentNode.removeChild(gNode);
				}
				docDOM.innerHTML = docDOM.innerHTML.replace(/>[\s\r\n]*?</g, '><');

				angular.forEach(docDOM.children, function (elem) {
					var skip = '<pb>,<g>';
					elem.parentNode.replaceChild(parser.parseXMLElement(doc, elem, {
						skip: skip
					}), elem);
				});
				editionText = docDOM.outerHTML;
			} else {
				editionText = '<span> {{ \'TEXT_NOT_AVAILABLE\' | translate }}</span>';
			}

			if (editionText === undefined) {
				var errorMsg = '<span class="alert-msg alert-msg-error">{{\'MESSAGES.ERROR_IN_PARSING_TEXT\' | translate}} <br />{{\'MESSAGES.TRY_DIFFERENT_BROWSER_OR_CONTACT_DEVS\' | translate}}</span>';
				editionText = errorMsg;
			}
			editionText = editionText.replace(/__SPACE__/g, ' ');
			parsedData.setPageText(pageId, docId, editionLevel, editionText);

			deferred.resolve('success');
			return deferred;
		};

		return parser;
	}]);
