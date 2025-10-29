/**
 * @ngdoc service
 * @module evtviewer.dataHandler
 * @name evtviewer.dataHandler.evtNamedEntitiesParser
 * @description 
 * # evtNamedEntitiesParser
 * Service containing methods to parse data regarding named entities and relations among them
 *
 * @requires evtviewer.dataHandler.evtParser
 * @requires evtviewer.dataHandler.parsedData
 *
 * @author CDP
**/
angular.module('evtviewer.dataHandler')

	.service('evtNamedEntitiesParser', ['parsedData', 'evtParser', function (parsedData, evtParser) {
		var NEparser = {};
		//TODO retrieve definitions from configurations
		var listsMainContentDef = '<sourceDesc>';
		// CHANGE: Added support for bibliographic references in named entities
		// This includes both manuscripts and printed works
		var listsToParse = [{
			listDef: '<listPlace>',
			contentDef: ['<place>'],
			contentForLabelDef: '<placeName>',
			type: 'place'
		}, {
			listDef: '<listPerson>',
			contentDef: ['<person>'],
			contentForLabelDef: '<persName>',
			type: 'person'
		}, {
			listDef: '<listOrg>',
			contentDef: ['<org>'],
			contentForLabelDef: '<orgName>',
			type: 'org'
		}, {
			listDef: '<listBibl>',
			contentDef: ['<msDesc>', '<biblStruct>'],
			contentForLabelDef: '<title>',
			type: 'manuscripts'
		}, {
			listDef: '<listBibl>',
			contentDef: ['<biblStruct>'],
			contentForLabelDef: '<title>',
			type: 'prints'
		}, {
			listDef: '<list>',
			contentDef: ['<item>'],
			contentForLabelDef: '',
			type: 'generic'
		}];

		var idAttributeDef = 'xml:id',
			typeAttributeDef = 'type',
			listHeaderDef = '<head>',

			listRelationDef = '<listRelation>',
			relationDef = '<relation>',
			relationNameDef = 'name',
			relationActiveDef = 'active',
			relationPassiveDef = 'passive',
			relationMutualDef = 'mutual',
			relationTypeDef = 'type';
		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtNamedEntitiesParser#parseEntities
		 * @methodOf evtviewer.dataHandler.evtNamedEntitiesParser
		 *
		 * @description
		 * This method will parse named entities and store extracted data into 
		 * {@link evtviewer.dataHandler.parsedData parsedData} for future retrievements.
		 * It is a generic function that will loop over an arry of possible list <code>listsToParse</code> 
		 * and will parse its content depending using tag Names defined in the list itself.
		 * Each element of the <code>listsToParse</code> array is structure as follows:
			  <pre>
			var list = {
				listDef: '', // tagName of list
				contentDef: '', // tagName of single entity
				contentForLabelDef: '', // element to be used as main name
				type: '' // typology of list
			}
			  </pre>
		 * Once the parser of entities has finished, it will parse all the relations and update information of entities
		 * that appear in a relation.
		 *
		 * @param {string} doc string representing the XML document to be parsed
		 *
		 * @author CDP
		 */
		NEparser.parseEntities = function (doc) {
			var currentDocument = angular.element(doc),
				relationsInListDef = '';

			for (var i = 0; i < listsToParse.length; i++) {
				var listDef = listsMainContentDef.replace(/[<>]/g, '') + ' > ' + listsToParse[i].listDef.replace(/[<>]/g, ''),
					listType = listsToParse[i].type || 'generic',
					listTitle = 'LISTS.' + listType.toUpperCase();
				//console.log(listTitle);
				var contentDefList = listsToParse[i].contentDef;
				relationsInListDef += listDef + ' ' + relationDef.replace(/[<>]/g, '') + ', ';

				for (var j = 0; j < contentDefList.length; j++) {
					var contentDef = contentDefList[j].replace(/[<>]/g, '');
					var listDefs = currentDocument.find(listDef);
					angular.forEach(listDefs,
						function (element) {
							var elemtnType = element.getAttribute('type');
							// We consider only first level lists; inset lists will be considered differently
							if (listDef === 'sourceDesc > listBibl') {
								if (!evtParser.isNestedInElem(element, element.tagName) && (listType === elemtnType)) {
									var listId = element.getAttribute(idAttributeDef) || undefined;
									if (listType !== 'generic' || (listType === 'generic' && listId !== undefined)) { //Generic lists only allowed if have an id
										var defCollection = {
											id: listId || evtParser.xpath(element),
											type: listType,
											title: listTitle
										};
										// Skip staff entities - hide them from lists
										if (elemtnType === 'staff') {
											// Don't process staff entities, skip to next element
											return;
										}
										
										angular.forEach(element.childNodes, function (child) {
											if (child.nodeType === 1) {
												var collection = parseCollectionData(child, defCollection);
												var el = {};

												if (listsToParse[i].listDef.indexOf('<' + child.tagName + '>') >= 0) {
													// Parse Direct Sub list 
													NEparser.parseDirectSubList(child, listsToParse[i], defCollection);
												} else if (contentDef.indexOf(child.tagName) >= 0) {
													el = parseEntity(child, listsToParse[i]);
													// CHANGE: Use _listPos for sorting instead of first letter of ID
													// This ensures entities are sorted by their display name rather than ID
													parsedData.addNamedEntityInCollection(collection, el, el._listPos);
												}
											}
										});
										element.parentNode.removeChild(element);
									}
								}
							} else {
								if (!evtParser.isNestedInElem(element, element.tagName)) {
									var listId = element.getAttribute(idAttributeDef) || undefined;
									if (listType !== 'generic' || (listType === 'generic' && listId !== undefined)) { //Generic lists only allowed if have an id
										var defCollection = {
											id: listId || evtParser.xpath(element),
											type: listType,
											title: listTitle
										};

										// Skip staff entities - hide them from lists
										if (elemtnType === 'staff') {
											// Don't process staff entities, skip to next element
											return;
										}

										angular.forEach(element.childNodes, function (child) {
											if (child.nodeType === 1) {
												var collection = parseCollectionData(child, defCollection);
												var el = {};

												if (listsToParse[i].listDef.indexOf('<' + child.tagName + '>') >= 0) {
													// Parse Direct Sub list 
													NEparser.parseDirectSubList(child, listsToParse[i], defCollection);
												} else if (contentDef.indexOf(child.tagName) >= 0) {
													el = parseEntity(child, listsToParse[i]);
													// CHANGE: Use _listPos for sorting instead of first letter of ID
													
													// This ensures entities are sorted by their display name rather than ID
													parsedData.addNamedEntityInCollection(collection, el, el._listPos);
												}
											}
										});
										element.parentNode.removeChild(element);
									}
								}
							}
						});

				}

			}
			// Parse relations
			var relations = currentDocument.find(relationsInListDef.slice(0, -2));
			if (relations && relations.length > 0) {
				var defCollection = {
					id: 'parsedRelations',
					type: 'relation',
					title: 'LISTS.RELATION'
				};
				angular.forEach(relations, function (element) {
					NEparser.parseRelationsInList(element, defCollection);
				});
			}

			// console.log('## parseEntities ##', parsedData.getNamedEntitiesCollection());
		};
		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtNamedEntitiesParser#parseDirectSubList
		 * @methodOf evtviewer.dataHandler.evtNamedEntitiesParser
		 *
		 * @description
		 * This method will parse all first level sub list and store extracted data into 
		 * {@link evtviewer.dataHandler.parsedData parsedData} for future retrievements.
		 *
		 * @param {element} nodeElem XML element representing the entity to be parsed
		 * @param {Object} listToParse JSON object representing the list that is being parsed; this object is structured as follows:
			  <pre>
			var listToParse = {
				listDef: '', // tagName of list
				contentDef: '', // tagName of single entity
				contentForLabelDef: '', // element to be used as main name
				type: '' // typology of list
			}
			  </pre>
		 * @param {Object} defCollection JSON object representing the collection where to store data about relations;
		 * this object is structured as follows
			  <pre>
				var defCollection = {
					id : '',
					type : '',
					title : ''
				};
			  </pre>
		 *
		 * @author CDP
		 */
		NEparser.parseDirectSubList = function (nodeElem, listToParse, defCollection) {
			var contentDef = listToParse.contentDef,
				listDef = listsToParse.listDef;
			angular.forEach(child.children, function (subChild) {
				if (subChild.nodeType === 1) {
					if (listDef.indexOf(subChild.tagName) >= 0) {
						NEparser.parseDirectSubList(subChild, listsToParse[i], defCollection);
					} else if (contentDef.indexOf(subChild.tagName) >= 0) {
						var el = parseEntity(subChild, listsToParse[i]);
						// Use _listPos for sorting instead of ID
						// This ensures consistent sorting based on display names
						parsedData.addNamedEntityInCollection(collection, el, el._listPos);
					}
				}
			});
		};
		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtNamedEntitiesParser#parseRelationsInList
		 * @methodOf evtviewer.dataHandler.evtNamedEntitiesParser
		 *
		 * @description
		 * This method will parse all the relations encoded in a list
		 * - It will handle information about roles (active, passive, mutual) and about relation type.
		 * - It will update data in named entities that appear in the relation itself
		 * - Finaly, it will store all data extracted in {@link evtviewer.dataHandler.parsedData parsedData} for future retrievements.
		 *
		 * @param {element} nodeElem XML element representing the entity to be parsed
		 * @param {Object} defCollection JSON object representing the collection where to store data about relations. 
		 * This object is structured as follows
			  <pre>
				var defCollection = {
					id : '',
					type : '',
					title : ''
				};
			  </pre>
		 *
		 * @author CDP
		 */
		NEparser.parseRelationsInList = function (nodeElem, defCollection) {
			var parsedRelation = evtParser.parseXMLElement(nodeElem, nodeElem, { skip: '<evtNote>' }),
				activeRefs = nodeElem.getAttribute(relationActiveDef),
				mutualRefs = nodeElem.getAttribute(relationMutualDef),
				passiveRefs = nodeElem.getAttribute(relationPassiveDef),
				relationName = nodeElem.getAttribute(relationNameDef),
				relationType = nodeElem.getAttribute(relationTypeDef);

			if (!relationType && nodeElem.parentNode && listRelationDef.indexOf('<' + nodeElem.parentNode.tagName + '>') >= 0) {
				relationType = nodeElem.parentNode.getAttribute(relationTypeDef);
			}
			relationName = relationName ? evtParser.camelToSpace(relationName) : relationName;

			var elId = nodeElem.getAttribute(idAttributeDef) || evtParser.xpath(nodeElem);
			var relationEl = {
				id: elId,
				label: '',
				content: {
					_indexes: []
				},
				_listPos: '',
				_xmlSource: nodeElem.outerHTML.replace(/ xmlns="http:\/\/www\.tei-c\.org\/ns\/1\.0"/g, '')
			};

			relationEl.content.name = [{
				attributes: { _indexes: [] },
				text: relationName
			}];
			relationEl.content._indexes.push('name');

			// Relation Label => NAME (TYPE): TEXT [TEXT is set at the bottom of the function]
			relationEl.label = relationName ? relationName.toLowerCase() : '';
			if (relationName) {
				relationEl.label += ' (';
			}
			relationEl.label += relationType ? relationType : 'generic';
			relationEl.label += ' relation';
			if (relationName) {
				relationEl.label += ')';
			}


			//relationType = relationType ? '<i>'+relationType+'</i>' : '';
			var relationText = '<span class="relation">',
				activeText = '',
				mutualText = '',
				passiveText = '';

			var activeRefsArray = activeRefs ? activeRefs.split('#').filter(function (el) { return el.length !== 0; }) : [],
				mutualRefsArray = mutualRefs ? mutualRefs.split('#').filter(function (el) { return el.length !== 0; }) : [],
				passiveRefsArray = passiveRefs ? passiveRefs.split('#').filter(function (el) { return el.length !== 0; }) : [];

			if (activeRefs || mutualRefs || passiveRefs || relationName) {
				var entityElem, entityId, listType;
				for (var i = 0; i < activeRefsArray.length; i++) {
					entityElem = document.createElement('evt-named-entity-ref');
					entityId = activeRefsArray[i].trim();
					//listType = parsedData.getNamedEntityType(entityId);

					if (entityId && entityId !== '') {
						entityElem.setAttribute('data-entity-id', entityId);
					}
					//entityElem.setAttribute('data-entity-type', listType);
					entityElem.textContent = '#' + entityId;
					relationText += entityElem.outerHTML + ' ';
					activeText += entityElem.outerHTML.trim() + ', ';
				}

				for (var j = 0; j < mutualRefsArray.length; j++) {
					if (j === 0 && activeRefs && activeRefs !== '') {
						relationText += '{{ \'AND\' | translate}} ';
					}

					entityElem = document.createElement('evt-named-entity-ref');
					entityId = mutualRefsArray[j].trim();
					//listType = parsedData.getNamedEntityType(entityId);

					if (entityId && entityId !== '') {
						entityElem.setAttribute('data-entity-id', entityId);
					}
					//entityElem.setAttribute('data-entity-type', listType);
					entityElem.textContent = '#' + entityId;
					relationText += entityElem.outerHTML + ' ';
					mutualText += entityElem.outerHTML.trim() + ', ';
				}

				relationText += relationName ? '<span class="relation-name">' + relationName + ' </span>' : '';

				for (var k = 0; k < passiveRefsArray.length; k++) {
					entityElem = document.createElement('evt-named-entity-ref');
					entityId = passiveRefsArray[k].trim();
					//listType = parsedData.getNamedEntityType(entityId);

					if (entityId && entityId !== '') {
						entityElem.setAttribute('data-entity-id', entityId);
					}
					//entityElem.setAttribute('data-entity-type', listType);
					entityElem.textContent = '#' + entityId;
					relationText += entityElem.outerHTML + ' ';
					passiveText += entityElem.outerHTML.trim() + ', ';
				}
			}
			relationText += '</span>';
			relationText += parsedRelation ? parsedRelation.innerHTML : nodeElem.innerHTML;

			// Update info in passed named entities
			// Active roles
			// Add relation info to active elements
			for (var x = 0; x < activeRefsArray.length; x++) {
				var entityActive = parsedData.getNamedEntity(activeRefsArray[x].trim());
				if (entityActive && relationText !== '') {
					if (!entityActive.content.relations) {
						entityActive.content.relations = [];
						entityActive.content._indexes.push('relations');
					}
					entityActive.content.relations.push({
						text: '{{ \'LISTS.RELATION_ACTIVE_ROLE \' | translate:\'{relationType:"' + relationType + '"}\'}}: ' + relationText,
						attributes: []
					});
					entityActive._xmlSource += nodeElem.outerHTML.replace(/ xmlns="http:\/\/www\.tei-c\.org\/ns\/1\.0"/g, '');
				}
			}

			// Mutual roles
			for (var y = 0; y < mutualRefsArray.length; y++) {
				var entityMutual = parsedData.getNamedEntity(mutualRefsArray[y].trim());
				if (entityMutual && relationText !== '') {
					if (!entityMutual.content.relations) {
						entityMutual.content.relations = [];
						entityMutual.content._indexes.push('relations');
					}
					entityMutual.content.relations.push({
						text: '{{ \'LISTS.RELATION_MUTUAL_ROLE \' | translate:\'{relationType:"' + relationType + '"}\'}}: ' + relationText,
						attributes: []
					});
					entityMutual._xmlSource += nodeElem.outerHTML.replace(/ xmlns="http:\/\/www\.tei-c\.org\/ns\/1\.0"/g, '');
				}
			}

			// Passive roles
			for (var z = 0; z < passiveRefsArray.length; z++) {
				var entityPassive = parsedData.getNamedEntity(passiveRefsArray[z].trim());
				if (entityPassive && relationText !== '') {
					if (!entityPassive.content.relations) {
						entityPassive.content.relations = [];
						entityPassive.content._indexes.push('relations');
					}
					entityPassive.content.relations.push({
						text: '{{ \'LISTS.RELATION_PASSIVE_ROLE \' | translate:\'{relationType:"' + relationType + '"}\'}}: ' + relationText,
						attributes: []
					});
					entityPassive._xmlSource += nodeElem.outerHTML.replace(/ xmlns="http:\/\/www\.tei-c\.org\/ns\/1\.0"/g, '');
				}
			}

			// Add details to relation element
			relationEl.label = evtParser.capitalize(relationEl.label + ': ' + relationText);
			relationEl._listPos = relationEl.label.substr(0, 1).toLowerCase();

			if (activeText !== '' || mutualText !== '' || passiveText !== '') {
				var actors = [];

				if (activeText !== '') {
					actors.push({
						attributes: {
							type: 'LISTS.RELATION_ACTIVE',
							_indexes: ['type']
						},
						text: activeText.slice(0, -2)
					});
				}

				if (mutualText !== '') {
					actors.push({
						attributes: {
							type: 'LISTS.RELATION_MUTUAL',
							_indexes: ['type']
						},
						text: mutualText.slice(0, -2)
					});
				}

				if (passiveText !== '') {
					actors.push({
						attributes: {
							type: 'LISTS.RELATION_PASSIVE',
							_indexes: ['type']
						},
						text: passiveText.slice(0, -2)
					});
				}

				relationEl.content.actors = actors;
				relationEl.content._indexes.push('actors');
			}
			parsedData.addNamedEntityInCollection(defCollection, relationEl, relationEl._listPos);
		};
		/**
		 * @ngdoc function
		 * @name evtviewer.dataHandler.evtNamedEntitiesParser#parseEntity
		 * @methodOf evtviewer.dataHandler.evtNamedEntitiesParser
		 *
		 * @description
		 * [PRIVATE] This is a very generic function to parse a single entity.
		 * The content of the entity is parsed in a very generic way:
		 * - A loop will transform every child node of the given element in a JSON structure that looks like this:
			  <pre>
					var element = {
						content : {
							'childNode_1': { 'text': 'Text with HTML of child 1', 'attributes': [ ] }, 
							'childNode_2': { 'text': 'Text with HTML of child 2', 'attributes': [ ] }, 
							'childNode_n': { 'text': 'Text with HTML of child n', 'attributes': [ ] },
							_indexes: [ 'childNode_1', 'childNode_2', 'childNode_n' ]
						}
					};
			  </pre>
		 * - The generic XML parser will transform the content of each node in an HTML element with *Tag Name* as *Class Name*
		 *
		 * @param {element} nodeElem XML element representing the entity to parse
		 * @param {string} listToParse encoding definitions of the list to which the entity belongs
		 *
		 * @returns {Object} JSON element representing the entity, structure as follows:
			  <pre>
				var el = {
					id         : '',
					label      : '',
					content    : {
						_indexes: []
					},
					_listPos   : '',
					_xmlSource : ''
				};
			  </pre>
		 * 
		 * @author CDP
		 */
		var parseEntity = function (nodeElem, listToParse) {
			var contentDef = listToParse.contentDef,
				listDef = listToParse.listDef,
				contentForLabelDef = listToParse.contentForLabelDef;
			var elId = nodeElem.getAttribute(idAttributeDef) || evtParser.xpath(nodeElem);
			var sameAs = nodeElem.getAttribute('sameAs');
			var el = {
				id: elId,
				label: '',
				content: {
					_indexes: []
				},
				_listPos: elId.substr(0, 1).toLowerCase(),
				_xmlSource: nodeElem.outerHTML.replace(/ xmlns="http:\/\/www\.tei-c\.org\/ns\/1\.0"/g, ''),
				sameAs: sameAs
			};

			var elementForLabel = nodeElem.getElementsByTagName(contentForLabelDef.replace(/[<>]/g, ''));
			if (elementForLabel && elementForLabel.length > 0) {
				var parsedLabel = evtParser.parseXMLElement(elementForLabel[0], elementForLabel[0], { skip: '<evtNote><persName><orgName><placeName>' });
				el.label = parsedLabel ? parsedLabel.innerHTML : elId;
				
				// CHANGE: Improved entity sorting by using surname for people
				if(contentForLabelDef === '<persName>') {
					var surname = nodeElem.getElementsByTagName("surname")[0];
					if (surname && typeof surname !== "undefined") {
						// Sort by first letter of surname
						el._listPos = surname.innerHTML.substr(0, 1).toLowerCase();
					}
					else {
						// If no surname, sort by first letter of forename
						el._listPos = nodeElem.getElementsByTagName("forename")[0].innerHTML.substr(0, 1).toLowerCase();
					}
				}
				else {
					// For non-person entities, sort by first letter of label
					el._listPos = el.label.substr(0, 1).toLowerCase();
				}
			} else {
				el.label = elId;
			}

			angular.forEach(nodeElem.childNodes, function (child) {

				if (child.nodeType === 1) {
					if (child.tagName === 'msIdentifier') {
						// Special handling for msIdentifier - group all children together
						if (child.children && child.children.length > 0) {
							var msIdentifierParts = [];
							angular.forEach(child.children, function (subChild) {
								if (subChild.nodeType === 1) {
									var parsedSubChild = evtParser.parseXMLElement(subChild, subChild, { skip: '<evtNote><persName><orgName><placeName>' });
									var text = parsedSubChild ? parsedSubChild.innerHTML : subChild.innerHTML;
									if (text && text.trim()) {
										msIdentifierParts.push('<span class="msIdentifier-part"><span class="msIdentifier-label">{{ (\'NAMED_ENTITY_FIELDS.' +
											subChild.tagName + '\') | translate }}:</span> ' + text + '</span>');
									}
								}
							});

							if (msIdentifierParts.length > 0) {
								if (el.content['msIdentifier'] === undefined) {
									el.content['msIdentifier'] = [];
									el.content._indexes.push('msIdentifier');
								}
								el.content['msIdentifier'].push({
									text: msIdentifierParts.join(' '),
									attributes: evtParser.parseElementAttributes(child)
								});
							}
						}
					} else if (child.tagName === 'imprint') {
						// Special handling for imprint - group all children together
						if (child.children && child.children.length > 0) {
							var imprintParts = [];
							angular.forEach(child.children, function (subChild) {
								if (subChild.nodeType === 1) {
									var parsedSubChild = evtParser.parseXMLElement(subChild, subChild, { skip: '<evtNote><persName><orgName><placeName>' });
									var text = parsedSubChild ? parsedSubChild.innerHTML : subChild.innerHTML;
									if (text && text.trim()) {
										imprintParts.push('<span class="imprint-part"><span class="imprint-label">{{ (\'NAMED_ENTITY_FIELDS.' +
											subChild.tagName + '\') | translate }}:</span> ' + text + '</span>');
									}
								}
							});

							if (imprintParts.length > 0) {
								if (el.content['imprint'] === undefined) {
									el.content['imprint'] = [];
									el.content._indexes.push('imprint');
								}
								el.content['imprint'].push({
									text: imprintParts.join(' '),
									attributes: evtParser.parseElementAttributes(child)
								});
							}
						}
					} else if (child.tagName === 'event') {
						// Special handling for event - format date and label/content
						var eventParts = [];
						var attributes = evtParser.parseElementAttributes(child);
						var eventDate = attributes.when || attributes.notBefore || attributes.notAfter;
						var dateRange = '';

						// Helper function to format date from ISO to DD/MM/YYYY
						var formatDate = function(isoDate) {
							if (!isoDate) return isoDate;
							var dateParts = isoDate.split('-');
							if (dateParts.length === 3) {
								return dateParts[2] + '/' + dateParts[1] + '/' + dateParts[0];
							}
							return isoDate;
						};

						if (attributes.notBefore && attributes.notAfter) {
							dateRange = formatDate(attributes.notBefore) + ' - ' + formatDate(attributes.notAfter);
						} else if (attributes.notBefore) {
							dateRange = '{{ \'GENERIC.FROM\' | translate }} ' + formatDate(attributes.notBefore);
						} else if (attributes.notAfter) {
							dateRange = '{{ \'GENERIC.TO\' | translate }} ' + formatDate(attributes.notAfter);
						} else if (eventDate) {
							dateRange = formatDate(eventDate);
						}

						// Check for label child
						var eventLabel = '';
						var eventContent = '';
						if (child.children && child.children.length > 0) {
							angular.forEach(child.children, function (subChild) {
								if (subChild.nodeType === 1) {
									if (subChild.tagName === 'label') {
										eventLabel = subChild.textContent || subChild.innerText;
									} else if (subChild.tagName === 'ab') {
										var parsedAb = evtParser.parseXMLElement(subChild, subChild, { skip: '<evtNote><persName><orgName><placeName>' });
										eventContent = parsedAb ? parsedAb.innerHTML : subChild.innerHTML;
									}
								}
							});
						}

						if (eventLabel) {
							// If there's a label, show it as the event type
							if (dateRange) {
								eventParts.push('<span class="event-part"><span class="event-label">{{ (\'NAMED_ENTITY_FIELDS.' +
									eventLabel + '\') | translate }}:</span> ' + dateRange + '</span>');
							}
						} else if (eventContent) {
							// If there's content in ab, show it with date
							if (dateRange) {
								eventParts.push('<span class="event-part"><span class="event-label">{{ (\'NAMED_ENTITY_FIELDS.event\') | translate }}:</span> ' +
									eventContent + ' (' + dateRange + ')</span>');
							} else {
								eventParts.push('<span class="event-part"><span class="event-label">{{ (\'NAMED_ENTITY_FIELDS.event\') | translate }}:</span> ' +
									eventContent + '</span>');
							}
						} else if (dateRange) {
							// Just date without label or content
							eventParts.push('<span class="event-part"><span class="event-label">{{ (\'NAMED_ENTITY_FIELDS.event\') | translate }}:</span> ' +
								dateRange + '</span>');
						}

						if (eventParts.length > 0) {
							if (el.content['event'] === undefined) {
								el.content['event'] = [];
								el.content._indexes.push('event');
							}
							el.content['event'].push({
								text: eventParts.join(' '),
								attributes: attributes
							});
						}
					} else if (child.tagName === 'birth' || child.tagName === 'death') {
						// Special handling for birth and death - group date and place
						if (child.children && child.children.length > 0) {
							var lifeParts = [];
							angular.forEach(child.children, function (subChild) {
								if (subChild.nodeType === 1) {
									var parsedSubChild = evtParser.parseXMLElement(subChild, subChild, { skip: '<evtNote><persName><orgName><placeName>' });
									var text = parsedSubChild ? parsedSubChild.innerHTML : subChild.innerHTML;

									// For date elements, extract the when-iso attribute and format it
									if (subChild.tagName === 'date') {
										var dateAttr = subChild.getAttribute('when-iso') ||
										               subChild.getAttribute('notBefore-iso') ||
										               subChild.getAttribute('notAfter-iso');
										if (dateAttr) {
											// Convert from YYYY-MM-DD to DD/MM/YYYY
											var dateParts = dateAttr.split('-');
											if (dateParts.length === 3) {
												text = dateParts[2] + '/' + dateParts[1] + '/' + dateParts[0];
											} else {
												text = dateAttr;
											}
										}
									}

									if (text && text.trim()) {
										lifeParts.push('<span class="life-part"><span class="life-label">{{ (\'NAMED_ENTITY_FIELDS.' +
											subChild.tagName + '\') | translate }}:</span> ' + text + '</span>');
									}
								}
							});

							if (lifeParts.length > 0) {
								if (el.content[child.tagName] === undefined) {
									el.content[child.tagName] = [];
									el.content._indexes.push(child.tagName);
								}
								el.content[child.tagName].push({
									text: lifeParts.join(' '),
									attributes: evtParser.parseElementAttributes(child)
								});
							}
						}
					} else if (child.tagName === 'history') {
						// Special handling for history - group all nested information together
						if (child.children && child.children.length > 0) {
							var historyParts = [];
							angular.forEach(child.children, function (subChild) {
								if (subChild.nodeType === 1) {
									// For origin, provenance, acquisition - get their children
									if (subChild.tagName === 'origin' || subChild.tagName === 'provenance' || subChild.tagName === 'acquisition') {
										if (subChild.children && subChild.children.length > 0) {
											angular.forEach(subChild.children, function (subSubChild) {
												if (subSubChild.nodeType === 1) {
													var parsedSubSubChild = evtParser.parseXMLElement(subSubChild, subSubChild, { skip: '<evtNote><persName><orgName><placeName>' });
													var text = parsedSubSubChild ? parsedSubSubChild.innerHTML : subSubChild.innerHTML;
													if (text && text.trim()) {
														// Determine the label to use
														var labelKey = subSubChild.tagName;

														// For persName with type="copist", use "copist" as label
														if (subSubChild.tagName === 'persName' && subSubChild.getAttribute('type') === 'copist') {
															labelKey = 'copist';
														}
														// For orgName, persName, placeName inside provenance/acquisition, use parent's name
														else if ((subSubChild.tagName === 'orgName' || subSubChild.tagName === 'persName' || subSubChild.tagName === 'placeName') &&
														         (subChild.tagName === 'provenance' || subChild.tagName === 'acquisition')) {
															labelKey = subChild.tagName;
														}

														historyParts.push('<span class="history-part"><span class="history-label">{{ (\'NAMED_ENTITY_FIELDS.' +
															labelKey + '\') | translate }}:</span> ' + text + '</span>');
													}
												}
											});
										}
									}
								}
							});

							if (historyParts.length > 0) {
								if (el.content['history'] === undefined) {
									el.content['history'] = [];
									el.content._indexes.push('history');
								}
								el.content['history'].push({
									text: historyParts.join(' '),
									attributes: evtParser.parseElementAttributes(child)
								});
							}
						}
					} else if (child.tagName === 'monogr' || child.tagName === 'msContents' ||
					    child.tagName === 'origin' || child.tagName === 'provenance' ||
					    child.tagName === 'acquisition') {
						if (child.children && child.children.length > 0) {

							angular.forEach(child.children, function (subChild) {
								if (subChild.nodeType === 1) {
									// Special handling for imprint inside monogr
									if (subChild.tagName === 'imprint') {
										if (subChild.children && subChild.children.length > 0) {
											var imprintParts = [];
											angular.forEach(subChild.children, function (imprintChild) {
												if (imprintChild.nodeType === 1) {
													var parsedImprintChild = evtParser.parseXMLElement(imprintChild, imprintChild, { skip: '<evtNote><persName><orgName><placeName>' });
													var text = parsedImprintChild ? parsedImprintChild.innerHTML : imprintChild.innerHTML;
													if (text && text.trim()) {
														imprintParts.push('<span class="imprint-part"><span class="imprint-label">{{ (\'NAMED_ENTITY_FIELDS.' +
															imprintChild.tagName + '\') | translate }}:</span> ' + text + '</span>');
													}
												}
											});

											if (imprintParts.length > 0) {
												if (el.content['imprint'] === undefined) {
													el.content['imprint'] = [];
													el.content._indexes.push('imprint');
												}
												el.content['imprint'].push({
													text: imprintParts.join(' '),
													attributes: evtParser.parseElementAttributes(subChild)
												});
											}
										}
									}
									else if (subChild.tagName === 'msItem' || subChild.tagName === 'origin' ||
									    subChild.tagName === 'provenance' || subChild.tagName === 'acquisition') {
										if (subChild.children && subChild.children.length > 0) {
											angular.forEach(subChild.children, function (subSubChild) {
												if (subSubChild.nodeType === 1) {
													parseAndAddContentToEntity(el, subSubChild, contentDef, listDef);
												}
											});
										}
										else {
											parseAndAddContentToEntity(el, subChild, contentDef, listDef);
										}
									}
									else {
										parseAndAddContentToEntity(el, subChild, contentDef, listDef);
									}
								}
							});
						} else {
							parseAndAddContentToEntity(el, child, contentDef, listDef);
						}
					} else if (child.tagName === 'location' || child.tagName === 'address') {
						// Handle location and address elements - extract all nested information
						if (child.children && child.children.length > 0) {
							angular.forEach(child.children, function (subChild) {
								if (subChild.nodeType === 1) {
									parseAndAddContentToEntity(el, subChild, contentDef, listDef);
								}
							});
						} else {
							parseAndAddContentToEntity(el, child, contentDef, listDef);
						}
					} else {
						if (contentForLabelDef.indexOf('<' + child.tagName + '>') >= 0 && child.children && child.children.length > 0) {
							angular.forEach(child.children, function (subChild) {
								if (subChild.nodeType === 1) {
									parseAndAddContentToEntity(el, subChild, contentDef, listDef);
								}
							});
						} else {
							parseAndAddContentToEntity(el, child, contentDef, listDef);
						}
					}
				}
			});
			if (contentForLabelDef === '<placeName>') {
				findMapCoordinates(el, nodeElem);
			}
			return el;
		};

		var parseAndAddContentToEntity = function (el, child, contentDef, listDef) {
			var parsedChild;

			// For persName with type="copist", store it separately as "copist"
			var contentKey = child.tagName;
			var childType = child.getAttribute('type');
			var isCopist = (child.tagName === 'persName' && childType === 'copist');
			if (isCopist) {
				contentKey = 'copist';
			}

			if (el.content[contentKey] === undefined) {
				el.content[contentKey] = [];
				el.content._indexes.push(contentKey);
			}

			if (contentDef.indexOf('<' + child.tagName + '>') >= 0) {
				parsedChild = NEparser.parseSubEntity(child, contentDef, listDef);
			} else {
				parsedChild = evtParser.parseXMLElement(child, child, { skip: '<evtNote><persName><orgName><placeName>' });
			}

			// Parse attributes, but exclude 'type' for copist to avoid duplication
			var attributes = evtParser.parseElementAttributes(child);
			if (isCopist && attributes.type) {
				delete attributes.type;
			}

			el.content[contentKey].push({
				text: parsedChild ? parsedChild.innerHTML : child.innerHTML,
				attributes: attributes
			});
			//}
		};



		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtNamedEntitiesParser#findMapCoordinates
		 * @methodOf evtviewer.dataHandler.evtNamedEntitiesParser
		 *
		 * @description
		 * The method will search the <geo> element in order to retrieve the geographic coordinates
		 * and stor them in the parsed entity object inside of a "map" property.
		 * 
		 * @param {Object} el JSON object representing the parsed entity node 
		 * @param {element} node XML element representing the entity to be parsed
		*
		* @author CM
		*/
		var findMapCoordinates = function (el, node) {
			var first = node.outerHTML.search('<geo');
			if (first >= 0) {
				var last = node.outerHTML.search('</geo>');
				var geo = node.outerHTML.substring(first, last);
				geo = geo.substring(geo.indexOf('>') + 1);
				var coordinates = geo.split(', ');
				if (coordinates.length === 2) {
					el.map = {
						lat: coordinates[0],
						lng: coordinates[1]
					}
				}
			}
		}

		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtNamedEntitiesParser#parseSubEntity
		 * @methodOf evtviewer.dataHandler.evtNamedEntitiesParser
		 *
		 * @description
		 * This method will parse entities nested into other entities.
		 *
		 * @param {element} nodeElem XML element representing the main entity
		 * @param {string} contentDef encoding definitions of the single entity
		 * @param {string} listDef encoding definitions of the list to which the entity belongs
		 *
		 * @returns {element} <code>evt-named-entity-ref</code> pointing to given entity reference
		 * 
		 * @author CDP
		 */
		NEparser.parseSubEntity = function (nodeElem, contentDef, listDef) {
			var newNodeElem = document.createElement('evt-named-entity-ref'),
				entityRef = nodeElem.getAttribute('ref'),
				entityId = entityRef ? entityRef.replace('#', '') : undefined,
				entityType = nodeElem.getAttribute('type');
			if (entityId && entityId !== '') {
				newNodeElem.setAttribute('data-entity-id', entityId);
			}
			if (entityType !== '') {
				newNodeElem.setAttribute('bibl-type', entityType);
			}
			var listType = nodeElem.tagName ? nodeElem.tagName : 'generic';
			newNodeElem.setAttribute('data-entity-type', listType);

			var entityContent = '';
			for (var i = 0; i < nodeElem.childNodes.length; i++) {
				var childElement = nodeElem.childNodes[i].cloneNode(true),
					parsedXmlElem;

				if (childElement.nodeType === 1 && listDef.toLowerCase().indexOf('<' + childElement.tagName.toLowerCase() + '>') >= 0) {
					parsedXmlElem = NEparser.parseNamedEntitySubList(childElement, childElement, '<evtNote>');
				} else {
					parsedXmlElem = evtParser.parseXMLElement(childElement, childElement, { skip: '<evtNote>' });
				}
				newNodeElem.appendChild(parsedXmlElem);
			}
			return newNodeElem;
		};
		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtNamedEntitiesParser#parseNamedEntitySubList
		 * @methodOf evtviewer.dataHandler.evtNamedEntitiesParser
		 *
		 * @description
		 * This method will parse an XML element representing a named entity sub list
		 * and transform it into an unordered list with attributes as titles
		 * It will replace the node <code>entityNode</code> with a new <code>ul</code> element.
		 * 
		 * @param {element} doc XML element representing the document to be parsed
		 * @param {element} entityNode node to be transformed
		 * @param {string} skip names of sub elements to skip from transformation
		 *
		 * @returns {element} new element created from entity node
		 * 
		 * @author CDP
		 */
		NEparser.parseNamedEntitySubList = function (doc, entityNode, skip) {
			var newNodeElem = document.createElement('span'),
				entityHeadElem = document.createElement('span'),
				headTextContent = '';

			newNodeElem.className = entityNode.tagName.toLowerCase();
			entityHeadElem.className = entityNode.tagName.toLowerCase() + '-attributes';

			for (var i = 0; i < entityNode.attributes.length; i++) {
				var attrib = entityNode.attributes[i];
				if (attrib.specified) {
					newNodeElem.setAttribute('data-' + attrib.name.replace(':', '-'), attrib.value);
					headTextContent += evtParser.camelToSpace(attrib.value) + ', ';
				}
			}
			if (headTextContent !== '') {
				entityHeadElem.textContent = headTextContent.slice(0, -2);
				newNodeElem.appendChild(entityHeadElem);
			}

			for (var j = 0; j < entityNode.childNodes.length; j++) {
				var childElement = entityNode.childNodes[j].cloneNode(true),
					parsedXmlElem = evtParser.parseXMLElement(doc, childElement, { skip: skip });
				newNodeElem.appendChild(parsedXmlElem);
			}
			return newNodeElem;
		};
		/**
		 * @ngdoc function
		 * @name evtviewer.dataHandler.evtNamedEntitiesParser#parseCollectionData
		 * @methodOf evtviewer.dataHandler.evtNamedEntitiesParser
		 *
		 * @description
		 * [PRIVATE] This is a very generic function that will parse the information about an collection of entities.
		 *
		 * @param {element} el XML element representing the collection to be parsed
		 * @param {Object} defCollection JSON object representing the parsed collection and containing data already retrieved. 
		 *
		 * @returns {Object} JSON object representing a collection of entities, structured as follows:
			  <pre>
				var defCollection = {
					id : ''
					type : '',
					title : ''
				};
			  </pre>
		 * 
		 * @author CDP
		 */
		var parseCollectionData = function (el, defCollection) {
			var collection = defCollection;
			if (el.previousElementSibling && listHeaderDef.indexOf('<' + el.previousElementSibling.tagName + '>') >= 0) {
				collection.id = el.previousElementSibling.textContent.trim().replace(/\s/g, '');
				//collection.title = el.previousElementSibling.textContent.trim();
				//collection.title = defCollection.
			} else {
				var parentNode = el.parentNode,
					listId;
				if (parentNode && parentNode.getAttribute(idAttributeDef)) {
					listId = parentNode.getAttribute(idAttributeDef).trim().replace(/\s/g, '');
					collection.id = listId;
					//collection.title = listId;
				}
				if (parentNode && parentNode.getAttribute(typeAttributeDef)) {
					var listTitle = parentNode.getAttribute(typeAttributeDef).trim();
					if (!listId || listId === undefined) {
						collection.id = listTitle;
					}
					listTitle = evtParser.camelToSpace(listTitle);
					//collection.title = (listTitle.substr(0, 1).toUpperCase() + listTitle.substr(1));
				}
			}
			return collection;
		};

		// NAMED ENTITIES OCCURRENCES
		var getPageIdFromHTMLString = function (HTMLstring) {
			var matchPbIdAttr = 'xml:id=".*"',
				sRegExPbIdAttr = new RegExp(matchPbIdAttr, 'ig'),
				pbHTMLString = HTMLstring.match(sRegExPbIdAttr);
			sRegExPbIdAttr = new RegExp('xml:id=(?:"[^"]*"|^[^"]*$)', 'ig');
			var idAttr = pbHTMLString ? pbHTMLString[0].match(sRegExPbIdAttr) : undefined,
				pageId = idAttr ? idAttr[0].replace(/xml:id/, '').replace(/(=|\"|\')/ig, '') : '';
			return pageId;
		};
		/**
		 * @ngdoc method
		 * @name evtviewer.dataHandler.evtNamedEntitiesParser#parseEntitiesOccurrences
		 * @methodOf evtviewer.dataHandler.evtNamedEntitiesParser
		 *
		 * @description
		 * This method will parse all the occurrences of a particular named entity..
		 * - It will use regular expression to find the page breaks before a specific occurence
		 * - For each page break identified, it will retrieve the detailed information already parsed and stored in 
		 * {@link evtviewer.dataHandler.parsedData parsedData}.
		 *
		 * @param {element} docObj XML element representing the document to be parsed
		 * @param {string} refId id of named entity to handle
		 *
		 * @returns {array} array of pages in which the given named entity appears. 
		 * Each page is structured as follows:
			  <pre>
				var page = {
					pageId: ''.
					pageLabel: '',
					docId: '',
					docLabel: ''
				}
			  </pre>
		 * 
		 * @author CDP
		 */
		NEparser.parseEntitiesOccurrences = function (docObj, refId) {
			var doc = docObj && docObj.content ? docObj.content : undefined,
				docHTML = doc ? doc.outerHTML : undefined,
				pages = [];
			if (docHTML && refId && refId !== '') {
				var match = '<pb(.|[\r\n])*?\/>(.|[\r\n])*?(?=#' + refId + ')',
					sRegExInput = new RegExp(match, 'ig'),
					matches = docHTML.match(sRegExInput),
					totMatches = matches ? matches.length : 0;
				for (var i = 0; i < totMatches; i++) {
					//Since JS does not support lookbehind I have to get again all <pb in match and take the last one
					var matchOnlyPb = '<pb(.|[\r\n])*?\/>',
						sRegExOnlyPb = new RegExp(matchOnlyPb, 'ig'),
						pbList = matches[i].match(sRegExOnlyPb),
						pbString = pbList && pbList.length > 0 ? pbList[pbList.length - 1] : '';
					var pageId = getPageIdFromHTMLString(pbString);
					if (pageId) {
						var pageObj = parsedData.getPage(pageId);
						pages.push({
							pageId: pageId,
							pageLabel: pageObj ? pageObj.label : pageId,
							docId: docObj ? docObj.value : '',
							docLabel: docObj ? docObj.label : ''
						});
					}
				}
			}
			return pages;
		};

		return NEparser;
	}]);