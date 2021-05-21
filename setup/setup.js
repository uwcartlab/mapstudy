(function(){

//object to hold all data
var allData = {
	"styles": [],
	"map": [],
	"questions": [],
	"conditions": [],
	"param": {}
};

var totalPages = 0;
var userClicks = 0;

//templates
var optionTemplate = _.template( $('#option-template').html() ),
	dropdownTemplate = _.template( $('#dropdown-template').html() );

/****************** PAGES ******************/

var PageModel = Backbone.Model.extend({
	defaults: {
		pagenum: 1,
		library: 'Leaflet'
	}
});

var pageModels = {};

var PageView = Backbone.View.extend({
	tagName: 'div',
	className: 'page',
	template: _.template( $('#page-template').html() ),
	events: {
		"click .removepage": "removepage",
		"click .addpage": "addpage",
		"click .addDataLayer": "addDataLayer",
		"click .addSet": "addSet",
		"change .library": "setLibrary",
		"change .i-checkbox": "toggleInteraction",
		"change .fullpage": "toggleMaponpage",
		"change .story": "toggleStory",
		"change .maponpage": "toggleFullpage",
		"change .resetSelect": "toggleResetButton",
		"change .reset-p input": "toggleResetButton"
	},
	removepage: function(){
		totalPages-=1;
		//reset page numbering
		this.model.set('pagenum', this.model.get('pagenum')-1);
		//fade out and remove view
		var view = this;
		this.$el.fadeOut(500, function(){
			view.remove();
			//reset numbering of page boxes once element has been removed
			var pagenum = 0;
			$('.page').each(function(){
				pagenum++;

				var view = $(this).backboneView(),
					oldPage = view.model.get('pagenum');

				view.resetPages(oldPage, pagenum);
			});
		});
	},
	addpage: function(){
		var pagenum = this.model.get('pagenum');
		//check if page will be added between existing pages
		if (pagenum < totalPages){
			var oldPage = 0;
			$('.page').each(function(){
				oldPage++;
				//reset page numbering of pages after the added page
				if (this.id[this.id.length - 1] > pagenum){
					var view = $(this).backboneView(),
						newPage = oldPage + 1;

					view.resetPages(oldPage, newPage);
				}
			});
		}
		createPage(pagenum+1);
	},
	resetPages(oldPage, newPage){
		//function to reset page numbering
		
		//set model number to new page number
		this.model.set('pagenum',newPage);	
		//set ID to new page number
		this.$el.attr('id', 'page-' + newPage);
		//replace instances of old page numbering in html element names 
		this.$el.find("[name*='pages." + oldPage + "']").each(function(){
			var name = $(this).attr("name"),
				replace = new RegExp("pages." + oldPage, "g"),
				newName = name.replace(replace, "pages." + newPage);

			$(this).attr("name", newName);
		});
		//replace instances of old page numbering in div ids
		this.$el.find("div").each(function(){						
			var id = $(this).attr("id");
			
			if (id){
				page = new RegExp("page-" + oldPage, "g"),
				section = new RegExp("section-" + oldPage, "g"),
				newId = id.replace(page, "page-" + newPage).replace(section, "section-" + newPage);

				$(this).attr("id", newId);
			}
		});
		//set page value to new page
		this.$el.find("input[name*='pages." + newPage + ".page']").attr("value",newPage);
		//set display numbers to current display value
		this.$el.find('.pagenum').html(newPage);	
					
	},
	setInteractionOptions: function(){
		var loggingTemplate = _.template( $('#interaction-logging-template').html() ),
			pagenum = this.model.get('pagenum');
		this.$el.find('.i-section').each(function(){
			var interaction = $(this).attr('class').split(' ')[0];
			$(this).prepend(loggingTemplate({pagenum: pagenum, interaction: interaction}));
			//hide toggle option and set to true for reset button
			if (interaction == 'reset'){
				$(this).find('.interaction-toggle').hide().find('select').val('true');
			};
			$(this).find('input, select').attr('disabled', true);
			$(this).hide();
		});
	},
	toggleInteraction: function(e){
		var isection = $(e.target).parent().parent().find('.i-section');
		if (e.target.checked){
			isection.find('input, select').removeAttr('disabled');
			isection.slideDown(250);
		} else {
			isection.slideUp(250);
			isection.find('input, select').attr('disabled', true);
		};
	},
	toggleMaponpage: function(e){
		if (e.target.value == "true"){
			this.$el.find('.maponpage').val("false").trigger("change");
		} else {
			this.$el.find('.maponpage').val("true").trigger("change");
		}
	},
	toggleFullpage: function(e){
		if (e.target.value == "true"){
			this.$el.find('.fullpage').val("false");
		} else {
			this.$el.find('.fullpage').val("true");
		}
	},
	toggleStory: function(e){
		$('#page-'+this.model.get('pagenum')+' .set-buttons').find('input[type=hidden]').val("")
		if (e.target.value == "true"){
			$('#q-section-' + this.model.get('pagenum')).css("display","none");
			$('#q-section-' + this.model.get('pagenum'));
			$('#page-'+this.model.get('pagenum')).find('.input-yn').val("false").trigger("change");
			var curStoryBlocks = $('#s-section-' + this.model.get('pagenum') + '-story').find('.story-blocks');
			if (curStoryBlocks.length == 0){
				createStorySet(this.model.get('pagenum'), 0);	
			}
		} else {
			$('.q-section').css("display","block");
			$('#page-'+this.model.get('pagenum')).find('.input-yn').val("true").trigger("change");
		}
	},
	toggleResetButton: function(e){
		if ($(e.target).attr('class').indexOf('resetSelect') > -1){
			if (e.target.value == 'true'){
				this.$el.find('.reset-p input').prop('checked', true).trigger('change')
			} else {
				this.$el.find('.reset-p input').removeAttr('checked').trigger('change');
			};
		} else {
			if (e.target.checked){
				this.$el.find('.resetButton select').val('true');
			} else {
				this.$el.find('.resetButton select').val('false');
			};
		};
	},
	setLibrary: function(library){
		//extract name of library from select change event
		if (typeof library == 'object'){
			library = $(library.target).val();
		};
		this.model.set('library', library);

		//set map options
		var mapOptionsTemplate = _.template( $('#'+library+"-map-options-template").html() );
		this.$el.find('.map-options-inputs').html(mapOptionsTemplate({pagenum: this.model.get('pagenum')}));

		var display = $(".baseLayers").css("display");

		if (library != 'Leaflet'){
			this.$el.find(".baseLayers").css("display", "none");
			this.$el.find(".dataLayers").css("display", "none");
			this.$el.find(".interactions").css("display", "none");
			this.$el.find(".map-header").css("display", "none");
		}
		else {
			this.$el.find(".baseLayers").css("display", "block");
			this.$el.find(".dataLayers").css("display", "block");
			this.$el.find(".interactions").css("display", "block");
			this.$el.find(".map-header").css("display", "block");

		}

		this.setInteractionOptions();
	},
	addDataLayer: function(){
		//add data layer options
		var pagenum = this.model.get('pagenum');
		createLayer(pagenum,"dataLayer", 0);
		this.$el.find('.addDataLayer').hide();
	},
	render: function(){
		//create page div
		var pagenum = this.model.get('pagenum');
		this.$el.attr('id', 'page-'+pagenum);
		this.$el.html(this.template({pagenum: pagenum}));

		//add page div to page container
		if (pagenum < totalPages){
			$("#page-" + (pagenum-1)).after(this.$el[0])
		}
		else{
			$('#page-container').append(this.$el[0]);
		}

		//add initial base layer options
		createLayer(pagenum,"baseLayer", 0);

		//add initial question set options
		createSet(pagenum,0);

		//set initial map options
		this.setLibrary('Leaflet');

		//add options to boolean dropdown menus
		this.$el.find('.bdd').each(function(){
			createBooleanDropdown($(this));
		});
		this.$el.find('.displayonyes').hide();

		//make remove button invisible if the first page
		var display = pagenum > 1 ? "inline-block" : "none";
		this.$el.children('.removepage').css('display', display);

		//hide interaction data layers divs
		this.$el.find('.interaction-dataLayers').hide();

		return this;
	}
});

var BaseLayerView = Backbone.View.extend({
	tagName: 'div',
	className: 'baseLayer',
	template: _.template( $('#baseLayer-template').html() ),
	events: {
		"click .removelayer": "removeLayer",
		"click .addlayer": "addLayer",
		"change .layer-source-select": "changeSourceType",
		"keyup .layerName": "addInteractionLayers"
	},
	i: 0,
	sourceLinks: {
		Leaflet: {
			link: "http://leaflet-extras.github.io/leaflet-providers/preview/",
			example: "http://{s}.tile.stamen.com/toner-lite/{z}/{x}/{y}.png"
		}
		//add other libraries...
	},
	removeLayer: function(){
		//reset layer numbering
		this.i--
		//fade out and remove view
		var view = this,
			pagenum = this.model.get('pagenum'),
			mapsection = $('#m-section-'+pagenum+'-map');
		this.$el.fadeOut(500, function(){
			view.remove();
			mapsection.find('.i-dataLayer-'+(view.i+1)).remove();
			//reveal data layer add button if last data layer removed
			if (mapsection.find('.'+view.className).length == 0){
				mapsection.find('.addDataLayer').show();
				//hide interaction data layers divs
				mapsection.find('.interaction-dataLayers').hide();
			};
			//reset numbering of layers once element has been removed
			var l = mapsection.find('.'+view.className).length;
			mapsection.find('.'+view.className).each(function(i){
				$(this).attr('id', 'page-'+pagenum+'-'+view.className+'-'+i);
				$(this).find('.layernumber').html(i+1);
				//replace any i character in input/textarea names
				$(this).find('input, textarea').each(function(){
					if (typeof $(this).attr('name') !== 'undefined'){
						var name = $(this).attr('name').replace(/\[[0-9]\]/g, '['+i+']');
						$(this).attr('name', name);
					}
				});
				//reveal add button if the last layer
				if (i == l-1){
					$(this).find('.addlayer').show();
				};
				//hide remove button if the only base layer
				if (view.className == 'baseLayer' && l == 1){
					$(this).find('.removelayer').hide();
				};
			});
		});
	},
	addLayer: function(){
		var pagenum = this.model.get('pagenum');
		this.i = parseInt(this.$el.find('.layernumber').html())-1;
		this.$el.find('.addlayer').hide();
		this.$el.find('.removelayer').show();
		createLayer(pagenum,this.className, this.i+1);
	},
	changeSourceType: function(e){
		//dynamically change source type
		var view = this,
			sourceInput = this.$el.find('.layer-source-input');
		//clear any pre-existing value and event listener
		sourceInput.val('').off('keyup');
		//build timeout for prepending postgis: to table name
		function timeoutFunc(){
			var inputVal = sourceInput.val();
			if (inputVal.indexOf('postgis:') == -1){
				sourceInput.val('postgis:'+inputVal);
			}
		};
		var timeout = window.setTimeout(timeoutFunc, 1000);
		window.clearTimeout(timeout);
		//select which one
		if ($(e.target).val() == 'url'){
			sourceInput.attr({
				placeholder: 'example: '+view.sourceUrlExample
			});
		} else if ($(e.target).val() == 'provider-name') {
			sourceInput.attr({
				placeholder: 'example: Stamen.TonerLite'
			});
		} else if ($(e.target).val() == 'postgis') {
			sourceInput.attr({
				placeholder: 'table name'
			});
			//prepend postgis: to table name after typing
			sourceInput.on('keyup', function(){
				window.clearTimeout(timeout);
				timeout = window.setTimeout(timeoutFunc, 1000);
			});
		}
	},
	removeButton: function(){
		//make remove button invisible if the first layer
		var display = this.i > 0 ? "inline-block" : "none";
		this.$el.children('.removelayer').css('display', display);
	},
	addInteractionLayers: function(e){
		var pagenum = this.model.get('pagenum'),
			i = this.i,
			layerName = e.target.value,
			mapsection = $('#m-section-'+pagenum+'-map');

		var InteractionDataLayersModel = Backbone.Model.extend();

		var InteractionDataLayersView = Backbone.View.extend({
			tagName: 'div',
			template: _.template( $('#interaction-dataLayer-template').html() ),
			events: {
				'change input[type=checkbox]': "changeInput",
				'namechange span': "changeLayerName"
			},
			changeInput: function(e){
				var checked = e.target.checked,
					layerName = this.$el.find('.dataLayer-layerName').html(),
					hiddenInput = this.$el.parent().find('input[type=hidden]');
					var includedLayers;
				//if there are value(s)
				if(hiddenInput.val()){
					includedLayers = hiddenInput.val().split(",");
				} //otherwise create empty array
				else {
					includedLayers = [];
				}
				//if checked add the new layer if not already there
				if (checked){
					if(_.indexOf(includedLayers,layerName) == -1){
						includedLayers.push(layerName);
					}
				}  //otherwise remove the layer
				else {
					includedLayers = _.without(includedLayers,layerName);
					hiddenInput.removeAttr('value');
				};
				//set value to included layers or remove if none
				if(includedLayers.length>0) {
					hiddenInput.val(includedLayers.join(","));
				} else {
					hiddenInput.removeAttr("value");
				}
			},
			changeLayerName: function(e, layerName){
				this.$el.find('.dataLayer-layerName').html(layerName);
				this.changeInput({target: this.$el.find('input[type=checkbox]')[0]});
			},
			render: function(){
				this.$el.append(this.template(this.model.attributes));
				this.$el.attr('class', "interaction-dataLayer i-dataLayer-"+this.model.get('i') + " " + this.model.attributes.layerName.replace(/ /g, ""));
				//uncheck checkbox to start
				this.$el.find("input").prop("checked", false);
				mapsection.find('.'+this.model.get('interaction')+' .interaction-dataLayers').append(this.el);
			}
		})

		if (this.className == "dataLayer"){
			mapsection.find('.interaction-dataLayers').each(function(){
				$(this).show();
				var interaction = $(this).parent().attr('class').split(' ')[0];
				var interactionDataLayersModel = new InteractionDataLayersModel({
					i: i,
					layerName: e.target.value,
					interaction: interaction,
					pagenum: pagenum
				});
				if ($(this).find('.i-dataLayer-'+i).length == 0){
					var interactionDataLayersView = new InteractionDataLayersView({
						model: interactionDataLayersModel
					});
					interactionDataLayersView.render();
				} else {
					$(this).find('.i-dataLayer-'+i).find('span').trigger('namechange', [layerName]);
				};
			});
		};
	},
	setSourceLink: function(){
		//get library
		var library = this.model.get('library');
		//set visibility of provider-name option
		if (this.className == 'baseLayer' && library == 'Leaflet'){
			this.$el.find('option[value=provider-name]').show();
		} else {
			this.$el.find('option[value=provider-name]').hide();
		};
		//set placeholder
		this.sourceUrlExample = this.sourceLinks[library].example;
		//set source link
		this.$el.find('.sourcelink').attr('href', this.sourceLinks[library].link);
	},
	setLayerOptions: function(){
		//set layer options
		var library = this.model.get('library'),
			layerOptionsTemplate = _.template( $('#'+library+"-"+this.className+"-options-template").html() );
		this.$el.find('.layer-options-inputs').html(layerOptionsTemplate({pagenum: this.model.get('pagenum'), i: this.i}));

		this.setSourceLink();

		this.$el.find('.layer-source-input').attr('placeholder', 'ex: '+this.sourceUrlExample);
	},
	render: function(){
		//create layer div
		var pagenum = this.model.get('pagenum'),
			className = this.className;
		this.$el.attr({
			id: 'page-'+pagenum+'-'+this.className+'-'+this.i,
			class: className + ' subsection'
		});
		this.$el.html(this.template({pagenum: this.model.get('pagenum'), i: this.i}));
		
		this.setLayerOptions();

		//add options to boolean dropdown menus
		this.$el.find('.bdd').each(function(){
			createBooleanDropdown($(this));
		});
		this.$el.find('.displayonyes').hide();

		this.removeButton();

		//add layer div to page's baseLayers/dataLayers container
		$('#page-'+pagenum+' .'+this.className+'s').append(this.$el[0]);

		//add visualization techniques
		createTechnique(pagenum,this.i, 0);

		return this;
	}
});

var DataLayerView = BaseLayerView.extend({
	className: 'dataLayer',
	template: _.template( $('#dataLayer-template').html() ),
	sourceLinks: {
		Leaflet: {
			link: "http://geojson.org/geojson-spec.html",
			example: "data/geography.geojson"
		}
		//add other libraries...
	},
	removeButton: function(){}
});

var TechniqueView = Backbone.View.extend({
	tagName: 'div',
	className: 'technique',
	template: _.template( $('#technique-template').html() ),
	events: {
		"click .removetechnique": "removeTechnique",
		"click .addtechnique": "addTechnique",
		"change .technique-type": "changeTechniqueType",
		"change .technique-classification": "changeClassification",
		"change .technique-n-classes": "changeNClasses",
		"change .technique-symbol": "changeSymbol"
	},
	i: 0,
	ii: 0,
	changeTechniqueType: function(techniqueType){
		//get value from event target
		if (typeof techniqueType == 'object'){
			techniqueType = techniqueType.target.value;
		};

		var l = this.$el,
			pagenum = this.model.get('pagenum'),
			i = this.i,
			ii = this.ii,
			changeClassification = this.changeClassification,
			changeNClasses = this.changeNClasses,
			changeSymbol = this.changeSymbol;

		l.find('.technique-type').val(techniqueType);

		//object to hold descriptions and form modification function for each technique type
		var techniques = {
			choropleth: {
				desc: "Colors geographic units according to data values in the expressed attribute. Data must have polygon or multipolygon geometries.",
				modifyForm: function(){
					//show/hide form options
					l.find('input, select').removeAttr('disabled');
					l.find('.technique-classification-p').show().find('select').val('natural breaks');
					l.find('.technique-n-classes-p').show().find('select').val('5');
					l.find('.technique-symbol-p, .technique-interval-p, .technique-size-p').hide().find('input, select').attr('disabled', true);
					//add color scale to classes div
					var colorScaleTemplate = _.template( $('#color-scale-classes-template').html() );
					l.find('.technique-classes').html(colorScaleTemplate({pagenum: pagenum, i: i, ii: ii}));
					//call next method
					changeClassification('natural breaks', l, changeNClasses);
				}
			},
			'proportional symbol': {
				desc: "Adds a symbol (typically a circle) on top of each geographic unit and sizes the symbol according to data values in the expressed attribute. Data may have point or polygon/multipolygon geometries; if polygon/multipolygon, symbols will be placed at the centroid of each geographic unit.",
				modifyForm: function(){
					//show/hide form options
					l.find('input, select').removeAttr('disabled');
					l.find('.technique-classification-p').show().find('select').val('unclassed');
					l.find('.technique-symbol-p').show().find('select').val('circle');
					l.find('.technique-interval-p, .technique-size-p').hide().find('input, select').attr('disabled', true);
					//add symbol radii to classes div
					var symbolRadiiTemplate = _.template( $('#radii-classes-template').html() );
					l.find('.technique-classes').html(symbolRadiiTemplate({pagenum: pagenum, i: i, ii: ii}));
					//call next methods
					changeClassification('unclassed', l, changeNClasses);
					changeSymbol('circle', l);
				}
			},
			dot: {
				desc: "Randomly places dots within each geographic unit, with the number of dots a ratio to the data values in the expressed attribute. Data must have polygon or multipolygon geometries.",
				modifyForm: function(){
					//show/hide form options
					l.find('input, select').removeAttr('disabled');
					l.find('.technique-interval-p').show().find('input').val('10');
					l.find('.technique-size-p').show().find('input').val('1');
					l.find('.technique-classification-p, .technique-n-classes-p, .technique-symbol-p').hide().find('input, select').attr('disabled', true);
					l.find('.technique-classes, .classification-type-desc').empty();
					l.find('.interval-ratio').html('Dot ratio: 1:');
					l.find('.dot-line-size').html('Dot size: ');
				}
			},
			isarithmic: {
				desc: "Creates contour lines based on interpolation of data values in the expressed attribute, with the frequency of lines determined by the isarithm interval. Only the value of each line can be retrieved by the user.",
				modifyForm: function(){
					//show/hide form options
					l.find('input, select').removeAttr('disabled');
					l.find('.technique-interval-p').show().find('input').val('10');
					l.find('.technique-size-p').show().find('input').val('1');
					l.find('.technique-classification-p, .technique-n-classes-p, .technique-symbol-p').hide().find('input, select').attr('disabled', true);
					l.find('.technique-classes, .classification-type-desc').empty();
					l.find('.interval-ratio').html('Line interval: ');
					l.find('.dot-line-size').html('Isarithm width: ');
				}
			},
			heat: {
				desc: "Creates a heatmap based on data values and distances between data points. The heatmap is a raster surface, so retrieve interactions are not available.",
				modifyForm: function(){
					//show/hide form options
					l.find('input, select').removeAttr('disabled');
					l.find('.technique-size-p').show().find('input').val('1');
					l.find('.technique-classification-p, .technique-n-classes-p, .technique-symbol-p, .technique-interval-p').hide().find('input, select').attr('disabled', true);
					l.find('.technique-classes, .classification-type-desc').empty();
					l.find('.dot-line-size').html('Point radius: ');
				}
			},
			label: {
				desc: "A label data layer will place labels on the map for each feature expressing the layer's first display attribute, either adjacent to the feature if point data or centered within the feature if polygons.",
				modifyForm: function(){
					//show/hide form options
					l.find('input, select').removeAttr('disabled');
					l.find('.technique-size-p').show().find('input').val('1');
					l.find('.technique-classification-p, .technique-n-classes-p, .technique-symbol-p, .technique-interval-p').hide().find('input, select').attr('disabled', true);
					l.find('.technique-classes, .classification-type-desc').empty();
					l.find('.dot-line-size').html('Label size: ');
				}
			}
		};
		//implement form changes
		this.$el.find('.technique-type-desc').html(techniques[techniqueType].desc);
		techniques[techniqueType].modifyForm();

	},
	changeClassification: function(classification, l, changeNClasses){
		//get value from event target
		if (typeof classification == 'object'){
			classification = classification.target.value;
		};
		l = l || this.$el;
		changeNClasses = changeNClasses || this.changeNClasses;

		function modifyForm(){
			//revert to 5 classes and reset classification
			l.find('.technique-n-classes-p').show().find('select').val("5");
			l.find('.technique-custom-classes').hide();
			changeNClasses("5", l);
		};

		//object to hold descriptions and form modifications for each classification type
		var classifications = {
			quantile: {
				desc: "Groups the expressed data into classes with an equal number of data values in each class.",
				modifyForm: modifyForm
			},
			'equal interval': {
				desc: "Groups the expressed data into classes each with an equal range of values (e.g., 0-10, 10-20, 20-30, etc.).",
				modifyForm: modifyForm
			},
			'natural breaks': {
				desc: "Uses the Cartesian k-means algorithm to minimize the statistical distances between data points within each class.",
				modifyForm: modifyForm
			},
			unclassed: {
				desc: "Interpolates an output value for each expressed data value based on that value's location on a scale between the minimum and maximum values.",
				modifyForm: function(){
					l.find('.technique-n-classes-p').hide().find('select').val("2");
					l.find('.technique-custom-classes').hide();
					changeNClasses("2", l);
				}
			},
			'user defined': {
				desc: "Define custom class breaks",
				modifyForm: function(){
					modifyForm()
					l.find('.technique-custom-classes').show();
				}
			},
		};
		//implement form changes
		l.find('.classification-type-desc').html(classifications[classification].desc);
		classifications[classification].modifyForm();
	},
	changeNClasses: function(nClasses, l){


		//get value from event target
		if (typeof nClasses == 'object'){
			nClasses = nClasses.target.value;
		};
		l = l || this.$el;

		l.find('.technique-n-classes').val(nClasses);

		//implement type of classification
		if (l.find('.technique-type').val() == 'choropleth'){
			//clean out select options
			l.find('.color-classes').empty();
			//get templates
			var colorOptionTemplate = _.template( $('#color-scale-option-template').html() ),
				colorSwatchTemplate = _.template( $('#color-swatch-template').html() );
			//add options for each colorbrewer class
			_.each(colorbrewer, function(colors, colorcode){
				if (colors[parseInt(nClasses)] || nClasses == "2"){
					//assign colorBrewer array, code
					var val = colorcode+'.'+nClasses,
						max = parseInt(nClasses) > 8 ? parseInt(nClasses) : 8,
						colorArray = nClasses == '2' ? [colors[max][0], colors[max][max-1]] : colors[parseInt(nClasses)];
					//add option for the colorbrewer class
					l.find('.color-classes').append(colorOptionTemplate({colorcode: val}));
					//add swatches for each color in the class to the option
					_.each(colorArray, function(fillColor){
						l.find('option[value="'+val+'"]').text(val);
						l.find('option[value="'+val+'"]').append(colorSwatchTemplate({fillColor: fillColor}));
					});
				};
			});
		} else if (l.find('.technique-type').val() == 'proportional symbol'){
			//clean out radii inputs table
			l.find('.radii-classes').html('<td class="l-align">Symbol radii:</td>');
			l.find('.radii-minmax').html('<td></td>');
			//get templates
			var radiusTemplate = _.template( $('#symbol-radius-template').html() );
			//get i and ii
			var id = l.attr('id').split('-'),
				i = id[3],
				ii = id[5];
			//add input for each radius class
			for (var a=0; a<parseInt(nClasses); a++){
				var pageNum = l.closest(".page").attr("id").replace("page-", "");
				l.find('.radii-classes').append(radiusTemplate({pagenum: pageNum, i: i, ii: ii, c: a}));
				var cell;
				if (a == 0){
					cell = '<td class="l-align">min</td>';
				} else if (a == parseInt(nClasses)-1){
					cell = '<td class="l-align">max</td>';
				} else {
					cell = '<td></td>';
				};
				l.find('.radii-minmax').append(cell);
			}
		};
	},
	changeSymbol: function(symbol, l){
		//get value from event target
		if (typeof symbol == 'object'){
			symbol = symbol.target.value;
		};
		l = l || this.$el;

		if (l.find('.technique-symbol').val() == 'circle'){
			l.find('.technique-symbol-url').attr({
				type: 'hidden',
				value: 'circle'
			});
		} else {
			l.find('.technique-symbol-url').attr({
				type: 'text',
				value: '',
				placeholder: 'ex.: img/square.png'
			});
		};
	},
	removeTechnique: function(){
		//reset technique numbering
		this.ii--
		//fade out and remove view
		var view = this,
			pagenum = this.model.get('pagenum'),
			layer = $('#page-'+pagenum+'-dataLayer-'+this.i);
		this.$el.fadeOut(500, function(){
			view.remove();
			//reset numbering of layers once element has been removed
			var l = layer.find('.technique').length;
			layer.find('.technique').each(function(ii){
				$(this).attr('id', 'page-'+pagenum+'-dataLayer-'+view.i+'-technique-'+ii);
				$(this).find('.techniquenumber').html(ii+1);
				//replace any ii character in input/textarea names
				$(this).find('input, textarea').each(function(){
					if (typeof $(this).attr('name') !== 'undefined'){
						var name = $(this).attr('name').replace(/\[[0-9]\](?![\s\S]*\[)/, '['+ii+']');
						$(this).attr('name', name);
					}
				});
				//reveal add button if the last technique
				if (ii == l-1){
					$(this).find('.addtechnique').show();
				};
				//hide remove button if the only technique
				if (l == 1){
					$(this).find('.removetechnique').hide();
				};
			});
		});
	},
	addTechnique: function(){
		var pagenum = this.model.get('pagenum');
		this.ii = parseInt(this.$el.find('.techniquenumber').html())-1;
		this.$el.find('.addtechnique').hide();
		this.$el.find('.removetechnique').show();
		createTechnique(pagenum,this.i, this.ii+1);
	},
	removeButton: function(){
		//make remove button invisible if the first layer
		var display = this.ii > 0 ? "inline-block" : "none";
		this.$el.children('.removetechnique').css('display', display);
	},
	render: function(){
		//create technique div
		var pagenum = this.model.get('pagenum');
		this.$el.attr({
			id: 'page-'+pagenum+'-dataLayer-'+this.i+'-technique-'+this.ii,
			class: 'technique subsection'
		});
		this.$el.html(this.template({pagenum: pagenum, i: this.i, ii: this.ii}));

		this.removeButton();

			this.changeTechniqueType('choropleth');
			this.changeNClasses('5', this.$el);
		
		//add layer div to layer's techniques container
		$('#page-'+pagenum+'-dataLayer-'+this.i+' .layer-techniques').append(this.$el[0]);
		return this;
	}
});

var LayerViews = {
	baseLayer: BaseLayerView,
	dataLayer: DataLayerView
};

var SetView = Backbone.View.extend({
	tagName: 'div',
	template: _.template( $('#set-template').html() ),
	events: {
		"change .set-button": "setButtons",
		"click .addset": "addSet",
		"click .removeset": "removeSet"
	},
	i: 0,
	setButtons: function(e){
		var input = e.target,
			buttonName = $(input).attr('class').split(' ')[1],
			hidden = $(input).parent().parent().find('input[type=hidden]'),
			includedButtons = hidden.val().split(',');
		//remove blank values
		includedButtons = _.without(includedButtons, '');
		//add or subtract button from array
		if (input.checked){
			if (_.indexOf(includedButtons, buttonName) == -1){
				includedButtons.push(buttonName);
			};
		} else {
			includedButtons = _.without(includedButtons, buttonName);
		};
		hidden.val(includedButtons.join(','));
	},
	removeButton: function(){
		//make remove button invisible if the first set
		var display = this.i > 0 ? "inline-block" : "none";
		this.$el.children('.removeset').css('display', display);
	},
	removeSet: function(){
		//reset layer numbering
		this.i--
		//fade out and remove view
		var view = this,
			pagenum = this.model.get('pagenum'),
			qsection = $('#q-section-'+pagenum);
		this.$el.fadeOut(500, function(){
			view.remove();
			//reset numbering of sets once element has been removed
			var l = qsection.find('.set').length;
			qsection.find('.set').each(function(i){
				$(this).attr('id', 'page-'+pagenum+'-set-'+i);
				$(this).find('.setnumber').html(i+1);
				//replace any i character in input/textarea names
				$(this).find('.block').each(function(){
					var find = new RegExp("set-" + i+1, "g"),
						id = $(this).attr('id').replace(find, "set-" + i);
					
					$(this).attr('id', id);
				});
				$(this).find('input, textarea').each(function(){
					if (typeof $(this).attr('name') !== 'undefined'){
						var find = new RegExp("sets." + (i+1), "g"),
							name = $(this).attr('name').replace(find, "sets." + i);

						$(this).attr('name', name);
					}
				});
				//hide remove button if the only set
				if (l == 1){
					$(this).find('.removebutton').hide();
				};
			});
		});
	},
	addSet: function(){
		//var pagenum = this.model.get('pagenum');
		this.i = parseInt(this.$el.find('.setnumber').html());
		var set = this.i;

		//this.$el.find('.addset').hide();
		var view = this,
			pagenum = this.model.get('pagenum'),
			qsection = $('#q-section-'+pagenum),
			l = qsection.find('.set').length;

		if (set < l){
			qsection.find('.set').each(function(i){
				if (i >= set){
					$(this).attr('id', 'page-'+pagenum+'-set-'+(i+1));
					$(this).find('.setnumber').html(i+2);
					//replace any i character in input/textarea names
					$(this).find('.block').each(function(){
						var find = new RegExp("set-" + i, "g"),
							id = $(this).attr('id').replace(find, "set-" + (i+1));
						
						$(this).attr('id', id);
					});
					$(this).find('input, textarea').each(function(){
						if (typeof $(this).attr('name') !== 'undefined'){
							var find = new RegExp("sets." + i, "g"),
								name = $(this).attr('name').replace(find, "sets." + (i+1));

							$(this).attr('name', name);
						}
					});
				}
			});
		}
		if (this.i == 1){
			this.$el.find('.removeset').show();
		}
		
		createSet(pagenum,this.i);
	},
	render: function(){
		//create technique div
		var pagenum = this.model.get('pagenum');
		this.$el.attr({
			id: 'page-'+pagenum+'-set-'+this.i,
			class: 'set subsection'
		});
		this.$el.html(this.template({pagenum: pagenum, i: this.i}));

		this.removeButton();

		var l = $('#q-section-'+pagenum).find('.set').length;
		//add page div to page container
		if (this.i < l){
			$('#page-'+pagenum+'-set-'+(this.i-1)).after(this.$el[0])
		}
		else{
			//add layer div to layer's sets container
			$('#page-'+pagenum+' .sets').append(this.el);
		}

		//add initial block options
		createBlock(pagenum,this.i, 0);

		return this;
	}
});

var BlockView = Backbone.View.extend({
	tagName: 'div',
	template: _.template( $('#block-template').html() ),
	events: {
		"click .addblock": "addBlock",
		"click .removeblock": "removeBlock",
		"change .input-type-select": "toggleInputType",
		"change .autoadv select": "toggleRequired",
		"change .reqd select": "toggleRequired",
	},
	i: 0,
	ii: 0,
	toggleInputType: function(e){
		var inputType = e.target.value,
			parent = $(e.target).parent().parent(),
			autoadv = parent.find('.autoadv'),
			optionsDiv = parent.find('.options-div'),
			itemsDiv = parent.find('.items-div');

		//determine display of input options based on input type
		if (inputType == 'radios' || inputType == 'dropdown' || inputType == 'matrix'){
			optionsDiv.show();
			optionsDiv.find('input').removeAttr('disabled');
			if (this.ii == $('#page-'+this.model.get('pagenum')+'-set-'+this.i+' .input').length-1){
				autoadv.show();
				autoadv.find('select').removeAttr('disabled');
			}
		} else {
			autoadv.hide();
			autoadv.find('select').attr('disabled', true);
			optionsDiv.hide();
			optionsDiv.find('input').attr('disabled', true);
		};

		//determine display of input items based on input type
		if (inputType == 'checkboxes' || inputType == 'matrix' || inputType == 'rank'){
			itemsDiv.show();
			itemsDiv.find('input').removeAttr('disabled');
		} else {
			itemsDiv.hide();
			itemsDiv.find('input').attr('disabled', true);
		};
	},
	toggleRequired: function(e){
		var parent = $(e.target).parent()[0],
			value = $(e.target).val();
		//if auto-advance is true, required must be true; if required is false, auto-advance must be false
		if ((parent.className == 'reqd q' && value == 'false') || (parent.className == 'autoadv q' && value == 'true')){
			$(parent).parent().find('.reqd select, .autoadv select').val(value);
		};
	},
	removeButton: function(){
		//make remove button invisible if the first set
		var display = this.ii > 0 ? "inline-block" : "none";
		this.$el.children('.removeset').css('display', display);
	},
	removeBlock: function(){
		//reset block numbering
		this.ii--
		//fade out and remove view
		var view = this,
			pagenum = this.model.get('pagenum'),
			set = $('#page-'+pagenum+'-set-'+this.i);
		this.$el.fadeOut(500, function(){
			view.remove();
			//reset numbering of sets once element has been removed
			var l = set.find('.block').length;
			set.find('.block').each(function(ii){
				$(this).attr('id', 'page-'+pagenum+'-set-'+view.i+'-block-'+ii);
				$(this).find('.blocknumber').html(ii+1);
				//replace any i character in input/textarea names
				$(this).find('input, textarea').each(function(){
					if (typeof $(this).attr('name') !== 'undefined'){
						var find = new RegExp("blocks." + (ii+1), "g"),
							name = $(this).attr('name').replace(find, "blocks." + ii);

						$(this).attr('name', name);
					}
				});
				//hide remove button if the only set
				if (l == 1){
					$(this).find('.removebutton').hide();
				};
			});
		});
		//show auto-advance if last block's input is set to radio, dropdown, or matrix
		var prevBlock = $('#'+'page-'+pagenum+'-set-'+this.i+'-block-'+this.ii),
			selectVal = prevBlock.find('.input-type-select').val();
		if (selectVal == 'radios' || selectVal == 'dropdown' || selectVal == 'matrix'){
			prevBlock.find('.autoadv').show().find('select').removeAttr('disabled');
		};
	},
	addBlock: function(){
		var pagenum = this.model.get('pagenum'),
			set = parseInt(this.$el.find('.setnumber').html()),
			ssection = $('#page-'+pagenum+"-set-"+(set-1)),
			l = ssection.find('.block').length;

		this.ii = parseInt(this.$el.find('.blocknumber').html());
		var block = this.ii;

		if (block < l){
			ssection.find('.block').each(function(ii){
				if (ii >= block){
					$(this).attr('id', 'page-'+pagenum+'-set-'+set+'-block-'+(ii+1));
					$(this).find('.blocknumber').html(ii+2);

					$(this).find('input, textarea').each(function(){
						if (typeof $(this).attr('name') !== 'undefined'){
							var find = new RegExp("blocks." + ii, "g"),
								name = $(this).attr('name').replace(find, "blocks." + (ii+1));

							$(this).attr('name', name);
						}
					});
				}
			})
		}

		this.$el.find('.autoadv').find('select').attr('disabled', true);
		this.$el.find('.removebutton').show();
		createBlock(pagenum,this.i, this.ii);
	},
	render: function(){
		//create technique div
		var pagenum = this.model.get('pagenum');
		this.$el.attr({
			id: 'page-'+pagenum+'-set-'+this.i+'-block-'+this.ii,
			class: 'block subsection'
		});
		this.$el.html(this.template({pagenum: pagenum, i: this.i, ii: this.ii}));

		this.removeButton();

		var l = $('#page-'+pagenum+"-set-"+this.i).find('.block').length;
		//add page div to page container
		if (this.ii < l){
			$('#page-'+pagenum+'-set-'+this.i+'-block-'+(this.ii-1)).after(this.$el[0]);
		}
		else{
			//add layer div to layer's sets container
			$('#page-'+pagenum+'-set-'+this.i+' .blocks').append(this.el);
		}
		//add options to boolean dropdown menus
		this.$el.find('.bdd').each(function(){
			createBooleanDropdown($(this));
		});
		this.$el.find('.displayonyes').hide();

		//hide options and items initially
		this.toggleInputType({target: this.$el.find('.input-type-select')[0]});

		//add option and item properties
		createOptionItem(pagenum,this.i, this.ii, 0, 'option');
		createOptionItem(pagenum,this.i, this.ii, 0, 'item');

		return this;
		}
	
});

var StorySetView = Backbone.View.extend({
	tagName: 'div',
	template: _.template( $('#story-set-template').html() ),
	events: {
		"change .story-set-button": "setButtons",
	},
	i: 0,
	setButtons: function(e){
		var input = e.target,
			pagenum = this.model.get('pagenum'),
			buttonName = $(input).attr('class').split(' ')[1],
			hidden = $('#page-'+pagenum+' .set-buttons').find('input[type=hidden]'),
			includedButtons = hidden.val().split(',');
		//remove blank values
		includedButtons = _.without(includedButtons, '');
		//add or subtract button from array
		if (input.checked){
			if (_.indexOf(includedButtons, buttonName) == -1){
				includedButtons.push(buttonName);
			};
		} else {
			includedButtons = _.without(includedButtons, buttonName);
		};
		hidden.val(includedButtons.join(','));
	},
	render: function(){
		//create technique div
		var pagenum = this.model.get('pagenum');
		this.$el.attr({
			id: 'page-'+pagenum+'-set-'+this.i,
			class: 'set subsection'
		});
		this.$el.html(this.template({pagenum: pagenum, i: this.i}));
		//add layer div to layer's sets container
		$('#page-'+pagenum+' .story-sets').append(this.el);
		//add initial block options
		createStoryBlock(pagenum,this.i, 0);

		return this;
	}
});

var StoryBlockView = Backbone.View.extend({
	tagName: 'div',
	template: _.template( $('#story-block-template').html() ),
	events: {
		"click .addblock": "addBlock",
		"click .removeblock": "removeBlock",
	},
	i: 0,
	ii: 0,
	removeButton: function(){
		//make remove button invisible if the first set
		var display = this.ii > 0 ? "inline-block" : "none";
		this.$el.children('.removeblock').css('display', display);
	},
	removeBlock: function(){
		//reset block numbering
		this.ii--;
		//fade out and remove view
		var view = this,
			pagenum = view.model.get('pagenum'),
			set = $('.story-blocks');
		this.$el.fadeOut(500, function(){
			view.remove();
			//reset numbering of sets once element has been removed
			var l = $('.story-blocks').find('.block').length - 1;
			set.find('.block').each(function(ii){
				$(this).attr('id', 'page-'+pagenum+'-set-'+view.i+'-block-'+ii);
				$(this).find('.blocknumber').html(ii+1);
				//reveal add button if the last set
				if (ii == l){
					$(this).find('.addbutton').show();
				};
				//hide remove button if the only set
				if (l == 0){
					$(this).find('.removebutton').hide();
				};
			});
		});
	},
	addBlock: function(){
		var pagenum = this.model.get('pagenum');
		this.ii = parseInt(this.$el.find('.blocknumber').html())-1;
		this.$el.find('.addbutton, .autoadv').hide();
		this.$el.find('.autoadv').find('select').attr('disabled', true);
		this.$el.find('.removebutton').show();
		createStoryBlock(pagenum, this.i, this.ii+1);
	},
	render: function(){
		//create technique div
		var pagenum = this.model.get('pagenum');
		this.$el.attr({
			id: 'page-'+pagenum+'-set-'+this.i+'-block-'+this.ii,
			class: 'block subsection'
		});
		this.$el.html(this.template({pagenum: pagenum, i: this.i, ii: this.ii}));

		this.removeButton();

		//add layer div to layer's sets container
		$('#page-'+pagenum+'-set-'+this.i+' .story-blocks').append(this.el);

		this.$el.find('.bdd').each(function(){
			createBooleanDropdown($(this));
		});
		this.$el.find('.displayonyes').hide();


		return this;
	}
});

var OptionView = Backbone.View.extend({
	tagName: 'div',
	className: 'option',
	template: _.template( $('#input-option-template').html() ),
	events: {
		"click .addoption": "addView",
		"click .removeoption": "removeView"
	},
	i: 0,
	ii: 0,
	iii: 0,
	removeButton: function(){
		//make remove button invisible if the first set
		var display = this.ii > 0 ? "inline-block" : "none";
		this.$el.children('.removeset').css('display', display);
	},
	removeView: function(){
		//reset option numbering
		this.iii--
		//fade out and remove view
		var view = this,
			pagenum = this.model.get('pagenum'),
			section = $('#'+pagenum+'-set-'+this.i+'-block-'+this.ii);
		this.$el.fadeOut(500, function(){
			view.remove();
			//reset numbering of options/items once element has been removed
			var l = section.find('.'+view.className).length;
			section.find('.'+view.className).each(function(iii){
				$(this).attr('id', 'page-'+pagenum+'-set-'+view.i+'-block-'+view.ii+'-'+view.className+'-'+iii);
				$(this).find('.'+view.className+'number').html(iii+1);
				//replace any i character in input/textarea names
				$(this).find('input, textarea').each(function(){
					if (typeof $(this).attr('name') !== 'undefined'){
						var name = $(this).attr('name').replace(/\[[0-9]\]/g, '['+iii+']');
						$(this).attr('name', name);
					}
				});
				//reveal add button if the last set
				if (iii == l-1){
					$(this).find('.addbutton').show();
				};
				//hide remove button if the only set
				if (l == 1){
					$(this).find('.removebutton').hide();
				};
			});
		});
	},
	addView: function(){
		var pagenum = this.model.get('pagenum');
		this.iii = parseInt(this.$el.find('.'+this.className+'number').html())-1;
		this.$el.find('.addbutton').hide();
		this.$el.find('.removebutton').show();
		createOptionItem(pagenum,this.i, this.ii, this.iii+1, this.className);
	},
	render: function(){
		//create div
			var pagenum = this.model.get('pagenum');
			this.$el.attr({
				id: 'page-'+pagenum+'-set-'+this.i+'-block-'+this.ii+'-'+this.className+'-'+this.iii,
				class: this.className+' subsection'
			});
			this.$el.html(this.template({pagenum: pagenum, i: this.i, ii: this.ii, iii: this.iii}));

			this.removeButton();

			//add div to container
			$('#page-'+pagenum+'-set-'+this.i+'-block-'+this.ii+' .'+this.className+'s').append(this.el);

			//add options to boolean dropdown menus
			this.$el.find('.bdd').each(function(){
				createBooleanDropdown($(this));
			});
			this.$el.find('.displayonyes').hide();

			return this;
		
	}
});

var ItemView = OptionView.extend({
	className: 'item',
	template: _.template( $('#input-item-template').html() ),
	events: {
		"click .additem": "addView",
		"click .removeitem": "removeView"
	}
});

var OptionItemViews = {
	option: OptionView,
	item: ItemView
};

function createPage(pagenum){
	totalPages+=1;

	console.log("creating page" + pagenum);

	var pageModel = new PageModel();

	pageModel.set('pagenum', pagenum);
	pageModels[`page${pagenum}`] = pageModel;     
	var pageView = new PageView({model: pageModels[`page${pagenum}`]});
	var page = pageView.render();
};

function createLayer(pagenum,layerType, layerIndex){
	var layerView = new LayerViews[layerType]({model: pageModels[`page${pagenum}`]});
	layerView.i = layerIndex;
	var layer = layerView.render();
};

function createTechnique(pagenum,layerIndex, techniqueIndex){
	var techniqueView = new TechniqueView({model: pageModels[`page${pagenum}`]});
	techniqueView.i = layerIndex;
	techniqueView.ii = techniqueIndex;
	var technique = techniqueView.render();
	return techniqueView;
};

function createSet(pagenum,setIndex){
	var setView = new SetView({model: pageModels[`page${pagenum}`]});
	setView.i = setIndex;
	var set = setView.render();
};

function createBlock(pagenum,setIndex, blockIndex){
	var blockView = new BlockView({model: pageModels[`page${pagenum}`]});
	blockView.i = setIndex;
	blockView.ii = blockIndex;
	var block = blockView.render();
};

function createStorySet(pagenum,setIndex){
	var setView = new StorySetView({model: pageModels[`page${pagenum}`]});
	setView.i = setIndex;
	var set = setView.render();
};

function createStoryBlock(pagenum, setIndex, blockIndex){
	var storyBlockView = new StoryBlockView({model: pageModels[`page${pagenum}`]});
	storyBlockView.ii = blockIndex;
	storyBlockView.i = setIndex;
	var storyBlock = storyBlockView.render();
};

function createOptionItem(pagenum, setIndex, blockIndex, optionItemIndex, type){
	var optionItemView = new OptionItemViews[type]({model: pageModels[`page${pagenum}`]});
	optionItemView.i = setIndex;
	optionItemView.ii = blockIndex;
	optionItemView.iii = optionItemIndex;
	var optionItem = optionItemView.render();
};

/****************** CONDITIONS ******************/

var ConditionModel = Backbone.Model.extend({
	defaults: {
		conditionnum: 1
	}
});

var conditionModel = new ConditionModel();

var ConditionPageModel = Backbone.Model.extend({
	conditionnum: 1,
	pagenum: 1,
	rank: 0
});

var ConditionView = Backbone.View.extend({
	tagName: 'div',
	className: 'condition',
	template: _.template( $('#condition-template').html() ),
	events: {
		"click .removecondition": "removecondition",
		"click .addcondition": "addcondition",
		"sortstop .sortable-pages": "resortPages",
		"sortstart .sortable-pages": "sort",
		"change .randomize": "resortPages",
		"change .condition-weight-slider": "modifyWeights",
		"input .condition-weight-slider": "modifyWeights",
		"keyup .weight-val": "manualWeight"
	},
	removecondition: function(){
		//reset condition numbering
		this.model.set('conditionnum', this.model.get('conditionnum')-1);
		//fade out and remove view
		var view = this;
		this.$el.fadeOut(500, function(){
			view.remove();
			//reset numbering of condition boxes once element has been removed
			var conditionnum = 0;
			$('.condition').each(function(){
				conditionnum++;
				$(this).attr('id', "condition-"+conditionnum);
				$(this).find('.conditionnum').html(conditionnum);
			});
			//if no conditions are shown, show first add condition button
			if (conditionnum == 0){
				$('.condition-add').show();
			};
			//reset weights
			view.modifyWeights(true);
		});
	},
	addcondition: function(){
		createCondition(this.model.get('conditionnum')+1,totalPages);
	},
	addPages: function(){
		var nPages = this.model.get('conditionPages'),
			randomizeTemplate = _.template( $('#condition-randomize-template').html() );
		for (var i=0; i<nPages; i++){
			//add sortable list item
			var conditionPageModel = new ConditionPageModel({
				conditionnum: this.model.get('conditionnum'),
				pagenum: i+1,
				rank: i
			});
			var conditionPageView = new ConditionPageView({
				el: this.$el.find('.sortable-pages'),
				model: conditionPageModel
			});
			conditionPageView.render();

			//if not the first page, add a randomize checkbox
			if (i > 0){
				this.$el.find('.randomize-inputs').append(randomizeTemplate({
					pagenum: i+1
				}));
			};
		};
		//make pages list sortable
		this.$el.find('.sortable-pages').sortable({
			axis: "y",
			containment: "parent"
		});
	},
	sort: function(e, ui){
		$(ui.item).attr('class','condition-page ui-sortable-handle');
		$(ui.item).find('.rank-item').css('box-shadow', '0 0 2px black');
		$(ui.item).find('.rank').empty();
	},
	resortPages: function(e, ui){
		if (typeof ui != 'undefined'){
			$(ui.item).find('.rank-item').removeAttr('style');
		};

		var condition = parseInt(this.$el.find('.conditionnum').html())-1,
			el = this.$el,
			p = -1,
			ii = 0;
		this.$el.find('.condition-page').each(function(i){
			//reset rank
			$(this).find('.rank').html(i+1);
			//determine whether page is randomized and how
			var randomized = el.find('.condition-randomize .'+(i+1)+':checked').length,
				beforeRandomized = el.find('.condition-randomize .'+i+'.'+(i+1)+':checked').length,
				afterRandomized = el.find('.condition-randomize .'+(i+1)+'.'+(i+2)+':checked').length;
			var className = 'condition-page ui-sortable-handle';
			if (randomized){
				className += ' randomized';
				if (beforeRandomized){
					className += ' before-randomized';
					ii++;
				} else {
					ii = 0;
					p++;
				};
				if (afterRandomized){
					className += ' after-randomized';
				};
				//create nested pages array
				$(this).find('input').attr('name', condition+'.pages.'+p+'.'+ii);
			} else {
				p++;
				$(this).find('input').attr('name', condition+'.pages.'+p);
			};
			$(this).attr('class', className);
		});

		//reset positioning of checkboxes
		var conditionPages = this.$el.find('.condition-page');
		this.$el.find('.condition-randomize').each(function(i){
			//get page div outer height including margins
			var height = $(conditionPages[i]).outerHeight(true);
			//hardcode because div doesnt exist when fired on upload
			height = 48;
			//subtract half of checkbox div height if first, and full checkbox div height for others
			if (i == 0){
				height -= 12;
			} else {
				height -= 24;
			}
			$(this).css('margin-top', height+"px");
		});
	},
	stopSlider: function(e){
		e.stopPropagation();
	},
	modifyWeights: function(e){

		var stopSlider = this.stopSlider;
		this.$el.find('.weight-warning').hide();
		if (typeof e == 'undefined' && this.model.get('conditionnum') == 1){
			this.$el.find('.condition-weight-slider').on('mousemove', stopSlider);
			this.$el.find('.weightval').css('color', '#999');
			this.$el.find('.weight-val').val('1.000').attr('disabled', true);
			this.$el.find('.weight-max').html('1.000');
		} else {
			//reset slider max and value of last input only
			var weightInputs = $('#condition-container').find('.condition-weight-slider'),
				totalWeight = 0,
				thisval = 0;
			weightInputs.each(function(i){
				$(this).off('mousemove', stopSlider);
				thisval = parseFloat($(this).val());
				//apply remainder to the last one
				if (i < weightInputs.length-1){
					$(this).parent().find('.weight-val').removeAttr('disabled');
					totalWeight += thisval;
					if (totalWeight > 1.000){
						$('.weightval, .weight-val').css('color', '#f00');
						$('.weight-warning').show();
					} else {
						$(this).parent().find('.weightval, .weight-val').css('color', '#000');
						$('.weight-warning').hide();
					};
				} else {
					$(this).on('mousemove', stopSlider);
					var weightVal = 1.000-totalWeight < 0 ? 0 : 1.000-totalWeight;
					$(this).val(weightVal);
					$(this).parent().find('.weightval').css('color', '#999');
					$(this).parent().find('.weight-val').css('color', '#000');
					thisval = weightVal;
				};
				if (typeof e != 'undefined' && e.hasOwnProperty('manualTarget') && e.manualTarget == $(this).parent().find('.weight-val')[0]){} else {
					$(this).parent().find('.weight-val').val(thisval.toFixed(3));
				};
			})
		}
	},
	manualWeight: function(e){
		if(e["value"]) {
			var targetVal = e["value"];
		}
		else{
			var targetVal = parseFloat(e.target.value);
		}

		
		if (!isNaN(targetVal) && targetVal >= 0 && targetVal <= 1.000){
			$(e.target).parent().find('.condition-weight-slider').val(targetVal);
			this.modifyWeights({manualTarget: e.target});
		};	
	},
	render: function(){
		//create condition div
		var conditionnum = this.model.get('conditionnum');
		this.$el.attr('id', 'condition-'+conditionnum);
		this.$el.html(this.template({conditionnum: conditionnum}));

		//add condition pages
		this.addPages();

		//hide first add condition button
		$('.condition-add').hide();

		//add condition div to page container
		$('#condition-container').append(this.el);

		//call resortPages() to even out checkboxes
		this.resortPages();

		//reset dropdown listeners for weights dropdown
		createBooleanDropdown($('#weight-yn select'), true);
		if ($('#weight-yn select').val() == 'false'){
			this.$el.find('.displayonyes').hide();
		};
			
		//modify available weights
		this.modifyWeights();

		return this;
	}
});

var ConditionPageView = Backbone.View.extend({
	template: _.template( $('#condition-page-template').html() ),
	render: function(){
		this.$el.append(this.template(this.model.attributes));

		return this;
	}
})

function createCondition(conditionnum,conditionPages){
	conditionModel.set('conditionnum', conditionnum);
	conditionModel.set('conditionPages', conditionPages);
	var conditionView = new ConditionView({model: conditionModel});
	var condition = conditionView.render();
	return conditionView;
};

//select view by element 
// Proxy the original Backbone.View setElement method:
    // See: http://backbonejs.org/#View-setElement
    var backboneSetElementOriginal = Backbone.View.prototype.setElement;

    Backbone.View.prototype.setElement = function(element) {
        if (this.el != element) {
            $(this.el).backboneView('unlink');                    
        }

        $(element).backboneView(this);    

        return backboneSetElementOriginal.apply(this, arguments);
    };
    // Create a custom selector to search for the presence of a 'backboneView' data entry:
    // This avoids a dependency on a data selector plugin...
    $.expr[':'].backboneView = function(element, intStackIndex, arrProperties, arrNodeStack) {
        return $(element).data('backboneView') !== undefined;        
    };
    // Plugin internal functions:
    var registerViewToElement = function($el, view) {
        $el.data('backboneView', view);
    };
    var getClosestViewFromElement = function($el, viewType) {
        var ret = null;

        viewType = viewType || Backbone.View;

        while ($el.length) {
            $el = $el.closest(':backboneView');
            ret = $el.length ? $el.data('backboneView') : null;

            if (ret instanceof viewType) {
                break;
            }
            else {
                $el = $el.parent();
            }           
        }

        return ret;                
    };

    // Extra methods:
    var methods = {

        unlink: function($el) {
            $el.removeData('backboneView');        
        }

    };

    // Plugin:
    $.fn.backboneView = function() {
        var ret = this;
        var args = Array.prototype.slice.call(arguments, 0);

        if ($.isFunction(methods[args[0]])) {
            methods[args[0]](this);                        
        }
        else if (args[0] && args[0] instanceof Backbone.View) {
            registerViewToElement(this.first(), args[0]);                
        }
        else {
            ret = getClosestViewFromElement(this.first(), args[0]);
        }

        return ret;        
    }        

/****************** ALL FORMS ******************/

function createBooleanDropdown(select, toggleAll){
	toggleAll = toggleAll || false;
	//creates a yes-no dropdown menu
	var options = {
		yes: "true",
		no: "false"
	};

	function resetChangeEvent(){
		select.on('change', function(){
			var togglediv = toggleAll ? $(this).closest('.q').find('.displayonyes, .hideonno') : $(this).closest('.q').children('.displayonyes, .hideonno');
			if ($(this).val() == "true"){
				togglediv.slideDown(100).find('input, textarea, select').removeAttr('disabled');
			} else {
				togglediv.slideUp(100).find('input, textarea, select').attr('disabled', true);
			}
		});
	};

	if (select.html().length == 0){
		for (var option in options){
			select.append(optionTemplate({value: options[option], option: option}));
		};
		//determine which option should display by default
		if (select.attr('class').indexOf('no') > -1){
			select.val("false");
		};
		resetChangeEvent();
	} else if (toggleAll){
		select.off();
		resetChangeEvent();
	};
	return select;
};

function processArrays(level){
	var levelArr = [], levelObj = {};
	//level is the object to be examined
	Object.keys(level).forEach(function(key){
		//if key is a number, level is an array
		if (!isNaN(parseInt(key))){
			//recursively sift through all levels of object
			if (typeof level[key] == 'object'){
				levelArr.push(processArrays(level[key]));
			} else {
				//just a simple array value
				levelArr.push(level[key]);
			};
		} else {
			var complexKey = key.split('-{');
			if (complexKey.length > 1){
				var subkey = complexKey[0],
					variable = complexKey[1].substring(0,complexKey[1].length-1);
				//deal with custom properties array
				if (variable == '[]'){
					//make array if not exists
					if (!levelObj.hasOwnProperty(subkey)){
						levelObj[subkey] = []
					};
					//add all values to array
					level[key] = level[key].split(',');
					level[key].forEach(function(arrVal){
						levelObj[subkey].push(arrVal.trim());
					});
				} else if (variable == '{}'){
					//make object if not exists, then merge
					if (!levelObj.hasOwnProperty(subkey)){
						levelObj[subkey] = {}
					};
					$.extend(levelObj[subkey], level[key]);
				};
			} else if (typeof level[key] == 'object'){
				//recursively sift through all levels of object
				levelObj[key] = processArrays(level[key]);
			} else {
				//just a simple key-value pair
				levelObj[key] = level[key];
			};
		};
	});
	//return correct data structure
	if (levelArr.length > 0){
		return levelArr;
	} else {
		return levelObj;
	};
};

function processForm(data){
	var inners = {};
	_.each(data, function(inData){
		var propArray = inData.name.split('.');
		//create pseudo-nested object strings
		var len = propArray.length,
			open = '',
			close = '',
			value = inData.value;

		for (var i = 0; i < len; i++){
			open += '{"' + propArray[i] + '":';
			close += '}';
			if (i == len-1){
				//determine how to treat value
				if (value[0] == '{' || value[0] == '[' || (value != '' && !isNaN(Number(value)))){
					open += value;
				} else {
					value = value.replace(/"/g, '\\"');
					open += '"' + value + '"';
				}
			};
		};
		var tempObj = open + close;
		//zip up the objects
		$.extend(true, inners, JSON.parse(tempObj));
	});

	inners = processArrays(inners);
	return inners;
};

function readForm(step){
	var data = $('#'+step).serializeArray();
	if (step == 'pages'){
		var outer = processForm(data);
		allData['map'] = outer.map;
		allData['questions'] = outer.questions;
	} else {
		allData[step] = processForm(data);
	};
};

function makeJSON(data){
	var json = JSON.stringify(data, function(k, v){
			if (v.length == 0){
				return undefined;
			};
			if (v == "false"){
				return false;
			};
			if (v == "true"){
				return true;
			};
			return v;
		}, "\t");
	if (typeof json != 'undefined'){
		json = json.replace(/\{\}|null/g, '');
	};
	return json;
};

function makePHP(data){
	var phpString = "<?PHP\n\n";
	for (var param in data){
		if (data[param].length > 0){
			phpString += "$"+param+" = '"+data[param]+"';\n";
		};
	};
	phpString += "\n?>";
	
	if (phpString.indexOf('$') > -1){
		return phpString;
	};
};

function stringify(){
	var postData = {};
	for (var filename in allData){
		//format the data depending on file type
		if (filename == 'param'){
			postData[filename] = makePHP(allData[filename])
		} else {
			postData[filename] = makeJSON(allData[filename]);
		};
	};
	console.log(postData)
	return postData;
};

function sendToServer(postData, callback){
	$.ajax({
		type: "POST",
		url: "./setup.php",
		data: postData,
		success: callback
	});
};

function makeFiles(){
	//stringify the data
	var postData = stringify();
	postData.operation = 'zip';
	//callback to download the zip file
	function callback(dirname){
		window.location = "./setup.php?dirname=" + dirname;
	};
	//create the zip file in php
	sendToServer(postData, callback);
};

function deleteFiles(dirname){
	//delete files once loaded in browser
	window.setTimeout(function(){
		$.get("setup.php", "rmdir="+dirname);
	}, 2000);
};

function viewCode(step){
	//process the form
	readForm(step);
	//stringify the data
	var postData = stringify();
	postData.operation = 'viewcode';
	//callback to trigger links to view files
	function callback(dirname){
		$('#file-links a').each(function(){
			var filename = $(this).attr('id').split('-')[0];
			if (postData[filename]){
				var ext = filename == 'param' ? '.txt' : '.json';
				$(this).attr('href', dirname+'/'+filename+ext);
				this.click();
			}
		});
		deleteFiles(dirname);
	};
	//create files in PHP
	sendToServer(postData, callback);
};

function livePreview(step){
	//process the form
	readForm(step);
	//stringify the data
	var postData = stringify();
	console.log(postData)
	postData.operation = 'preview';
	//callback to trigger links to view files
	function callback(dirname){
		$('#preview-link').attr('href', '../?config='+dirname);
		$('#preview-link')[0].click();
		deleteFiles(dirname);
	};
	//create files in PHP
	sendToServer(postData, callback);
};

function changeStep(prevStep, currentStep){
	//process form data
	readForm(prevStep);

	$('#'+prevStep).fadeOut(500, function(){
		$(window).scrollTop(0);
		$('#'+currentStep).fadeIn(500);
	});

	//add html for first page if first pass at Step 2 (pages)
	if (currentStep == "pages" && $('#page-container').html().length == 0){
		createPage(1);
	};
};

function assignValue(target,value,triggerChange){
	 //convert booleans to strings
	 if(typeof value == "boolean"){
	 	value = value.toString();
	 }
	$param = $(`[name*="${target}"]`);
	$param.removeAttr('disabled');
	
	var $parentYes = $param.parent(".displayonyes,.hideonno");
	var $parentBdd = $parentYes.siblings("p").find(".bdd");
	//parent yes and visible
	$parentBdd.val("true");
	$parentYes.css({"display": "block"});

	if(typeof(value) != "object"){
					  $param.val(value);
					} else {
					  $param.val(JSON.stringify(value));
					}
	if(triggerChange){
		$param.trigger("change");
	}
	if(typeof(value) == "string"){
		$param.trigger("keyup");
	}

}

//deal with data from extracted zip
function loadStyles(styles){
	var allSections = ["header", "footer", "map", "questions"];
	// get jquery references
	var $style = $("form#styles");
	var $sections = $style.find('.section.q');
	var $bdd = $sections.find('.bdd');
	var $hideonno = $sections.find('.hideonno');
	// set all to no
	$bdd.val("false");
	$hideonno.css({"display": "none"});

	//check for content
	if(styles.length > 0){

		for(var section of styles){
			var $section = $style.find(`.section.${section.sectionId}`);
			var i = allSections.indexOf(section.sectionId).toString();
			//set to yes and expand
			$section.find('.section-yn').val("true");
			$section.find('.hideonno').css({"display": "block"});

			for(var param in section){
				if(param != "sectionId"){
					var value = section[param];
					var $param = $section.find(`[name*="${i+"."+param}"]`);
					var $parentYes = $param.parent();
					var $parentBdd = $parentYes.siblings("p").find(".bdd");
					//parent yes and visible
					$parentBdd.val("true");
					$parentYes.css({"display": "block"});
					//set param
					$param.removeAttr('disabled');
					$param.siblings(`[name*=".sectionId"]`).removeAttr('disabled');
					if(typeof(value) != "object"){
					  $param.val(value);
					} else {
					  $param.val(JSON.stringify(value));
					}
				}
			}
		}
	}
}

function loadConditions(conditions){
	for(var i=0;i<conditions.length;i++){
		var condition = conditions[i];
		var conditionView = createCondition(i+1,condition.pages.length);
		var $condition = $(`#condition-${i+1}`);

		//set pages in right order
		var overallIndex = 0;
		var beforeRandom = false;
		for(var page of condition.pages){
			//if random
			if(Array.isArray(page)){
				for(var randomPage of page){
					var $page = $condition.find(`[name="${i}.pages.${overallIndex}"]`);
					$page.val(randomPage);
					$page.parent().find(".pagenum").html(randomPage);
					$page.parent().parent().addClass("after-randomized").addClass("randomized");
					//check the randomize box if previous was also randomized
					if(beforeRandom){
						$page.parent().parent().addClass("before-randomized").addClass("randomized");
						$condition.find(`.randomize.${overallIndex}.${overallIndex+1}`).prop("checked", true).trigger("change");
					}
					overallIndex+=1;
					beforeRandom = true;
				}
			}else{
				$page = $condition.find(`[name="${i}.pages.${overallIndex}"]`);
				$page.val(page);
				$page.parent().find(".pagenum").html(page);
				overallIndex+=1;
				beforeRandom = false;
			}
			
		}
	}	
	//add weights after all conditions created
	if(conditions[0].hasOwnProperty("weight")){
		for(var i=0;i<conditions.length;i++){
			var condition = conditions[i];
			var $condition = $(`#condition-${i+1}`);

			$condYN = $("form#conditions").find("#weight-yn").find(".bdd");
			$condYN.val("true").trigger("change");

			//set condition weights if included
			$weight = $condition.find(".weight-val");
			$weight.val(condition["weight"]).trigger("keyup");
		}
	}
	
}


function populateMapPage(page){
	$page = $(`div#page-${page.page}`);
	//map options
	for(var att in page.mapOptions){
		var value = page.mapOptions[att]
		//deal with array madness
		if(!Array.isArray(value)){
			assignValue( "map.pages." + page.page + ".mapOptions." + att,value);
		} else {
			 for(var i=0; i<value.length;i++){
			 	var subVal = value[i];
			 	if(!Array.isArray(subVal)){
			 		assignValue("map.pages." + page.page + ".mapOptions." + att + "." + i,subVal);
			 	}
			 	else {
			 		 for(var j=0; j<subVal.length;j++){
			 		 	subSubVal = subVal[j];
			 		 	assignValue(`map.pages.${page.page}.mapOptions.${att}.${i}.${j}`,subSubVal); 	
			 		 }
			 	}
			 }
		}		
	}
	//base layers
	if(page.baseLayers){
		for(var i = 0; i < page.baseLayers.length; i++){
			var baseLayer = page.baseLayers[i];
			var id = $('#page-' + page.page + '-baseLayer-' + i);
			if (i > 0){
				createLayer(page.page,"baseLayer",i);
			}
			for(var param in baseLayer){
				assignValue(`map.pages.${page.page}.baseLayers.${i}.${param}`, baseLayer[param]);
			}
		}
	}
	//data layers
	if(page.dataLayers){
		for(var i = 0; i < page.dataLayers.length; i++){
			var dataLayer = page.dataLayers[i];
			createLayer(page.page,"dataLayer",i);
			for(var param in dataLayer){
				//special handling for displayAttributes and techniques
				if(param == "displayAttributes"){
					var commaSep = "";
					for(var displayAtt of dataLayer[param]){
						commaSep+=displayAtt + ",";
					}
					commaSep = commaSep.slice(0,-1);
					assignValue(`map.pages.${page.page}.dataLayers.${i}.${param}`, commaSep);
				}
				else if(param == "displayAttributesDisplay"){
					var commaSepDisplay = "";
					for(var displayAttDisplay of dataLayer[param]){
						commaSepDisplay+=displayAttDisplay + ",";
					}
					commaSepDisplay = commaSepDisplay.slice(0,-1);
					assignValue(`map.pages.${page.page}.dataLayers.${i}.${param}`, commaSepDisplay);
				} else if(param == "techniques"){
					//remove first technique
					$(`#page-${page.page}-dataLayer-${i}-technique-0`).remove();
					var techniques = dataLayer[param];
					for(var j=0; j<techniques.length; j++){
						var technique = dataLayer[param][j];
						var techView = createTechnique(page.page,i,j);
						if(technique["type"]) {
							techView.changeTechniqueType(technique["type"]);
						}
						if(technique["classification"]) techView.changeClassification(technique["classification"]);
						if(technique["classes"]){
							var numClass;
							if(technique["type"] == "choropleth") {
								numClass = technique["classes"].split(".")[1];
							}
							else {
								numClass = technique["classes"].length;
							}
							techView.changeNClasses(numClass);
						}
						if(j!=techniques.length-1) techView.$el.find('.addtechnique').hide();					
						for(var techParam in technique){
							if(!Array.isArray(technique[techParam])){
								assignValue(`map.pages.${page.page}.dataLayers.${i}.techniques.${j}.${techParam}`,technique[techParam]);
							} 
							else {
								if (techParam == 'values'){
									var commaSep = "";
									for(var value of technique[techParam]){
										commaSep+=value + ",";
									}
									commaSep = commaSep.slice(0,-1);
									assignValue(`map.pages.${page.page}.dataLayers.${i}.techniques.${j}.${techParam}`, commaSep);
								}
								else{
									for(k=0; k<technique[techParam].length; k++){
										subTechParam = technique[techParam][k];
										assignValue(`map.pages.${page.page}.dataLayers.${i}.techniques.${j}.${techParam}.${k}`,subTechParam);
									}
								}
							}
						}		
					}
				} else {
					assignValue(`map.pages.${page.page}.dataLayers.${i}.${param}`, dataLayer[param]);
				}
			}
		}
	}
	//interactions INTERACTIONS
	if(page["interactions"]){
		for(var interaction in page["interactions"]){
			var $interaction = $(`[name="map.pages.${page.page}.interactions.${interaction}"]`);
			//toggle interaction on
			$interaction.prop( "checked", true);
			$interaction.trigger("change");
			for(var interactionOption in page["interactions"][interaction]){
				var $interactionSetting;
				var value = page["interactions"][interaction][interactionOption];
				//handle data layers
				if(interactionOption == "dataLayers"){
					for(var dataLayer of value){
						$interactionSetting = $interaction.parent().parent().find(`.interaction-dataLayer.${dataLayer.replace(/ /g, "")}`).find("input");
						$interactionSetting.prop("checked", true).trigger("change");
					}
				} else if(typeof value == "boolean"){
					//exception for resybolize option radios
					if(interactionOption == "reclassify" || interactionOption == "rescale" || interactionOption == "recolor"){
						$interactionSetting = $(`[name="map.pages.${page.page}.interactions.${interaction}.${interactionOption}"][value="${value.toString()}"]`);
				  		$interactionSetting.prop("checked",true);
					}
					$interactionSetting = $(`[name="map.pages.${page.page}.interactions.${interaction}.${interactionOption}"]`);
					$interactionSetting.val(value.toString());
				} else if (typeof value == "string"){
					assignValue(`map.pages.${page.page}.interactions.${interaction}.${interactionOption}`,value);
				} else {
				  	for(var subValName in value){
				  		var subValue = value[subValName];
				  		//deal with radio buttons
				  		$interactionSetting = $(`[name="map.pages.${page.page}.interactions.${interaction}.${interactionOption}.${subValName}"][value="${subValue.toString()}"]`);
				  		$interactionSetting.prop("checked",true);
				  	}
				}
			}
		}
	}
}

function populateQuestionPage(page){
	//set full page
	if(page["fullpage"]){
		$(`[name="questions.pages.${page.page}.fullpage"]`).val("true").trigger("change");
	}
	//set story
	if(page["story"]){
		$(`[name="questions.pages.${page.page}.story"]`).val("true").trigger("change");
		for(var option in page.story){
			assignValue(`story-${option}-yn`, true, "change");
			assignValue(`questions.pages.${page.page}.story.${option}`, page.story[option]);
		}
		for(var i=0; i < page["sets"].length; i++){
			if(i!=0) createStorySet(page.page,i);
			var set = page["sets"][i];
			var $set = $(`#page-${page.page}-set-${i}`);
			//set buttons(last page has no buttons)
			if(set["buttons"]) {
				for(var button of set["buttons"]){
					$button = $set.find(`.story-set-button.${button}`);
					$button.prop("checked", true).trigger("change");
				}
			}
			//blocks
			for(var j=0; j < set["blocks"].length;j++){
				if(j!=0) createStoryBlock(page.page,i,j);
				var block = set["blocks"][j];
				var $block = $(`#page-${page.page}-set-${i}-block-${j}`)
				var $input = $block.find(".input-yn");
				for(var blockOption in block){
					var value = block[blockOption];
					assignValue(`questions.pages.${page.page}.sets.${i}.blocks.${j}.${blockOption}`,value);
				}
			}
		}
	}
	else{
	//sets
		for(var i=0; i < page["sets"].length; i++){
			if(i!=0) createSet(page.page,i);
			var set = page["sets"][i];
			var $set = $(`#page-${page.page}-set-${i}`);
			//set buttons(last page has no buttons)
			if(set["buttons"]) {
				for(var button of set["buttons"]){
					$button = $set.find(`.set-button.${button}`);
					$button.prop("checked", true).trigger("change");
				}
			}
			//blocks
			for(var j=0; j < set["blocks"].length;j++){
				if(j!=0) createBlock(page.page,i,j);
				var block = set["blocks"][j];
				var $block = $(`#page-${page.page}-set-${i}-block-${j}`)
				var $input = $block.find(".input-yn");
				if(!block["input"]){
				//set include input to no if not there
					$input.val("false").trigger("change");
				}
				for(var blockOption in block){
					if(blockOption!="input"){
						var value = block[blockOption];
						assignValue(`questions.pages.${page.page}.sets.${i}.blocks.${j}.${blockOption}`,value);
					} else {
						var inputOptions = block[blockOption];
						for(var inputOption in inputOptions){
							if(inputOption!="options"&&inputOption!="items"){
								var value = inputOptions[inputOption];
								assignValue(`questions.pages.${page.page}.sets.${i}.blocks.${j}.input.${inputOption}`,value,true);
							}
							//handle options or items
							else{
								var optionsItems = inputOptions[inputOption];
								var type = inputOption.replace("s","");
								if(optionsItems.length>0){
									for(k=0;k<optionsItems.length;k++){
										//create options/items
										var optItem = optionsItems[k];
										if(k!=0) createOptionItem(page.page,i,j,k,type);
										for(var optionSetting in optItem){
											var value = optItem[optionSetting];
											assignValue(`questions.pages.${page.page}.sets.${i}.blocks.${j}.input.${inputOption}.${k}.${optionSetting}`,value);
										}
									}
								}			
							}
						}
					}
				}
			}
		}
	}
}


function loadPages(mapConfig,questionConfig){
	//some pages may have no map, use question.json
	for(var i=0; i<questionConfig.pages.length;i++){
		if(!pageModels[`page${i+1}`] ) createPage(i+1);
		var mapPage = mapConfig.pages.filter(page=>page.page == i+1)[0];
		if(mapPage) populateMapPage(mapPage);
		populateQuestionPage(questionConfig.pages[i]);
	}
}


///loading zip file
function uploadConfig(input) {
	//open loading page
	$(".zipUpload").css("display", "block");
	var config_zip = new JSZip();
    var file = input.files[0];
    if(!file["name"].includes(".zip")){
    	alert("Must upload a zip file!")
    }else {
	   	config_zip.loadAsync(file).then(function(zip){
	   		var pre = "";
	   		if(!zip.files['styles.json']) pre+=file["name"].replace(".zip","/");
	    	textContents = [zip.files[`${pre}styles.json`].async("string"),
	    					zip.files[`${pre}map.json`].async("string"),
	    					zip.files[`${pre}questions.json`].async("string"),
	    					zip.files[`${pre}conditions.json`].async("string")
	    					//,zip.files[`${pre}param.php`].async("string")
	    					];
	    	return Promise.all(textContents);
	    }).then(function(textFiles){
	    	if(textFiles[0].length != 0){
	    	   	var styles = JSON.parse(textFiles[0]);
	    	   	loadStyles(styles);
	    	}
	    	var map = JSON.parse(textFiles[1]);
	    	var question = JSON.parse(textFiles[2]);
	    	loadPages(map,question);
	    	if(textFiles[3].length != 0){
	    	   	var conditions = JSON.parse(textFiles[3]);
	    	   	loadConditions(conditions);
	    	}
	    	//close loading page
	    	$(".zipUpload").css("display", "none");
    	});
    }
};

function navigation(){
	//activate navigation buttons
	var step = 0,
		steps = [
			"styles",
			"pages",
			"conditions",
			"param",
			"finished"
		];

	$('body').click(function(){
		userClicks++;
	})

	//show only the current step on page
	$('.step').each(function(){
		if ($(this).attr('id') != steps[step]){
			$(this).hide();
		};
	})

	//go to the next step on advance
	$('button[name=next]').click(function(){
		prevStep = steps[step];
		step++;
		changeStep(prevStep, steps[step]);
		if (steps[step] == 'finished'){
			makeFiles();
		}
	});

	//go to previous step on back
	$('button[name=back]').click(function(){
		prevStep = steps[step];
		step--;
		changeStep(prevStep, steps[step]);
	});

	//go to the "styles" step directly
	$('button[name=styles]').click(function(){
		prevStep = steps[step];
		steps.forEach(function(d, i){
			if (steps[i] == "styles"){
				step = i;
			}
		});
		changeStep(prevStep, steps[step]);
	});

	//go to the "pages" step directly
	$('button[name=pages]').click(function(){
		prevStep = steps[step];
		steps.forEach(function(d, i){
			if (steps[i] == "pages"){
				step = i;
			}
		});
		changeStep(prevStep, steps[step]);
	});

	//go to the "conditions" step directly
	$('button[name=conditions]').click(function(){
		prevStep = steps[step];
		steps.forEach(function(d, i){
			if (steps[i] == "conditions"){
				step = i;
			}
		});
		changeStep(prevStep, steps[step]);
	});

	//go to the "server" step directly
	$('button[name=server]').click(function(){
		prevStep = steps[step];
		steps.forEach(function(d, i){
			if (steps[i] == "param"){
				step = i;
			}
		});
		changeStep(prevStep, steps[step]);
	});

	//view generated code on button click
	$('#viewcode').click(function(){
		viewCode(steps[step]);
	});

	//preview app on button click
	$('#preview').click(function(){
		steps.forEach(function(currentStep){
			readForm(currentStep);
		})
		livePreview(steps);
	});

	//upload zip file
	$('#upload input').on("change", function(){
		if(userClicks>3) alert("Please note you must start with a clean setup form when uploading configuration files.");
		uploadConfig(this);
	});	

	//view demo config setup
	$('#democode').click(function(){
		$(".zipUpload").css("display", "block");
		$.when(
			$.getJSON("../config/styles.json"),
			$.getJSON("../config/questions.json"),
			$.getJSON("../config/map.json"),
			$.getJSON("../config/conditions.json"),
		).then(function(styles, questions, map, conditions) {
			loadStyles(styles[0]);
			loadPages(map[0], questions[0]);
			loadConditions(conditions[0]);
		}).done(function(){
			$(".zipUpload").css("display", "none");
		});
	});

	//save zip file of current code to edit later
	$('#savefiles').click(function(){
		steps.forEach(function(currentStep){
			readForm(currentStep);
		})
		makeFiles();
	});

};

function initialize(){
	$('.displayonyes').hide();

	navigation();

	$('.bdd').each(function(){
		createBooleanDropdown($(this));
	});

	//activate add condition button for Step 3 (conditions)
	$('.addcondition').click(function(){
		createCondition(1,totalPages);
	});

};

$(document).ready(initialize);

})();