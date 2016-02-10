//Map panel

(function(){

/************************ helper functions ***************************/

//produce numeric values array from GeoJSON features
function getAllAttributeValues(features, attribute){
	//get attribute values for all features with given attribute
	var values = _.map(features, function(feature){
		return parseFloat(feature.properties[attribute]);
	});
	//strip any NaNs and sort
	values = _.without(values, NaN);
	values.sort(function(a,b){ return a-b });
	return values;
};

/*************************** map.dataLayer ***************************/

//basic model to hold geojson and data layer options
var DataLayerModel = Backbone.Model.extend();

/************** map.dataLayer.techique.classification ****************/

var Quantile = Backbone.Model.extend({
	defaults: {
		type: 'quantile'
	},
	scale: function(values, classes){
		//create scale generator
		var scale = d3.scale.quantile()
			.range(classes);
		//assign array of values as scale domain
		scale.domain(values);
		//done
		return scale;
	}
});

var EqualInterval = Backbone.Model.extend({
	defaults: {
		type: 'equal interval'
	},
	scale: function(values, classes){
		//create scale generator
		var scale = d3.scale.quantile()
			.range(classes);
		//assign two-value array as scale domain
		scale.domain([d3.min(values), d3.max(values)]);
		//done
		return scale;
	}
});

var NaturalBreaks = Backbone.Model.extend({
	defaults: {
		type: 'natural breaks'
	},
	scale: function(values, classes){
		//create scale generator
		var scale = d3.scale.threshold()
			.range(classes);
		//cluster data using ckmeans clustering algorithm to create natural breaks
		var clusters = ss.ckmeans(values, classes.length);
		//set domain array to cluster minimums
		var domainArray = clusters.map(function(d){
			return d3.min(d);
		});
		//remove first value from domain array to create class breakpoints
		domainArray.shift();
		//assign array of remaining cluster minimums as domain
		scale.domain(domainArray);
		//done
		return scale;
	}
});

var Unclassed = Backbone.Model.extend({
	defaults: {
		type: 'unclassed'
	},
	scale: function(values, rangeBounds){
		//create scale generator
		var scale = d3.scale.linear()
			.range(rangeBounds);
		//assign two-value array as scale domain
		scale.domain([d3.min(values), d3.max(values)]);
		//done
		return scale;
	}
});

//a single collection holds all classification models
var classification = new Backbone.Collection([
	new Quantile(),
	new EqualInterval(),
	new NaturalBreaks(),
	new Unclassed()
]);

/************** map.dataLayer.technique ****************/

//model for choropleth data overlay
var Choropleth = Backbone.Model.extend({
	defaults: {
		techniqueIndex: 0,
		techniqueType: 'choropleth'
	},
	setLayerOptions: function(feature, scale, expressedAttribute){
		//set a new fillColor property for each feature with the class color value
		return {
			fillColor: scale(parseFloat(feature.properties[expressedAttribute]))
		};
	},
	setClasses: function(){
		var expressedAttribute = this.get('expressedAttribute'),
			techniqueIndex = this.get('techniqueIndex'),
			technique = this.get('techniques')[techniqueIndex];
		//get all of the values for the attribute by which the data will be classed
		var values = getAllAttributeValues(this.get('features'), expressedAttribute);
		//get the d3 scale for the chosen classification scheme
		var classificationModel = classification.where({type: technique.classification})[0];
		var scale = classificationModel.scale(values, technique.classes);
		//use scale and attribute to set layer options
		_.each(this.get('features'), function(feature){
			feature.properties.layerOptions = this.setLayerOptions(feature, scale, expressedAttribute);
		}, this);
		this.set('scale', scale);
	}
});

//model for proportional symbol data overlay
var ProportionalSymbol = Choropleth.extend({
	defaults: {
		symbol: 'circle',
		techniqueType: 'proportional symbol'
	},
	setLayerOptions: function(feature, scale, expressedAttribute){
		//ensure scale range values are numbers
		var range = _.map(scale.range(), function(val){
			return parseFloat(val);
		});
		scale.range(range);
		//set a new radius property for each feature with the class radius
		return {
			radius: scale(parseFloat(feature.properties[expressedAttribute]))
		};
	}
});

//an object references technique classes to their types
var techniquesObj = {
	'choropleth': Choropleth,
	'proportional symbol': ProportionalSymbol
};

//view for legend creation
var LegendLayerView = Backbone.View.extend({
	tagName: 'svg',
	id: function(){
		return this.model.get('className') + '-' + this.model.get('techniqueType').replace(/\s/g, '-') + '-legend';
	},
	append: function(range, domain, i){
		var techniqueType = this.model.get('techniqueType');
		template = _.template( $('#'+techniqueType.replace(/\s/g, '-')+'-legend-template').html() );
		//set y attribute as function of index
		var y = i * 12;
		var attributes = {
			range: range,
			y: y,
			svgHeight: this.model.get('svgHeight')
		};
		//set label content
		if (typeof domain == 'object'){
			attributes.label = domain[0] + ' - ' + domain[1];
		} else {
			attributes.label = String(domain)
		};
		//create temporary span element to test label width
		var labelTestSpan = $('<span class="leaflet-container">'+attributes.label+'</span>').appendTo('body');
		var labelWidth = labelTestSpan.width() + 5;
		labelTestSpan.remove();
		//set circle x for prop symbol legend and svgWidth for both
		if (this.model.get('maxRadius')){
			attributes.cx = this.model.get('maxRadius') + 10;
			attributes.svgWidth = labelWidth + attributes.cx * 2;
		} else {
			attributes.svgWidth = labelWidth + 40;
		};
		//reset svg width based on current width
		if (!this.model.get('svgWidth') || attributes.svgWidth > this.model.get('svgWidth')){
			this.model.set('svgWidth', attributes.svgWidth);
		};
		//append a symbol for each class
		var newline = template(attributes);
		this.$el.append(newline);
	},
	render: function(){
		//append svg to legend container
		$('.legend-control-container').append(this.$el);
	},
	initialize: function(){
		//get output range and input domain values
		var scale = this.model.get('scale'),
			range = scale.range().reverse(),
			domain = scale.domain().reverse();
		//get expressed attribute
		var expressedAttribute = this.model.get('expressedAttribute');
		//calculate svg height
		if (!isNaN(parseFloat(range[0]))){ //if range is a number, treat as prop symbol
			//set max radius
			this.model.set('maxRadius', parseFloat(range[0]));
			//svg height should be whichever is larger, label heights or largest circle diameter
			var heightArray = [
				13 * range.length + 6, 
				parseFloat(range[0]) * 2 + 6
			];
			heightArray.sort(function(a,b){ return b-a });
			this.model.set('svgHeight', heightArray[0]);
		} else {
			this.model.set('svgHeight', 13 * range.length + 6);
		};
		//only build classes for classed classification
		if (domain.length > 2 || range.length > 2){
			//add a symbol for each class
			_.each(range, function(rangeval, i){
				var domainvals = scale.invertExtent(rangeval);
				//fill in min and max values for natural breaks threshold scale
				if (typeof domainvals[0] == 'undefined'){
					domainvals[0] = d3.min(getAllAttributeValues(this.model.get('features'), expressedAttribute));
				} else if (typeof domainvals[1] == 'undefined'){
					domainvals[1] = d3.max(getAllAttributeValues(this.model.get('features'), expressedAttribute));
				};
				//add visual element and label for each class
				this.append(rangeval, domainvals, i);
			}, this);
		} else {
			//add a symbol for lowest and highest values
			_.each(range, function(rangeval, i){
				this.append(rangeval, domain[i], i);
			}, this)
		};
		//set svg dimensions
		this.$el.attr({
			width: this.model.get('svgWidth'),
			height: this.model.get('svgHeight'),
			xmlns: 'http://www.w3.org/2000/svg',
			version: '1.1'
		});
		//style according to layer options
		var css = {},
			layerOptions = this.model.get('layerOptions');
		for (var option in layerOptions){
			//assign options that may apply
			css[option] = layerOptions[option];
			//deal with special Leaflet options
			switch (option){
				case 'fillColor': css.fill = layerOptions[option]; break;
				case 'fillOpacity': css['fill-opacity'] = layerOptions[option]; break;
				case 'color': css.stroke = layerOptions[option]; break;
				case 'weight': css['stroke-width'] = layerOptions[option]; break;
				case 'opacity': css['stroke-opacity'] = layerOptions[option]; break;
				case 'dashArray': css['stroke-dasharray'] = layerOptions[option]; break;
				case 'linecap': css['stroke-linecap'] = layerOptions[option]; break;
				case 'linejoin': css['stroke-linejoin'] = layerOptions[option]; break;
			};
		};
		for (var style in css){
			this.$el.children('rect').each(function(){
				//don't override rectangle color
				if (style != 'fill'){ $(this).css(style, css[style]); };
			});
			this.$el.children('circle').each(function(){
				$(this).css(style, css[style]);
			});
		};
	}
});

/************** map.interactions ****************/

//basic interaction model
var Interaction = Backbone.Model.extend({
	defaults: {
		interaction: "",
		timestamp: "",
		userId: userId,
		question: 0
	},
	url: "php/interactions.php",
	record: function(){
		var date = new Date();
		this.set({
			timestamp: date.toUTCString(),
			question: question
		});
		this.save();
	},
	create: function(events){
		//events is an object in the form of {event1: context1, event2: context2}
		for (var e in events){
			var context = events[e];
			var model = this;
			context.on(e, function(){
				model.record();
			});
		}
	}
});

var InteractionControlModel = Backbone.Model.extend({
	defaults: {
		interaction: ''
	}
});

//view for all interaction control toggle buttons
var InteractionToggleView = Backbone.View.extend({
	el: '.interaction-control-container',
	template: _.template( $('#interaction-control-template').html() ),
	message: '',
	addInteraction: function(){},
	removeInteraction: function(){},
	toggle: function(e, toggleView){
		//get target and interaction
		var target = $(e.target).attr('class') ? $(e.target) : $(e.target).parent(),
			className = target.attr('class'),
			interaction = className.split('-')[0];
		//toggle
		var action, state;
		if (className.indexOf(' active') > -1){
			action = 'inactivate', state = 'inactive';
			//close associated interaction widget
			$('.'+interaction+'-control-container').hide();
			//remove active class
			target.attr('class', className.substring(0, className.indexOf(' active')));
			//remove any additional interaction scripts
			toggleView.removeInteraction();
		} else {
			action = 'activate', state = 'active';
			//open associated interaction widget
			$('.'+interaction+'-control-container').show();
			//add active class
			target.attr('class', className + ' active');
			//add any additional interaction scripts
			toggleView.addInteraction();
		};
		//fire inactivate event
		toggleView.trigger('toggle', {
			action: action,
			state: state,
			interaction: interaction
		});
		//display message about the interaction on first click
		if (toggleView.message){ alert(toggleView.message); };
	},
	render: function(){
		this.$el.append(this.template(this.model.attributes));
		var toggleView = this,
			toggle = this.toggle,
			firstClick = true;
		this.$el.children('.'+this.model.get('interaction')+'-control').click(function(e){
			//only display message on first click
			toggleView.message = toggleView.message.length > 0 && firstClick ? toggleView.message : false;
			toggle(e, toggleView);
			firstClick = false;
		});
	},
	initialize: function(){
		return this;
	}
});

//interaction control base view
var InteractionControlView = Backbone.View.extend({
	render: function(){
		this.$el.append(this.template());
	},
	initialize: function(){
		this.render();
		return this;
	}
});

//view for pan interaction
var PanControlView = InteractionControlView.extend({
	el: '.pan-control-container',
	events: {
		'click .pan-button': 'pan'
	},
	template: _.template( $('#pan-control-template').html() ),
	panMap: function(targetId){},
	pan: function(e){
		var targetId = $(e.target).attr('id') ? $(e.target).attr('id') : $(e.target).parent().attr('id');
		this.panMap(targetId);
	}
});

//model for overlay control
var OverlayControlModel = Backbone.Model.extend({
	defaults: {
		layerName: '',
		layerId: '',
		techniqueType: ''
	}
});

//view for overlay control
var OverlayControlView = Backbone.View.extend({
	el: '.overlay-control-container',
	template: _.template( $('#overlay-control-template').html() ),
	toggleLayer: function(layerId, addLayer){},
	render: function(){
		this.$el.append(this.template(this.model.attributes));
		//set click interaction on this child element only
		var view = this;
		this.$el.find('.layer-'+this.model.get('layerId')+' input').click(function(e){
			view.toggleLayer($(e.target).val(), $(e.target).prop('checked'));
		});
	}
});

//model for underlay control
var UnderlayControlModel = Backbone.Model.extend({
	defaults: {
		layerName: '',
		layerId: ''
	}
});

//view for underlay control
var UnderlayControlView = OverlayControlView.extend({
	el: '.underlay-control-container',
	events: {
		'click input': 'overlay'
	},
	template: _.template( $('#underlay-control-template').html() )
});

//model for Fuse search of GeoJSON features
var SearchModel = Backbone.Model.extend({
	defaults: {
		allFeatures: {},
		searchOptions: {},
		fuse: {},
		term: '',
		result: []
	},
	createSearch: function(){
		this.set('fuse', new Fuse(this.get('allFeatures'), this.get('searchOptions')));
	},
	search: function(){
		this.set('result', this.get('fuse').search(this.get('term')));
	}
});

var SearchInputView = Backbone.View.extend({
	el: '.search-control-container',
	template: _.template($('#search-control-template').html()),
	events: {
		'click button': 'resetSearch'
	},
	resetSearch: function(){
		this.$el.find('input').val('');
		$('#search-results-box').html('');
		this.trigger('reset');
	},
	initialize: function(){
		this.$el.append(this.template());
	}
});

var SearchView = Backbone.View.extend({
	el: '.search-control-container',
	template: _.template($('#search-result-template').html()),
	events: {
		'keyup input': 'search'
	},
	selectFeature: function(e, result){},
	search: function(e){
		//define search term
		this.model.set('term', $(e.target).val());
		//get results
		this.model.search();
		//reset html
		this.$el.children('#search-results-box').html('');
		_.each(this.model.get('result'), function(result, i){
			//limit to top 10 results
			if (i < 10){
				var featureId = i + result.properties.name.replace(/[\.\s#]/g, '') + result.id;
				//append a new line for each result
				this.$el.children('#search-results-box').append(this.template({featureName: result.properties.name, featureId: featureId}));
				//attach click listener
				var selectFeature = this.selectFeature;
				$('#result-'+featureId).click(function(e){ selectFeature(e, result); });
			};
		}, this);
	}
});

//model for filter interaction
var FilterModel = Backbone.Model.extend({
	defaults: {
		layerName: '',
		attributes: [],
		tool: "slider",
		features: {}
	}
});

//slider view for filter interaction
var FilterSliderView = Backbone.View.extend({
	el: ".filter-control-container",
	events: {
		"change select": "select"
	},
	template: _.template( $( '#slider-template').html() ),
	applyFilter: function(){},
	select: function(e){
		var select = $(e.target);
		this.setSlider(select.val(), select.attr('name'));
	},
	setSlider: function(attribute, layerName){
		//get attribute values for all features with given attribute
		var allAttributeValues = getAllAttributeValues(this.model.get('features'), attribute);
		//set values for slider
		var min = _.min(allAttributeValues),
			max = _.max(allAttributeValues),
			mindiff = _.reduce(allAttributeValues, function(memo, val, i){
				//take the smallest possible difference between attribute values to determine step
				if (i < allAttributeValues.length-1){
					var diff = Math.abs(val - allAttributeValues[i+1]);
					if (diff == 0){ return memo };
					return memo < diff ? memo : diff;
				} else {
					return memo;
				};
			}, Infinity),
			step = 0;
		//assign step the order of magnitude of mindiff
		if (mindiff >= 1){
			var intLength = String(Math.round(mindiff)).length;
			step = Math.pow(10,intLength-1);
		} else {
			for (var i=12; i>0; i--){
				if (mindiff * Math.pow(10,i) >= 1){
					step = Math.pow(10,-i);
				};
			};
			if (step == 0){
				step = 1 * Math.pow(10,-12);
			};
		};
		//add a small amount of padding to ensure max and min values stay within range
		min = Math.floor(min / step) * step - step;
		max = Math.ceil(max / step) * step + step;
		//add labels
		var labelsDiv = this.$el.find("#"+layerName+"-labels");
		labelsDiv.children(".left").html(min);
		labelsDiv.children(".right").html(max);
		//to pass to slide callback
		var applyFilter = this.applyFilter;
		//call once to reset layer
		applyFilter(attribute, [min, max]);
		//set slider
		this.$el.find("#"+layerName+"-slider").slider({
			range: true,
			min: min, //change
			max: max, //change
			values: [min, max], //change
			step: step, //change
			slide: function(e, slider){
				labelsDiv.children(".left").html(slider.values[0]);
				labelsDiv.children(".right").html(slider.values[1]);
				applyFilter(attribute, slider.values);
			}
		});
	},
	append: function(numericAttributes){
		//add line for data layer
		this.$el.append(this.template(this.model.attributes));
		//add slider for first attribute
		this.setSlider(numericAttributes[0], this.model.get('layerName'));
	},
	render: function(){
		//get all numeric attributes for data layer
		var numericAttributes = _.filter(this.model.get('attributes'), function(attribute){
			var allAttributeValues = getAllAttributeValues(this.model.get('features'), attribute);
			if (allAttributeValues.length > 0){
				return attribute;
			};
		}, this);
		//only proceed if there are one or more numeric attributes
		if (numericAttributes.length > 0){ this.append(numericAttributes); };
		//add dropdown option for each attribute
		var optionTemplate = _.template($('#filter-options-template').html()),
			select = this.$el.find('select[name=' + this.model.get('layerName') + ']');
		_.each(numericAttributes, function(attribute){
			select.append(optionTemplate({attribute: attribute}))
		}, this);
	},
	initialize: function(options){
		this.applyFilter = options.applyFilter;
	}
});

//logic view for filter interaction
var FilterLogicView = FilterSliderView.extend({
	events: function(){
		return _.extend({}, FilterSliderView.prototype.events,{
			"keyup input": "processFilter"
		});
	},
	template: _.template( $( '#logic-template').html() ),
	processFilter: function(e){
		//identify layer and attribute
		var layerDiv = $(e.target).parent();
		var attribute = layerDiv.children('select').val();
		//get attribute values min and max
		var allAttributeValues = getAllAttributeValues(this.model.get('features'), attribute);
		var minmax = [_.min(allAttributeValues), _.max(allAttributeValues)];
		//array to hold filter values
		var values = [
			layerDiv.children('input[name=value1]').val(),
			layerDiv.children('input[name=value2]').val(),
		];
		//test whether input contains a value; if not, use default
		values = _.map(values, function(value, i){
			return value.length > 0 ? parseFloat(value) : minmax[i];
		});
		//go!
		this.applyFilter(attribute, values);
	},
	setValues: function(attribute, layerName){
		//get attribute values for all features with given attribute
		var allAttributeValues = getAllAttributeValues(this.model.get('features'), attribute);
		//set values for inputs
		var min = _.min(allAttributeValues),
			max = _.max(allAttributeValues);
		var parentDiv = this.$el.find('select[name='+layerName+']').parent();
		parentDiv.children('input[name=value1]').attr('placeholder', min);
		parentDiv.children('input[name=value2]').attr('placeholder', max);
	},
	append: function(numericAttributes){
		this.$el.append(this.template(this.model.attributes));
		this.setValues(numericAttributes[0], this.model.get('layerName'));
	},
	select: function(e){
		var select = $(e.target);
		this.setValues(select.val(), select.attr('name'));
	}
});

//model for reexpress widget
var ReexpressModel = Backbone.Model.extend({
	defaults: {
		techniqueType: '',
		techniqueTypeClass: '',
		layerName: '',
		layerNameClass: '',
		layerId: 0
	}
});

//view for reexpress section
var ReexpressSectionView = Backbone.View.extend({
	el: '.reexpress-control-container',
	template: _.template( $('#reexpress-section-template').html() ),
	initialize: function(){
		this.$el.append(this.template(this.model.attributes));
	}
})

//view for reexpress buttons
var ReexpressInputView = Backbone.View.extend({
	template: _.template( $('#reexpress-input-template').html() ),
	setTechnique: function(e){},
	render: function(){
		//instantiate reexpress section if needed
		if ($('#'+this.model.get('layerNameClass')+'-reexpress-section').length == 0){
			new ReexpressSectionView({model: this.model});
		};
		//set el as section div
		this.$el = $('#'+this.model.get('layerNameClass')+'-reexpress-section');
		//add input div for technique
		this.$el.append(this.template(this.model.attributes));
		//set click listener
		var setTechnique = this.setTechnique;
		this.$el.find('input.'+this.model.get('techniqueTypeClass')).click(setTechnique);
	}
});


/************** map.library ****************/

//Leaflet
var LeafletMap = Backbone.View.extend({
	el: '#m',
	initialize: function(){

	},
	events: {
		'click .reexpress': 'reexpress'
	},
	offLayers: {},
	//all available interactions
	interactions: {
		zoom: false,
		pan: false,
		retrieve: false,
		overlay: false,
		search: false,
		filter: false,
		sequence: false,
		reexpress: false,
		resymbolize: false,
		reproject: false
	},
	render: function(){
		this.$el.html("<div id='map'>");
		this.model.set('allFeatures', []);
		return this;
	},
	addLayer: function(layerId){
		this.offLayers[layerId].addTo(this.map);
		delete this.offLayers[layerId];
	},
	removeLayer: function(layerId){
		this.offLayers[layerId] = this.map._layers[layerId];
		this.map.removeLayer(this.map._layers[layerId]);
	},
	setBaseLayer: function(baseLayer, i){
		//create leaflet tile layer
		var leafletBaseLayer = L.tileLayer(baseLayer.source, baseLayer.layerOptions);
		leafletBaseLayer.layerName = baseLayer.name;
		//need to pre-assign layerId for tile layers...for unknown reason
		leafletBaseLayer._leaflet_id = Math.round(Math.random()*10000);
		var layerId = leafletBaseLayer._leaflet_id;
		//only add first base layer to the map
		if (i==0){ 
			leafletBaseLayer.addTo(this.map);
		} else {
			this.offLayers[layerId] = leafletBaseLayer;
		};
		//add to array of base layers
		this.model.attributes.leafletBaseLayers.push(leafletBaseLayer);
		//add to underlay control
		var view = this,
			map = this.map;
		var underlayControlModel = new UnderlayControlModel({
			layerName: baseLayer.name,
			layerId: layerId,
		});
		var underlayControlView = new UnderlayControlView({model: underlayControlModel});
		//toggleLayer function must be defined for leaflet view
		underlayControlView.toggleLayer = function(layerId, addLayer){
			//turn clicked layer on
			if (!map._layers[layerId] && view.offLayers[layerId]){
				view.addLayer(layerId);
			};
			//turn other layers off
			$('.underlay-control-layer').each(function(){
				var thisId = $(this).attr('id').split('-')[2];
				if (layerId != thisId && map._layers[thisId]){
					view.removeLayer(thisId);
				};
			});
		};
		underlayControlView.render();
		//check the layer that is on the map
		if (this.map._layers[layerId]){
			$('#underlay-layer-'+layerId+' input').prop('checked', true);
		};
		//trigger done event
		if (i == this.model.get('baseLayers').length-1){ this.trigger('baseLayersDone') };
	},
	polygonToPoint: function(feature){
		var leafletFeature = L.geoJson(feature);
		var center = leafletFeature.getBounds().getCenter();
		feature.geometry.type = 'Point';
		feature.geometry.coordinates = [center.lng, center.lat];
		return feature;
	},
	setTechniques: function(dataLayerModel){
		//variables needed by internal functions
		var view = this, 
			model = view.model,
			map = view.map;
		//add new features to collection of all features
		model.attributes.allFeatures = _.union(model.attributes.allFeatures, dataLayerModel.get('features'));
		//trigger event for features
		view.trigger(dataLayerModel.get('className')+'-features-added');

		//Leaflet layer style function
		function style(feature){
			//combine layer options objects from config file and feature properties
			//classification will take precedence over base options
			return _.defaults(feature.properties.layerOptions, dataLayerModel.get('layerOptions'));
		};

		//create a new Leaflet layer for each technique
		_.each(dataLayerModel.get('techniques'), function(technique, i){
			//instantiate new model based on technique type and combine with data layer model
			var techniqueModel = new techniquesObj[technique.type]({techniqueIndex: i});
			_.defaults(techniqueModel, dataLayerModel);
			_.extend(techniqueModel.attributes, dataLayerModel.attributes);
			//set model classification
			techniqueModel.setClasses();

			//add popups to layer
			function onEachFeature(feature, layer){
				if (!feature.layers){ feature.layers = [] };
				feature.layers.push(layer); //bind layer to feature for search
				var popupContent = "<table>";
				if (dataLayerModel.attributes.displayAttributes){
					dataLayerModel.get('displayAttributes').forEach(function(attr){
						popupContent += "<tr><td class='attr'>"+attr+":</td><td>"+feature.properties[attr]+"</td></tr>";
					});
				} else {
					var attr = dataLayerModel.get('expressedAttribute');
					popupContent += "<tr><td class='attr'>"+attr+":</td><td>"+feature.properties[attr]+"</td></tr>";
				};
				popupContent += "</table>";
				layer.bindPopup(popupContent);
				if (model.get('interactions.retrieve.event') == 'hover'){
					layer.on({
						mouseover: function(){
							//fix for popup flicker
							var bounds = this.getBounds();
							var maxLat = bounds.getNorth();
							var midLng = bounds.getCenter().lng;
							this.openPopup([maxLat, midLng]);
						},
						mouseout: function(){ this.closePopup() }
					});
				};
				layer.on('popupopen', function(){
					//only trigger event if popup is visible
					if ($('.leaflet-popup-pane').css('display') != 'none'){
						view.trigger('popupopen');
					};
				});
			};
			//Leaflet overlay options
			var overlayOptions = {
				onEachFeature: onEachFeature,
				style: style,
				className: dataLayerModel.get('className')
			};

			//special processing for prop symbol maps
			if (technique.type == 'proportional symbol'){
				//implement pointToLayer conversion for proportional symbol maps
				function pointToLayer(feature, latlng){
					var markerOptions = style(feature);
					if (techniqueModel.get('symbol') == 'circle' || !techniqueModel.attributes.symbol){
						return L.circleMarker(latlng, markerOptions);
					} else {
						var width = markerOptions.radius * 2;
						var icon = L.icon({
							iconUrl: techniqueModel.get('symbol'),
							iconSize: [width, width]
						});
						return L.marker(latlng, {icon: icon})
					};
				};
				//turn any non-point features into point features
				var newFeatures = _.map(techniqueModel.get('features'), function(feature){
					if (feature.geometry.type != 'Point'){
						return this.polygonToPoint(feature);
					} else {
						return feature;
					};
				}, this);
				techniqueModel.set('features', newFeatures);
				//add pointToLayer to create prop symbols
				overlayOptions.pointToLayer = pointToLayer;
			};
			//instantiate Leaflet layer
			var leafletDataLayer = L.geoJson(techniqueModel.get('features'), overlayOptions),
				layerId = leafletDataLayer._leaflet_id;
			leafletDataLayer.model = techniqueModel;
			leafletDataLayer.layerName = techniqueModel.get('name');
			leafletDataLayer.className = techniqueModel.get('className');
			leafletDataLayer.techniqueType = technique.type;

			//render immediately by default
			if (i==0 && (typeof dataLayerModel.get('renderOnLoad') === 'undefined' || dataLayerModel.get('renderOnLoad') == true)){
				//add layer to map
				leafletDataLayer.addTo(map);
			} else {
				//stick it in offLayers array
				view.offLayers[layerId] = leafletDataLayer;
			};
			//add to layers
			model.attributes.leafletDataLayers.push(leafletDataLayer);

			//interval needed to keep checking if layer not yet fully processed
			var interval = setInterval(triggerDone, 100);
			function triggerDone(){
				//check to make sure layer has been fully processed
				if (map.hasLayer(leafletDataLayer) || view.offLayers[layerId]){
					clearInterval(interval);
					//if the last layer, trigger the done event
					if (dataLayerModel.id == model.get('dataLayers').length-1 && techniqueModel.get('techniqueIndex') == techniqueModel.get('techniques').length-1){
						view.trigger('dataLayersDone');
					};
				};
			};			
		}, this);
	},
	setDataLayer: function(dataLayer, i){
		//global object to hold non-mapped layers
		if (!window.offLayers){ window.offLayers = {}; };
		//replace any periods in name and set class name
		dataLayer.name = dataLayer.name.replace(/\./g, '');
		dataLayer.className = dataLayer.name.replace(/\s/g, '-');
		//instantiate model for data layer
		var dataLayerModel = new DataLayerModel(dataLayer);
		//handle for determining layer order
		dataLayerModel.set('id', i);
		//get data and create thematic layers
		dataLayerModel.on('sync', this.setTechniques, this);
		dataLayerModel.fetch({url: dataLayer.source});
	},
	CustomControl: function(controlName, position){
		var model = this.model;
		var map = this.map;
		//extend Leaflet controls to create control
		var Control = L.Control.extend({
			options: {
				position: position
			},
			onAdd: function(map){
				//create container for control
				var container = L.DomUtil.create('div', controlName+'-control-container control-container');
				//add name and icon if not the interaction buttons
				if (controlName != 'interaction'){
					container.innerHTML = '<img class="icon" src="img/icons/'+controlName+'.png" alt="'+controlName+'" title="'+controlName+'"><span class="control-title">'+controlName+'</span>';
					$(container).hide();
				};
				//kill map interactions under control
				L.DomEvent.addListener(container, 'mousedown click dblclick', function(e) {
					L.DomEvent.stopPropagation(e);
				});
				return container;
			}
		});
		return Control;
	},
	layerChange: function(e){
		//edit legend
		var legendEntry = $('#legend-'+e.layer._leaflet_id);
		legendEntry.length > 0 && e.type == 'layeradd' ? legendEntry.show() : legendEntry.hide();
	},
	addLegend: function(){
		var model = this.model,
			map = this.map;
		//add legend control
		var CustomControl = this.CustomControl('legend', 'bottomright');
		this.legendControl = new CustomControl();
		//need to actually create SVGs in onAdd() function to work correctly
		this.legendControl.onAdd = function(map){
			//create container for control
			var container = L.DomUtil.create('div', 'legend-control-container control-container');
			var innerHTML = '<div class="open button" title="click to open legend"><img src="img/icons/legend.png" alt="legend"><span class="control-title">Legend</span></div><div id="legend-wrapper">';
			//add legend entry for each visible data layer
			_.each(model.get('leafletDataLayers'), function(layer, i){
				var id = 'legend-'+layer._leaflet_id;
				//only show immediately if layer is visible
				var display = map.hasLayer(layer) ? 'block' : 'none';
				innerHTML += '<div id="'+id+'" style="display: '+display+';"><p class="legend-layer-title">'+layer.layerName+' '+layer.techniqueType+'<br/>Attribute: '+layer.model.get('expressedAttribute')+'</p>';
				var legendView = new LegendLayerView({model: layer.model});
				innerHTML += legendView.$el[0].outerHTML + '</div>';
			}, this);
			innerHTML += '</div>';
			container.innerHTML = innerHTML;

			//kill map interactions under control
			L.DomEvent.addListener(container, 'mousedown click dblclick', function(e) {
				L.DomEvent.stopPropagation(e);
			});
			return container;
		};
		//add legend to the map
		this.map.addControl(this.legendControl);
		//add close button
		var closeButton = _.template( $('#close-button-template').html() );
		$('.legend-control-container').append(closeButton({x: $('.legend-control-container').width() - 20 + "px"}));
		//add open and close listeners
		$('.legend-control-container .open').click(function(){
			$('#legend-wrapper, .legend-control-container .close').show();
		});
		$('.legend-control-container .close').click(function(){
			$('#legend-wrapper, .legend-control-container .close').hide();
		});
		//hide everything but icon to start
		$('#legend-wrapper').hide();
	},
	setMapInteractions: {
		zoom: function(controlView, leafletView){
			var map = leafletView.map;
			//set on/off scripts
			controlView.addInteraction = function(){
				map.touchZoom.enable();
				map.scrollWheelZoom.enable();
				map.doubleClickZoom.enable();
				map.boxZoom.enable();
				map.keyboard._setZoomOffset(1);
			};
			controlView.removeInteraction = function(){
				map.touchZoom.disable();
				map.scrollWheelZoom.disable();
				map.doubleClickZoom.disable();
				map.boxZoom.disable();
				map.keyboard._setZoomOffset(0);
			};
			//add zoom control to map
			L.control.zoom({position: 'bottomleft'}).addTo(map);
			//customize zoom control style
			var zoomControl = $('.leaflet-control-zoom');
			zoomControl.css({
				border: '2px solid #000',
				'box-shadow': 'none',
				'float': 'none',
				margin: '10px auto 0',
				opacity: '0.5',
				width: '26px'
			});
			zoomControl.wrap('<div class="zoom-control-container control-container leaflet-control">');
			var zoomContainer = $('.zoom-control-container');
			zoomContainer.prepend('<img class="icon" src="img/icons/zoom.png" alt="zoom" title="zoom"><span class="control-title">zoom</span>');
			//hide zoom control
			zoomContainer.hide();
			//set message for first click alert
			controlView.message = 'In addition to the zoom tool, you can use a mouse scroll wheel, double-click, shift-click-drag, or the + and - keys to zoom on a desktop computer, and pinch to zoom on a touch-enabled device.';
			return controlView;
		},
		pan: function(controlView, leafletView){
			var map = leafletView.map;
			//on/off scripts
			controlView.addInteraction = function(){
				map.dragging.enable();
				map.keyboard._setPanOffset(80);
				//set cursor to grab if no retrieve
				if (!leafletView.interactions.retrieve || leafletView.interactions.retrieve == 'inactive'){
					$('.leaflet-interactive').css('cursor', 'grab');
				};				
			};
			controlView.removeInteraction = function(){
				map.dragging.disable();
				map.keyboard._setPanOffset(0);
				//set cursor to pointer if no retrieve
				if (!leafletView.interactions.retrieve || leafletView.interactions.retrieve == 'inactive'){
					$('.leaflet-interactive').css('cursor', 'default');
				};
			};
			//add pan control to map and hide
			var PanControl = leafletView.CustomControl('pan', 'bottomleft');
			var panControl = new PanControl();
			map.addControl(panControl);
			var panControlView = new PanControlView();
			//widget-based pan-handler
			panControlView.panMap = function(target){
				switch (target){
					case 'pan-up':
						map.panBy([0, -80]); break;
					case 'pan-left':
						map.panBy([-80, 0]); break;
					case 'pan-right':
						map.panBy([80, 0]); break;
					case 'pan-down':
						map.panBy([0, 80]); break;
				};
			};
			$('.pan-control-container').hide();
			//set message for first click alert
			controlView.message = 'In addition to the pan tool, you can click and drag the map or use the arrow keys to pan the map on a desktop computer, or touch and drag with one finger to pan the map on a touch-enabled device.';
			return controlView;
		},
		retrieve: function(controlView, leafletView){
			var map = leafletView.map;
			//on/off scripts
			controlView.addInteraction = function(){
				//close any hidden-but-open popups
				map.closePopup();
				$('.leaflet-popup-pane').show();
				$('.leaflet-interactive').removeAttr('style');
			};
			controlView.removeInteraction = function(){
				$('.leaflet-popup-pane').hide();
				//set cursor to grab if pan active or default if not
				if (leafletView.interactions.pan == 'active'){
					$('.leaflet-interactive').css('cursor', 'grab');
				} else {
					$('.leaflet-interactive').css('cursor', 'default');
				};
			};
			//add retrieve-control-container class to allow popup pane show/hide
			var popupPane = $('.leaflet-popup-pane');
			popupPane.attr('class', popupPane.attr('class') + ' retrieve-control-container');
			//set message for first click alert
			controlView.message = 'Retrieve information by clicking a map feature to open a pop-up on the feature.';
			return controlView;
		},
		overlay: function(controlView, leafletView){
			var map = leafletView.map,
				offLayers = leafletView.offLayers;
			//add overlay control
			var OverlayControl = leafletView.CustomControl('overlay', 'bottomleft');
			var overlayControl = new OverlayControl();
			map.addControl(overlayControl);

			//add to overlay control
			leafletView.on('dataLayersDone', function(){
				_.each(leafletView.model.get('leafletDataLayers'), function(dataLayer){
					var layerId = dataLayer._leaflet_id;
					var overlayControlModel = new OverlayControlModel({
						layerName: dataLayer.layerName,
						layerId: layerId,
						techniqueType: dataLayer.techniqueType
					});
					var overlayControlView = new OverlayControlView({model: overlayControlModel});
					//toggleLayer function must be defined for leaflet view
					overlayControlView.toggleLayer = function(layerId, addLayer){
						//trigger interaction logging if toggle was not due to reexpression
						if (!leafletView.reexpressed){ leafletView.trigger('overlay'); };
						//turn layer on/off
						if (map._layers[layerId] && !addLayer){
							leafletView.removeLayer(layerId);
						} else if (!map._layers[layerId] && offLayers[layerId]){
							leafletView.addLayer(layerId);
						};
					};
					overlayControlView.render();
					//only show the layers that are on the map
					if (offLayers[layerId]){
						$('#overlay-layer-'+layerId).hide();
					} else {
						$('#overlay-layer-'+layerId+' input').prop('checked', true);
					};
				}, this);
			}, this);

			return controlView;
		},
		underlay: function(controlView, leafletView){
			var map = leafletView.map;
			//add overlay control
			var UnderlayControl = leafletView.CustomControl('underlay', 'bottomleft');
			var underlayControl = new UnderlayControl();
			map.addControl(underlayControl);
			return controlView;
		},
		search: function(controlView, leafletView){
			var map = leafletView.map;
			//add search control to map and hide
			var SearchControl = leafletView.CustomControl('search', 'bottomleft');
			var searchControl = new SearchControl();
			map.addControl(searchControl);
			var searchInputView = new SearchInputView();
			searchInputView.on('reset', function(){
				map.setView(leafletView.model.get('mapOptions').center, leafletView.model.get('mapOptions').zoom);
				map.closePopup();
			}, this);
			$('.search-control-container').hide();
			//instantiate a view to call and display results
			var searchView = new SearchView();
			//function to show popup for clicked feature
			searchView.selectFeature = function(e, result){
				//reveal popups pane if retrieve is off
				map.closePopup();
				$('.leaflet-popup-pane').show();
				//open the retrieve popup or just the feature name if no retrieve
				_.each(result.layers, function(layer){
					if (map.hasLayer(layer)){
						if (layer._popup){
							layer.openPopup();
						} else {
							layer.openPopup(result.properties.name);
						};
						//reset map center to avoid overlapping search box
						var center = layer.getBounds ? layer.getBounds().getCenter() : layer.getLatLng();
						map.setView(center, null, {pan: {animate: false}});
						map.panBy([-50, 0]);
						//disable further popups if retrieve is off
						if (leafletView.interactions.retrieve == 'inactive'){
							layer.on('popupclose', function(){
								$('.retrieve-control-container').hide();
								layer.off('popupclose');
							});
						};
					}
				}, this);
			};
			//replace search model when mapped layers change
			function setSearchInput(){
				//reset search widget content
				$('#search-box input').val('');
				$('#search-results-box').html('');
				var allFeatures = [];
				_.each(leafletView.model.get('leafletDataLayers'), function(layer){
					if (map.hasLayer(layer)){
						allFeatures = _.union(allFeatures, layer.toGeoJSON().features);
					};
				});
				var options = {
					keys: ['properties.name']
				};
				//create a model for the data
				var searchModel = new SearchModel({
					allFeatures: allFeatures,
					searchOptions: options
				});
				//build Fuse search
				searchModel.createSearch();
				searchView.model = searchModel;
			};
			//reset widget on add and layer change
			controlView.addInteraction = setSearchInput;
			map.on('layeradd layerremove', setSearchInput);
			//return UI
			return controlView;
		},
		filter: function(controlView, leafletView){
			var map = leafletView.map,
				offLayers = leafletView.offLayers;
			//add control to map
			var CustomControl = leafletView.CustomControl('filter', 'bottomleft');
			var filterControl = new CustomControl();
			map.addControl(filterControl);

			//applyFilter function references map, so must be created here
			function applyFilter(attribute, values){
				//helpful abbreviations
				var min = values[0], max = values[1];
				//remove layers outside of filter range
				map.eachLayer(function(layer){
					if (layer.feature && layer.feature.properties && layer.feature.properties[attribute]){
						var layerValue = layer.feature.properties[attribute];
						//if value falls outside range, remove from map and stick in removed layers array
						if (layerValue < min || layerValue > max){
							map.removeLayer(layer);
							offLayers[layer._leaflet_id + '-filter'] = layer;
						};
					};
				});
				//add layers within filter range
				_.each(offLayers, function(layer){
					if (layer.feature && layer.feature.properties && layer.feature.properties[attribute]){
						var layerValue = layer.feature.properties[attribute];
						//if value within range, add to map and remove from removed layers array
						if (layerValue > min && layerValue < max){
							layer.addTo(map);
							delete offLayers[layer._leaflet_id + '-filter'];
						};
					};
				});
			};
			//get interaction variables
			var filterLayers = leafletView.model.get('interactions.filter.dataLayers'),
				controlType = leafletView.model.get('interactions.filter.tool');
			//set a tool for each included data layer
			_.each(leafletView.model.get('dataLayers'), function(dataLayer){
				//test for inclusion of data layer in filter interaction
				if (_.indexOf(filterLayers, dataLayer.name) > -1){
					//get filter properties
					var attributes = dataLayer.displayAttributes;
					//create filter view
					var filterView = controlType == 'logic' ? new FilterLogicView({applyFilter: applyFilter}) : new FilterSliderView({applyFilter: applyFilter});
					//dataLayer className hasn't been defined yet, so must use name here
					var className = dataLayer.name.replace(/\./g, '').replace(/\s/g, '-');
					//when the features are loaded, render the tool
					leafletView.once(className+'-features-added', function(){
						//set a filter tool
						var filterModel = new FilterModel({layerName: dataLayer.className, attributes: attributes, tool: controlType, map: map, features: leafletView.model.get('allFeatures')});
						filterView.model = filterModel;
						filterView.render();
						//trigger filter event on slider stop or logic filter entry
						var timeout = window.setTimeout(function(){}, 0);
						$('#'+dataLayer.className+'-slider').on('slidestop', function(){ leafletView.trigger('filter'); });
						$('#'+dataLayer.className+'-logic-div input').on('keyup', function(){
							clearTimeout(timeout);
							timeout = window.setTimeout(function(){ leafletView.trigger('filter'); }, 1000);
						});
					});
				};
			}, leafletView);
			//function to reset filter inputs
			controlView.removeInteraction = function(){
				//reset filter sliders
				$('.range-slider').each(function(){
					var layerName = $(this).attr('id').split('-');
					layerName.pop();
					layerName = layerName.join('-');
					var sliderOptions = $(this).slider('option');
					$(this).slider('values', [sliderOptions.min, sliderOptions.max]);
					$('#'+layerName+'-labels .left').text(sliderOptions.min);
					$('#'+layerName+'-labels .right').text(sliderOptions.max);
				});
				//reset logic inputs
				$('.filter-row input').val('');
				//reset layers
				_.each(offLayers, function(layer){
					if (offLayers[layer._leaflet_id + '-filter']){
						layer.addTo(map);
						delete offLayers[layer._leaflet_id + '-filter'];
					};
				});
			};
			//update filter on overlay change
			leafletView.map.on('layeradd layerremove', function(e){
				if (e.layer.className){
					var layerName = e.layer.className;
					if (e.type == 'layeradd'){
						//enable filtering
						$('#'+layerName+'-slider').slider('enable');
						$('#'+layerName+'-logic-div input').removeProp('disabled');
					} else {
						//reset and disable filter sliders
						var sliderOptions = $('#'+layerName+'-slider').slider('option');
						$('#'+layerName+'-slider').slider('values', [sliderOptions.min, sliderOptions.max]);
						$('#'+layerName+'-labels .left').text(sliderOptions.min);
						$('#'+layerName+'-labels .right').text(sliderOptions.max);
						$('#'+layerName+'-slider').slider('disable');
						//reset and disable logic inputs
						$('#'+layerName+'-logic-div input').val('');
						$('#'+layerName+'-logic-div input').prop('disabled', true);
					}
				};	
			});

			return controlView;
		},
		reexpress: function(controlView, leafletView){
			var map = leafletView.map,
				offLayers = leafletView.offLayers;

			//add control to map
			var CustomControl = leafletView.CustomControl('reexpress', 'bottomleft');
			var reexpressControl = new CustomControl();
			map.addControl(reexpressControl);

			//set inputs
			function setInputs(){
				_.each(leafletView.model.get('leafletDataLayers'), function(layer){
					//create reexpressModel for layer
					var reexpressModel = new ReexpressModel({
						layerName: layer.name,
						layerNameClass: layer.className,
						techniqueType: layer.techniqueType,
						techniqueTypeClass: layer.techniqueType.replace(/\s/g, ''),
						layerId: layer._leaflet_id
					});
					//instantiate section and input views
					var reexpressInputView = new ReexpressInputView({model: reexpressModel});
					reexpressInputView.setTechnique = function(e){
						var target = $(e.target),
							targetVal = target.val(),
							inputs = target.parents('.reexpress-section').find('input');
						//remove all map layers for given data layer
						_.each(inputs, function(input){
							var inputVal = $(input).val();
							//this ensures single-technique layers can be moved to top
							if (leafletView.map._layers[inputVal]){
								leafletView.removeLayer(inputVal);
								//fire reexpress event if layer was changed
								if (inputVal != targetVal){
									leafletView.trigger('reexpress');
								};
							};
							//hide overlay control inputs for inactive layers
							if (inputVal != targetVal){
								$('#overlay-layer-'+inputVal).hide();
							};
						});
						//add selected map layer
						if (!map._layers[targetVal]){
							leafletView.addLayer(targetVal);
							//show corresponding overlay control input
							$('#overlay-layer-'+targetVal+' input').prop('checked', true);
							$('#overlay-layer-'+targetVal).show();
						};
						//set cursor based on presence of other interactions
						if (leafletView.interactions.retrieve == 'active'){
							$('.leaflet-interactive').css('cursor', 'pointer');
						} else if (leafletView.interactions.pan == 'active'){
							$('.leaflet-interactive').css('cursor', 'grab');
						} else {
							$('.leaflet-interactive').css('cursor', 'default');
						};
					};
					//render input views
					reexpressInputView.render();
				}, this);
			};
			//function to check radio for currently expressed layers
			function resetTechniques(){
				_.each(leafletView.model.get('leafletDataLayers'), function(layer){
					if (map.hasLayer(layer)){
						var techniqueType = layer.techniqueType.replace(/\s/g, '');
						//check the radio button for layer in reexpress widget
						$('.reexpress-control-container input[name='+layer.className+'].'+techniqueType).prop('checked', true);
					};
				}, this);
			};
			//add data layers after loaded
			leafletView.on('dataLayersDone', function(){
				setInputs();
				resetTechniques();
			}, this);
			//disable reexpress for data layers not shown on map
			map.on('layeradd layerremove', function(e){
				if (e.layer.className && e.layer.techniqueType){
					var layerSection = $('#'+e.layer.className+'-reexpress-section');
					if (e.type == 'layerremove'){
						layerSection.find('input').prop('disabled', true);
						layerSection.find('label').css('opacity', '0.5');
					} else {
						layerSection.find('input').removeProp('disabled');
						layerSection.find('label').css('opacity', '1');
					};
				};
			});
			return controlView;
		},
		resymbolize: function(controlView, leafletView){
			var map = leafletView.map;

			//add control to map
			var CustomControl = leafletView.CustomControl('resymbolize', 'bottomleft');
			var resymbolizeControl = new CustomControl();
			map.addControl(resymbolizeControl);


			return controlView;
		},
		reproject: function(controlView, leafletView){
			return controlView;
		}
	},
	setInteractionControls: function(){
		//set no-interaction map option defaults
		var noInteraction = {
			zoomControl: false,
			touchZoom: false,
			scrollWheelZoom: false,
			doubleClickZoom: false,
			boxZoom: false,
			dragging: false,
			keyboardPanOffset: 0,
			keyboardZoomOffset: 0
		};
		var mapOptions = this.model.get('mapOptions');
		this.model.set('mapOptions', _.extend(mapOptions, noInteraction));
		//once map has been set, add interaction UI controls
		this.on('mapset', function(){
			var map = this.map;
			//set interaction toggle buttons control
			var InteractionControl = this.CustomControl('interaction', 'topright');
			var interactionControl = new InteractionControl();
			interactionControl.addTo(map);
			//create new button for each interaction
			for (var interaction in this.model.get('interactions')){
				//instantiate model
				var interactionControlModel = new InteractionControlModel({interaction: interaction});
				//instantiate view
				var interactionToggleView = new InteractionToggleView({model: interactionControlModel});
				//listen for toggle to set status of interaction in map view
				interactionToggleView.on('toggle', function(e){
					this.interactions[e.interaction] = e.state;
				}, this);
				//add controls and scripts for each included interaction
				if (this.setMapInteractions[interaction]){
					interactionToggleView = this.setMapInteractions[interaction](interactionToggleView, this);
					//change interaction property of Leaflet view from false to 'inactive'
					this.interactions[interaction] = 'inactive';
				};
				//render interaction toggle button
				interactionToggleView.render();
			};
		}, this);

		this.on('dataLayersDone', function(){
			//set legend control
			if (typeof this.model.get('mapOptions.legend') == 'undefined' || this.model.get('mapOptions.legend')){
				this.addLegend();
			};
			//prevent retrieve by default
			$('.leaflet-popup-pane').hide();
			$('.leaflet-interactive').css('cursor', 'default');
		}, this);
	},
	logInteractions: function(){
		//designate events to listen to with contexts for each interaction
		var interactionCreation = {
			zoom: {zoomstart: this.map},
			pan: {dragend: this.map},
			retrieve: {popupopen: this},
			overlay: {overlay: this},
			underlay: {baselayerchange: this.map},
			search: {search: this},
			filter: {filter: this},
			reexpress: {reexpress: this}
		};
		//create a new interaction object for each interaction with logging
		var interactions = this.model.get('interactions');
		for (var interaction in interactionCreation){
			if (interactions[interaction] && interactions[interaction].logging){
				var i = new Interaction({interaction: interaction});
				i.create(interactionCreation[interaction]);
			};
		};
	},
	setMap: function(){
		//configure map interactions
		this.setInteractionControls();
		//create Leaflet layers arrays
		this.model.set({
			leafletBaseLayers: [],
			leafletDataLayers: []
		});

		//instantiate map
		this.map = L.map('map', this.model.get('mapOptions'));

		//trigger mapset event
		this.trigger('mapset');

		//set layer change listener
		var layerChange = this.layerChange;
		this.map.on('layeradd layerremove', layerChange);

		//add initial tile layers
		var baseLayers = this.model.get('baseLayers');
		_.each(baseLayers, this.setBaseLayer, this);

		//add each data layer
		var dataLayers = this.model.get('dataLayers');
		_.each(dataLayers, this.setDataLayer, this);

		//set interaction logging
		this.logInteractions();
	}
});

/************** set map view ****************/

function setMapView(options){
	var mapView = eval("new " + options.get('library') + "Map({model: options})");
	mapView.render().setMap();
};

/************** map config ****************/

var MapConfig = Backbone.DeepModel.extend({
	url: "config/map.json"
});

//get map configuration options
var mapConfig = new MapConfig();
mapConfig.on('sync', setMapView);
mapConfig.fetch();

})();